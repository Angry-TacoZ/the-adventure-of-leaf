import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${process.env.LEAF_BASE_URL}/rapier-prototype.html`);
  await page.waitForSelector("canvas");
  const result = await page.evaluate(async () => {
    const { createSoftLeafPrototype } = await import("/src/rapier-leaf-prototype.ts");
    const control = await createSoftLeafPrototype();
    const forced = await createSoftLeafPrototype();
    try {
      control.world.gravity = { x: 0, y: 0, z: 0 };
      forced.world.gravity = { x: 0, y: 0, z: 0 };
      forced.body.applyParticleImpulse(0, { x: 0, y: 0.003, z: 0 }, true);
      for (let i = 0; i < 60; i++) { control.step(); forced.step(); }
      return { a: Array.from(control.body.particlePositions()), b: Array.from(forced.body.particlePositions()), count: forced.body.numParticles(), dt: forced.world.timestep };
    } finally { control.dispose(); forced.dispose(); }
  });
  assert.equal(result.count, 8);
  assert.ok(Math.abs(result.dt - 1 / 120) < 1e-7);
  assert.ok(result.b.every(Number.isFinite));
  const delta = result.b.map((v, i) => v - result.a[i]);
  assert.ok(Math.abs(delta[1]) > 0.001, "impulse moves the targeted particle");
  assert.ok(delta.some((v, i) => i >= 3 && Math.abs(v) > 0.0001), "motion propagates to other particles");
  assert.deepEqual(errors, []);
  console.log("Rapier WASM soft body and localized impulse propagation passed");
} finally { await browser.close(); }
