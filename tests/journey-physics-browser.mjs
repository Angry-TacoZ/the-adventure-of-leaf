import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? { channel: "chrome", headless: true } : {
  headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  const result = await page.evaluate(async () => {
    const { createRiverLeaf } = await import("/src/river-leaf.ts");
    const { initial, defaults, updateWind } = await import("/src/simulation.ts");
    const { journeyAt, waterLevel } = await import("/src/journey.ts");
    const owner = await createRiverLeaf(), state = initial(), checkpoints = [], translated = [];
    const neutral = { x: 0, z: 0, raise: 0, lower: 0 };
    try {
      // Same weak current at distant coordinates exposed an unforced acceleration.
      for (const z of [0, -510]) {
        Object.assign(state, initial(), { x: 2.7, y: waterLevel(z), z }); owner.reset(state);
        const params = { ...defaults, current: 0, variation: 0, turbulence: 0, ripple: 0 };
        for (let i = 0; i < 120 * 20; i++) { updateWind(state, params, neutral, 1 / 120); owner.step(state, params); }
        translated.push({ z, velocity: state.vz, stateZ: state.z, health: owner.diagnostics() });
      }
      Object.assign(state, initial(), { x: 2.7, windLevel: 1 }); owner.reset({ x: 2.7, y: 0.08, z: 0 });
      let stage = "", maxJump = 0, maxStepVelocityError = 0;
      for (let i = 0; i < 120 * 800 && !state.laps; i++) {
        const x = state.x < 2.6 ? 1 : state.x > 3 ? -1 : 0;
        updateWind(state, defaults, { ...neutral, x }, 1 / 120);
        const beforeZ = state.z; owner.step(state, defaults);
        if (!state.laps) {
          maxJump = Math.max(maxJump, Math.abs(state.z - beforeZ));
          maxStepVelocityError = Math.max(maxStepVelocityError, Math.abs((state.z - beforeZ) * 120 - state.vz));
        }
        const next = journeyAt(state.z), health = owner.diagnostics();
        if (next.id !== stage) { checkpoints.push({ stage: next.id, x: state.x, z: state.z, y: state.y, time: state.time, health }); stage = next.id; }
        if (health.integrity < 0.25) break;
      }
      // Cuts and UV identities must survive a translated physics frame.
      owner.reset({ x: 0, y: -2.9, z: -520 });
      const before = owner.readFrame().fragments[0];
      const sourceIds = [...before.vertexIds].filter((id) => id < 51);
      owner.forceTear(); const cut = owner.readFrame().fragments.map((f) => ({
        id: f.id, finite: f.positions.every(Number.isFinite), z: f.positions[2], ids: [...f.vertexIds] }));
      return { translated, checkpoints, state, maxJump, maxStepVelocityError, sourceIds, cut };
    } finally { owner.dispose(); }
  });
  for (const sample of result.translated) assert.ok(Math.abs(sample.velocity + 0.15) < 0.03, JSON.stringify(sample));
  assert.ok(Math.abs(result.translated[0].velocity - result.translated[1].velocity) < 0.03);
  const visited = new Set(result.checkpoints.map((c) => c.stage));
  for (const stage of ["headwaters", "rapids", "lake", "valley", "lowlands", "estuary", "ocean"]) assert.ok(visited.has(stage), stage);
  assert.equal(result.state.laps, 1); assert.equal(result.state.windLevel, 1);
  assert.ok(result.maxJump < 0.05, `coordinate rebase jumped ${result.maxJump}m`);
  assert.ok(result.maxStepVelocityError < 0.05, `velocity discontinuity: ${result.maxStepVelocityError}`);
  assert.equal(new Set(result.sourceIds).size, 51);
  assert.equal(result.cut.length, 2);
  assert.ok(result.cut.every((f) => f.finite && f.z < -519 && f.z > -521));
  assert.deepEqual(errors, []);
  await writeFile(`output/web-game/journey-physics-${native ? "native" : "webgl2"}.json`, JSON.stringify(result, null, 2));
  console.log("Rapier connected-route travel, coordinate invariance, continuous rebasing, translated tearing/UVs and ocean loop passed");
} finally { await browser.close(); }
