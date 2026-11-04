import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual`);
  await page.waitForFunction(() => window.advanceTime);
  const state = await page.evaluate(() => {
    window.advanceTime(30000);
    return JSON.parse(window.render_game_to_text());
  });
  assert.equal(state.physics.engine, "Rapier");
  assert.ok(state.physics.particles > 8);
  assert.ok(
    state.z < -10,
    "calm current carries actual Rapier leaf downstream",
  );
  assert.ok(Math.abs(state.y) < 0.3, "sampled buoyancy supports leaf");
  assert.ok(
    [state.x, state.y, state.z, state.vx, state.vy, state.vz].every(
      Number.isFinite,
    ),
  );
  await page.keyboard.press("r");
  const reset = await page.evaluate(() => {
    window.advanceTime(0);
    return JSON.parse(window.render_game_to_text());
  });
  assert.equal(reset.laps, 0);
  assert.ok(Math.abs(reset.z) < 0.01);
  assert.deepEqual(errors, []);
  console.log("Rapier gameplay downstream travel, buoyancy and reset passed");
} finally {
  await browser.close();
}
