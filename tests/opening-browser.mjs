import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { compareLeafSilhouette } from "./leaf-silhouette.mjs";
await mkdir("output/web-game", { recursive: true });
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? { channel: "chrome", headless: true }
  : { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&opening${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const start = await read();
  assert.equal(start.opening.phase, "falling"); assert.ok(start.y > 2.5);
  assert.ok(Math.abs(start.x) < 1, "opening bypasses the first steering hazard");
  await page.locator("#quality").evaluate((control) => { control.value = "0.5"; control.dispatchEvent(new Event("change")); });
  assert.equal((await read()).forest.openingVisible, true, "low quality must retain the opening tree");
  await page.locator("#quality").evaluate((control) => { control.value = "1"; control.dispatchEvent(new Event("change")); });
  await page.evaluate(() => { window.setVerificationForestVisible(false); window.advanceTime(0); });
  const reference = await page.screenshot();
  await page.evaluate(() => { window.setVerificationForestVisible(true); window.advanceTime(0); });
  const actual = await page.screenshot({ path: `output/web-game/opening-${native ? "native" : "webgl2"}.png` });
  const silhouette = await compareLeafSilhouette(page, reference, actual);
  assert.ok(silhouette.reference > 10000 && silhouette.coverage > 0.9 && silhouette.area > 0.9,
    `canopy obstructs the opening hero: ${JSON.stringify(silhouette)}`);
  await page.evaluate(() => window.advanceTime(1000));
  const falling = await read();
  assert.ok(falling.y < start.y - 1 && falling.y > 1);
  assert.ok(Math.abs(falling.camera.y - falling.y - 0.22) < 0.01);
  await page.evaluate(() => window.advanceTime(4000));
  const landed = await read();
  assert.equal(landed.opening.phase, "afloat");
  assert.ok(Math.abs(landed.y) < 0.3 && landed.z < start.z);
  assert.equal(landed.physics.fragments, 1); assert.equal(landed.physics.tears, 0);
  await page.keyboard.press("r");
  const reset = await read(); assert.equal(reset.opening.phase, "falling"); assert.equal(reset.time, 0);
  assert.equal(reset.physics.fragments, 1); assert.ok(Math.abs(reset.y - start.y) < 1e-5);
  const identity = await page.evaluate(async () => {
    const { createRiverLeaf } = await import("/src/river-leaf.ts");
    const leaf = await createRiverLeaf();
    try {
      const original = leaf.readFrame().fragments[0]; const uvs = [...original.uvs];
      const originalIds = [...original.vertexIds];
      leaf.reset({ x: 2, y: 4, z: 3 });
      const shifted = leaf.readFrame().fragments[0];
      const maxUvError = Math.max(...shifted.uvs.map((v, i) => Math.abs(v - uvs[i])));
      const shiftedIds = [...shifted.vertexIds];
      leaf.forceTear();
      const retained = new Set(leaf.readFrame().fragments.flatMap((f) => [...f.vertexIds].filter((v) => v !== 0xffffffff)));
      return { originalIds, shiftedIds, maxUvError, retained: retained.size };
    } finally { leaf.dispose(); }
  });
  assert.equal(new Set(identity.originalIds).size, 51); assert.ok(!identity.originalIds.includes(0xffffffff));
  assert.deepEqual(identity.shiftedIds, identity.originalIds);
  assert.ok(identity.maxUvError < 1e-5); assert.equal(identity.retained, 51);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ backend: start.renderer, opening: { startY: start.y, afterOneSecond: falling.y, landedY: landed.y }, silhouette, identity }));
} finally { await browser.close(); }
