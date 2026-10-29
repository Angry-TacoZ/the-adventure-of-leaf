import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  initial,
  step,
  surface,
  obstacle,
} from "../src/simulation.ts";
const neutral = { x: 0, z: 0, raise: 0, lower: 0 };
function run(s, seconds, dt, input = neutral) {
  for (let t = 0; t < seconds - 1e-9; t += dt) step(s, defaults, input, dt);
  return s;
}
test("current carries the leaf downstream and it remains near the surface", () => {
  const s = run(initial(), 4, 1 / 120);
  assert.ok(s.z < -2);
  assert.ok(
    Math.abs(s.y - surface(s.x, s.z, s.time, defaults, s.intensity)) < 0.15,
  );
});
test("wind changes motion and trigger intensity returns to natural conditions", () => {
  const s = run(initial(), 2, 1 / 120, { x: 1, z: 0, raise: 1, lower: 0 });
  assert.ok(s.x > 0.2 && s.intensity > 0.9);
  const before = s.intensity;
  run(s, 2, 1 / 120);
  assert.ok(s.intensity < before);
});
test("obstacle rejects penetration", () => {
  const s = initial();
  s.x = obstacle.x;
  s.z = obstacle.z + obstacle.r + 0.29;
  s.vz = -2;
  step(s, defaults, neutral, 1 / 120);
  assert.ok(
    Math.hypot(s.x - obstacle.x, s.z - obstacle.z) >= obstacle.r + 0.28 - 1e-9,
  );
  assert.ok(s.collision);
});
test("simulation is stable across frame step sizes", () => {
  const a = run(initial(), 3, 1 / 60),
    b = run(initial(), 3, 1 / 120);
  assert.ok(Math.abs(a.z - b.z) < 0.05);
  assert.ok(Math.abs(a.y - b.y) < 0.02);
});

test("zero-wind current carries multiple approaches past the rock without penetration", () => {
  for (const x of [-0.5, 0, 0.25, 0.4, 0.8])
    for (const turbulence of [0, defaults.turbulence]) {
      const s = initial();
      s.x = x;
      let minimum = Infinity;
      for (let i = 0; i < 2400; i++) {
        step(s, { ...defaults, turbulence }, neutral, 1 / 120);
        minimum = Math.min(
          minimum,
          Math.hypot(s.x - obstacle.x, s.z - obstacle.z),
        );
      }
      assert.ok(
        s.z < -15,
        `stagnation at ${x}, turbulence ${turbulence}: ${s.z}`,
      );
      assert.ok(minimum >= obstacle.r + 0.28 - 1e-8);
    }
});
test("wind direction changes the shared surface while neutral direction removes directed ripples", () => {
  const left = surface(0.7, -4, 2, defaults, 1, -1, 0),
    right = surface(0.7, -4, 2, defaults, 1, 1, 0);
  assert.ok(Math.abs(left - right) > 0.005);
  assert.equal(
    surface(0.7, -4, 2, defaults, 0, -1, 0),
    surface(0.7, -4, 2, defaults, 0, 1, 0),
  );
});

test("directed ripple phase advects with the wind vector", () => {
  const x = 0.7,
    z = -4,
    t = 2,
    dt = 0.2,
    wx = 0.8,
    wz = -0.3;
  const residual = (x, z, t) =>
    surface(x, z, t, defaults, 1, wx, wz) - surface(x, z, t, defaults, 1, 0, 0);
  assert.ok(
    Math.abs(
      residual(x, z, t) -
        residual(
          x + wx * defaults.windStrength * dt,
          z + wz * defaults.windStrength * dt,
          t + dt,
        ),
    ) < 1e-10,
  );
});
