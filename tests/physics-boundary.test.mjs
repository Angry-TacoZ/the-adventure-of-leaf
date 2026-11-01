import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleEnvironment, FIXED_STEP } from "../src/physics-boundary.ts";
import { initial, defaults, surface, flowField } from "../src/simulation.ts";
test("environment sampling agrees with simulation and supplies a unit upward normal", () => {
  const s = { ...initial(), windX: 0.6, windZ: -0.8, intensity: 0.5 };
  const e = sampleEnvironment(1, -4, s, defaults);
  assert.equal(FIXED_STEP, 1 / 120);
  assert.equal(e.height, surface(1, -4, s.time, defaults, s));
  assert.deepEqual(e.current, flowField(1, -4, s.time, defaults));
  assert.ok(
    Math.abs(Math.hypot(e.normal.x, e.normal.y, e.normal.z) - 1) < 1e-12,
  );
  assert.ok(e.normal.y > 0);
  assert.equal(e.wind.x, 0.6 * 0.5 * defaults.windStrength);
});
