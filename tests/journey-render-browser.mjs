import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { changedPixelFraction } from "./image-difference.mjs";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? { channel: "chrome", headless: true } : {
  headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [], results = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const [z, stage] of [[-140, "rapids"], [-230, "lake"], [-320, "valley"], [-400, "lowlands"], [-470, "estuary"], [-530, "ocean"]]) {
    await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&journeyZ=${z}&journeyX=2.7${native ? "" : "&forceWebGL"}`);
    await page.waitForFunction(() => window.advanceTime);
    await page.evaluate(() => window.advanceTime(500));
    const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(state.renderer, native ? "WebGPU" : "WebGL2"); assert.equal(state.journey.id, stage);
    assert.ok(Math.abs(state.y - state.journey.waterLevel) < 0.3);
    const wet = await page.screenshot({ path: `output/web-game/journey-${stage}-${native ? "native" : "webgl2"}.png` });
    await page.evaluate(() => { window.setVerificationWaterVisible(false); window.advanceTime(0); });
    const dry = await page.screenshot();
    // Mid-river band below the horizon and above the hero, clear of shore walls.
    const coverage = await changedPixelFraction(page, wet, dry, [0.2, 0.65, 0.58, 0.66]);
    assert.ok(coverage > 0.75, `${stage}: water missing over its bed (${coverage})`);
    results.push({ stage, coverage, grid: state.waterGrid, origin: state.physics.origin, resources: state.resources });
  }
  assert.equal(new Set(results.map((r) => r.grid.vertices)).size, 1);
  assert.ok(results.at(-1).origin.z < -500);
  assert.deepEqual(errors, []);
  await writeFile(`output/web-game/journey-render-${native ? "native" : "webgl2"}.json`, JSON.stringify(results, null, 2));
  console.log("Every route stage has visible water, supported hero and a constant-size grid", JSON.stringify(results.map((r) => ({ stage: r.stage, coverage: r.coverage }))));
} finally { await browser.close(); }
