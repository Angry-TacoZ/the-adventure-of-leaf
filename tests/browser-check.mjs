import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  window.mockPad = {
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      value: 0,
      pressed: false,
      touched: false,
    })),
  };
  Object.defineProperty(navigator, "getGamepads", {
    value: () => [window.mockPad, null, null, null],
  });
});
await page.goto(
  `${process.env.LEAF_BASE_URL || "http://127.0.0.1:5173"}/?testMode=manual&forceWebGL`,
);
await page.waitForFunction(() => window.render_game_to_text);
const read = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
let s = await read();
assert.equal(s.gamepad, true);
assert.equal(s.rendererEngine, "WebGPURenderer");
assert.equal(s.renderer, "WebGL2");
await page.evaluate(() => window.advanceTime(2000));
let n = await read();
assert.ok(n.z < s.z - 1);
assert.ok(Math.abs(n.y) < 0.2);
await page.evaluate(() => {
  window.mockPad.axes[0] = 1;
  for (let i = 0; i < 4; i++) {
    window.mockPad.buttons[7].value = 1;
    window.advanceTime(20);
    window.mockPad.buttons[7].value = 0;
    window.advanceTime(20);
  }
  window.advanceTime(2000);
});
let w = await read();
assert.ok(w.x > n.x + 0.2 && w.intensity > 0.9 && w.windLevel === 4);
await page.evaluate(() => {
  window.mockPad.axes[0] = 0;
  for (let i = 0; i < 3; i++) {
    window.mockPad.buttons[6].value = 1;
    window.advanceTime(20);
    window.mockPad.buttons[6].value = 0;
    window.advanceTime(20);
  }
  window.advanceTime(2000);
});
let l = await read();
assert.equal(l.windLevel, 1);
assert.ok(l.intensity < 0.3);
await page.evaluate(() => window.advanceTime(1000));
let neutral = await read();
assert.equal(neutral.windLevel, 1);
assert.ok(neutral.intensity > 0.24);
await page.screenshot({ path: "output/web-game/controller.png" });
await page.keyboard.press("r");
for (let i = 0; i < 4; i++) {
  await page.keyboard.down("e");
  await page.evaluate(() => window.advanceTime(20));
  await page.keyboard.up("e");
  await page.evaluate(() => window.advanceTime(20));
}
await page.keyboard.down("d");
await page.evaluate(() => window.advanceTime(2000));
await page.keyboard.up("d");
const keyboard = await read();
assert.ok(keyboard.x > 0.2 && keyboard.intensity > 0.9);
await page.getByRole("button", { name: "River tuning · development" }).click();
await page.getByText("Water / current").waitFor({ state: "visible" });
await page.getByText("Save local preset").click();
assert.ok(await page.evaluate(() => !!localStorage.getItem("leaf-tuning")));
// Quality changes must still resize the drawing buffer after removing per-frame resets.
const quality = page.getByRole("textbox", { name: "quality", exact: true });
await quality.fill("0.5");
await quality.press("Enter");
await page.waitForFunction(
  () => document.querySelector("canvas").width === 640,
);
assert.equal((await read()).waterOptics.size, 160);
await quality.fill("1");
await quality.press("Enter");
await page.waitForFunction(
  () => document.querySelector("canvas").width === 1280,
);
await page.evaluate(() => window.advanceTime(0));
const hideOverlays = await page.addStyleTag({
  content: "#hud,.lil-gui{visibility:hidden}",
});
const enabled = await page.locator("canvas").screenshot({
  path: "output/web-game/water-optics.png",
});
await page.evaluate(() => window.setWaterOptics(0, 1));
const withoutReflection = await page.locator("canvas").screenshot({
  path: "output/web-game/water-no-reflection.png",
});
assert.notDeepEqual(
  enabled,
  withoutReflection,
  "reflection must change rendered pixels",
);
await page.evaluate(() => window.setWaterOptics(1, 0));
const withoutRefraction = await page.locator("canvas").screenshot({
  path: "output/web-game/water-no-refraction.png",
});
assert.notDeepEqual(
  enabled,
  withoutRefraction,
  "refraction must change rendered pixels",
);
await page.evaluate(() => window.setWaterOptics(1, 1));
await hideOverlays.evaluate((e) => e.remove());
assert.ok((await read()).waterOptics.captures > 0);
assert.deepEqual(errors, []);
// Close the first WebGL page before creating another to avoid competing render loops.
await page.close();
// Reproduce the calm, low-camera frame where water previously cut into the blade.
const leafPage = await browser.newPage({
  viewport: { width: 1280, height: 720 },
});
await leafPage.goto(
  `${process.env.LEAF_BASE_URL || "http://127.0.0.1:5173"}/?testMode=manual&forceWebGL`,
);
await leafPage.waitForFunction(() => window.advanceTime);
await leafPage.evaluate(() => window.advanceTime(51200));
const leafImage = await leafPage.screenshot();
// The renderer now permits submersion; compare complete frames rather than a single pixel.
const submersionImages = [];
for (const [name, offset, pitch] of [
  ["above", 0.14, 0],
  ["partial", 0, 0.35],
  ["submerged", -0.18, 0],
]) {
  await leafPage.evaluate(
    ([offset, pitch]) => {
      window.setLeafSubmersion(offset, pitch);
      window.advanceTime(0);
    },
    [offset, pitch],
  );
  submersionImages.push(
    await leafPage.screenshot({ path: `output/web-game/leaf-${name}.png` }),
  );
  const silhouette = await leafPage.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(400, 180, 480, 400).data;
    let count = 0,
      minX = 480,
      maxX = 0,
      minY = 400,
      maxY = 0;
    for (let y = 0; y < 400; y++)
      for (let x = 0; x < 480; x++) {
        const i = (y * 480 + x) * 4;
        if (
          pixels[i] > 90 &&
          pixels[i + 1] > 85 &&
          pixels[i + 2] < pixels[i] * 0.45 &&
          pixels[i + 2] < pixels[i + 1] * 0.45
        ) {
          count++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    return {
      count,
      fill: count / Math.max(1, (maxX - minX + 1) * (maxY - minY + 1)),
    };
  }, submersionImages.at(-1).toString("base64"));
  assert.ok(
    silhouette.count > 1000 && silhouette.fill > 0.45,
    `${name}: missing/fragmented leaf ${JSON.stringify(silhouette)}`,
  );
}
assert.notDeepEqual(submersionImages[0], submersionImages[1]);
assert.notDeepEqual(submersionImages[1], submersionImages[2]);
await leafPage.evaluate(() => {
  window.clearLeafSubmersion();
  window.advanceTime(150000);
});
const looped = await leafPage.evaluate(() =>
  JSON.parse(window.render_game_to_text()),
);
assert.ok(looped.laps >= 2, `expected repeated laps, got ${looped.laps}`);
assert.ok(
  Math.abs(looped.camera.z - looped.z - 0.65) < 1,
  "camera did not follow loop",
);
await leafPage.close();
const fallback = await browser.newPage();
await fallback.addInitScript(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
await fallback.goto(process.env.LEAF_BASE_URL || "http://127.0.0.1:5173/");
await fallback.getByRole("alert").waitFor();
assert.match(
  await fallback.getByRole("alert").textContent(),
  /Graphics initialization failed/,
);
await fallback.close();
console.log(
  JSON.stringify(
    { initial: s, downstream: n, wind: w, lower: l, neutral, keyboard, errors },
    null,
    2,
  ),
);
await browser.close();
