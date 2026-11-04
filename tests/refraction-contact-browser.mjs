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
  await page.evaluate(() => { window.setVerificationWaterVisible(false); window.advanceTime(0); });
  const reference = await page.screenshot({ path: `${directory}/rock-contact-reference.png`, clip: { x: 550, y: 490, width: 550, height: 120 } });
  const result = await page.evaluate(async ([encoded, reference]) => {
    async function decode(value) {
      const image = new Image(); image.src = `data:image/png;base64,${value}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
      return { pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
    }
    const { pixels, width, height } = await decode(encoded), ref = await decode(reference);
    const gold = (data, i) => data[i] > 100 && data[i] > data[i + 1] * 1.15 && data[i + 1] > data[i + 2] * 1.3;
    const mask = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      if (gold(pixels, i)) mask.add(i / 4);
    }
    const areas = [];
    while (mask.size) {
      const seed = mask.values().next().value;
      mask.delete(seed); const stack = [seed]; let area = 0, unsupported = 0;
      while (stack.length) {
        const i = stack.pop(); area++;
        const x = i % width, y = Math.floor(i / width);
        // Lighting and the crop edge can split a genuine piece of the hero's
        // gold mask. Reject only detached color absent from its unobstructed
        // reference, with a one-pixel antialiasing neighbourhood.
        let supported = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
          if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height &&
            gold(ref.pixels, ((y + dy) * width + x + dx) * 4)) supported = true;
        if (!supported) unsupported++;
        for (const neighbour of [x ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width])
          if (mask.delete(neighbour)) stack.push(neighbour);
      }
      areas.push({ area, unsupported });
    }
    areas.sort((a, b) => b.area - a.area);
    return { components: areas.map((c) => c.area), detachedPixels: areas.slice(1).reduce((n, c) => n + c.unsupported, 0) };
  }, [shot.toString("base64"), reference.toString("base64")]);
  assert.ok(result.components[0] > 15000, "contact frame no longer contains the hero reference region");
  assert.ok(result.detachedPixels < 3, `detached gold refraction slivers at rock contact: ${JSON.stringify(result)}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ backend: state.renderer, ...result }));
} finally { await browser.close(); }
