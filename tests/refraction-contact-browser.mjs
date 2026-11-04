import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native
  ? { channel: "chrome", headless: true }
  : { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  await page.evaluate(() => {
    window.advanceTime(10500);
    // Isolate the reported refractive contact defect from the planar reflection.
    window.setWaterOptics(0, 1);
  });
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(state.renderer, native ? "WebGPU" : "WebGL2");
  const directory = native ? "output/optics-native" : "output/optics";
  await mkdir(directory, { recursive: true });
  const shot = await page.screenshot({ path: `${directory}/rock-contact.png`, clip: { x: 550, y: 490, width: 550, height: 120 } });
  const components = await page.evaluate(async (encoded) => {
    const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const mask = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = pixels.subarray(i, i + 3);
      if (r > 100 && r > g * 1.15 && g > b * 1.3) mask.add(i / 4);
    }
    const areas = [];
    while (mask.size) {
      const seed = mask.values().next().value;
      mask.delete(seed); const stack = [seed]; let area = 0;
      while (stack.length) {
        const i = stack.pop(); area++;
        const x = i % canvas.width;
        for (const neighbour of [x ? i - 1 : -1, x < canvas.width - 1 ? i + 1 : -1, i - canvas.width, i + canvas.width])
          if (mask.delete(neighbour)) stack.push(neighbour);
      }
      areas.push(area);
    }
    return areas.sort((a, b) => b - a);
  }, shot.toString("base64"));
  assert.ok(components[0] > 15000, "contact frame no longer contains the hero reference region");
  assert.equal(components.filter((n) => n >= 3).length, 1,
    `detached gold refraction slivers at rock contact: ${components}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ backend: state.renderer, contactComponents: components }));
} finally { await browser.close(); }
