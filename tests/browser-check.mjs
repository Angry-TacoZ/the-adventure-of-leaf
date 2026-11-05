import { compareLeafSilhouette } from "./leaf-silhouette.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
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
// CI software compositing can exceed Playwright's default 30 s capture budget.
// Keep the capture and all gameplay assertions, with a bounded 60 s allowance.
await page.screenshot({ path: "output/web-game/controller.png", timeout: 60000 });
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
      window.setVerificationWaterVisible(false);
      window.advanceTime(0);
    },
    [offset, pitch],
  );
  const reference = await leafPage.screenshot();
  await leafPage.evaluate(() => {
    window.setVerificationWaterVisible(true);
    window.advanceTime(0);
  });
  submersionImages.push(
    await leafPage.screenshot({ path: `output/web-game/leaf-${name}.png` }),
  );
  const silhouette = await compareLeafSilhouette(
    leafPage,
    reference,
    submersionImages.at(-1),
  );
  assert.ok(
    silhouette.reference > 1000,
    name + ": inadequate unobstructed reference",
  );
  assert.ok(
    silhouette.coverage > 0.85 &&
      silhouette.area > 0.65 &&
      silhouette.area < 1.4,
    name + ": missing or ghosted leaf " + JSON.stringify(silhouette),
  );
}
assert.notDeepEqual(submersionImages[0], submersionImages[1]);
assert.notDeepEqual(submersionImages[1], submersionImages[2]);
await leafPage.evaluate(() => window.clearLeafSubmersion());
// The full-route run uses the real canopy opening and its reset on later laps.
await leafPage.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&opening&forceWebGL`);
await leafPage.waitForFunction(() => window.advanceTime);
await leafPage.evaluate(() => window.advanceTime(5000));
await leafPage.keyboard.down("e");
await leafPage.evaluate(() => window.advanceTime(20));
await leafPage.keyboard.up("e");
await leafPage.evaluate(() => window.advanceTime(20));
// The test player maintains its lane with gentle analog wind and feedback.
// Low graphics bounds CI compositing cost over 1,200 simulated seconds; the
// optics above and separate production-RAF suite retain their original resolutions.
// This driver is test-only; gameplay has no automatic upstream steering.
const corrections = { left: 0, right: 0 };
const visited = new Set();
let firstLapResources;
await leafPage.locator("#quality").evaluate((control) => {
  control.value = "0.5"; control.dispatchEvent(new Event("change"));
});
await leafPage.evaluate(() => {
  window.journeyPad = { connected: true, mapping: "standard", axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0 })) };
  Object.defineProperty(navigator, "getGamepads", { value: () => [window.journeyPad] });
});
for (let i = 0; i < 300; i++) {
  const pose = await leafPage.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  visited.add(pose.journey.id);
  if (pose.laps >= 1) firstLapResources ??= pose.resources;
  assert.equal(pose.menu, null, `test player lost at ${pose.z}`);
  const axis = pose.opening.phase === "falling" ? 0 : pose.x < 1.8 ? 1 : pose.x < 2.6 ? 0.4 : pose.x > 3 ? -0.4 : 0;
  if (axis > 0) corrections.right++;
  if (axis < 0) corrections.left++;
  await leafPage.evaluate((axis) => { window.journeyPad.axes[0] = axis; window.advanceTime(4000); }, axis);
}
await leafPage.keyboard.up("d");
await leafPage.keyboard.up("a");
const looped = await leafPage.evaluate(() =>
  JSON.parse(window.render_game_to_text()),
);
assert.ok(looped.laps >= 2, `expected repeated laps, got ${looped.laps} at ${looped.x},${looped.z}`);
assert.ok(corrections.left > 0 && corrections.right > 0, "test player did not correct its lane in both directions");
for (const stage of ["headwaters", "rapids", "lake", "valley", "lowlands", "estuary", "ocean"])
  assert.ok(visited.has(stage), `test player did not render ${stage}`);
assert.ok(looped.resources.geometries <= firstLapResources.geometries + 1, "geometry grew after the first complete journey");
assert.ok(looped.resources.textures <= firstLapResources.textures + 2, "textures grew after the first complete journey");
await writeFile("output/web-game/journey-laps.json", JSON.stringify({
  stages: [...visited], laps: looped.laps, corrections, time: looped.time,
  firstLapResources, finalResources: looped.resources, backend: looped.renderer,
  quality: 0.5, viewport: [1280, 720], physics: looped.physics,
}, null, 2));
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
