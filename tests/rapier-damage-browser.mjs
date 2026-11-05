import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual`);
  await page.waitForFunction(() => window.advanceTime);
  const result = await page.evaluate(async () => {
    const { createRiverLeaf } = await import("/src/river-leaf.ts");
    const { initial, defaults, updateWind } =
      await import("/src/simulation.ts");
    const leaf = await createRiverLeaf();
    const state = initial();
    const neutral = { x: 0, z: 0, raise: 0, lower: 0 };
    try {
      for (let i = 0; i < 120; i++) {
        updateWind(state, defaults, neutral, 1 / 120);
        leaf.step(state, defaults);
      }
      const gentle = leaf.diagnostics();
      const before = leaf.readFrame().fragments.map((f) => f.id);
      const cut = leaf.forceTear();
      const frames = leaf.readFrame().fragments;
      const ids = frames.map((f) => f.id),
        triangles = frames.map((f) => f.indices.length / 3);
      const body = leaf.world.softBodies.getAll()[0];
      body.applyImpulse({ x: 0.0003, y: 0, z: 0 }, true);
      for (let i = 0; i < 120; i++) {
        updateWind(state, defaults, neutral, 1 / 120);
        leaf.step(state, defaults);
      }
      const separated = leaf.readFrame().fragments.map((f) => ({
        id: f.id,
        x:
          f.positions.filter((_, i) => i % 3 === 0).reduce((a, b) => a + b, 0) /
          (f.positions.length / 3),
      }));
      leaf.reset();
      const reset = leaf.readFrame().fragments.length;
      // Strong upstream input must not reverse travel or bypass the force solver.
      Object.assign(state, initial(), { windLevel: 4, intensity: 1, windZ: 1 });
      for (let i = 0; i < 1200; i++) {
        updateWind(
          state,
          defaults,
          { x: 0, z: 1, raise: 0, lower: 0 },
          1 / 120,
        );
        leaf.step(state, defaults);
      }
      const upstreamZ = state.z;
      leaf.reset();
      const stressed = leaf.world.softBodies.getAll()[0];
      stressed.setParticlePinned(0, true);
      stressed.applyParticleImpulse(
        stressed.numParticles() - 1,
        { x: 0.006, y: 0.006, z: 0 },
        true,
      );
      for (let i = 0; i < 120; i++) leaf.step(state, defaults);
      const stressDamage = leaf.diagnostics();
      return {
        gentle,
        before,
        cut,
        ids,
        triangles,
        separated,
        reset,
        upstreamZ,
        stressDamage,
      };
    } finally {
      leaf.dispose();
    }
  });
  assert.equal(result.gentle.fragments, 1);
  assert.equal(result.gentle.tears, 0);
  assert.equal(result.cut, 2);
  assert.equal(new Set(result.ids).size, 2);
  assert.ok(result.triangles.every((n) => n > 0));
  assert.ok(Math.abs(result.separated[0].x - result.separated[1].x) > 0.01);
  assert.equal(result.reset, 1);
  assert.ok(result.upstreamZ < -0.1);
  assert.ok(
    result.stressDamage.tears > 0,
    "concentrated stress should trigger engine tearing",
  );
  await page.keyboard.press("r");
  const a = await page.evaluate(() => {
    for (let i = 0; i < 6; i++) window.advanceTime(20);
    return JSON.parse(window.render_game_to_text());
  });
  await page.keyboard.press("r");
  const b = await page.evaluate(() => {
    window.advanceTime(120);
    return JSON.parse(window.render_game_to_text());
  });
  for (const key of ["time", "x", "y", "z", "vx", "vy", "vz"])
    assert.ok(
      Math.abs(a[key] - b[key]) < 1e-6,
      `manual clock differs for ${key}`,
    );
  console.log(
    "Rapier gentle stability, physical cut/fragments, reset, upstream wind and partitioned fixed clock passed",
  );
} finally {
  await browser.close();
}
