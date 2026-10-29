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
  assert.ok(Math.abs(s.y - surface(s.x, s.z, s.time, defaults, s)) < 0.15);
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
      let minimum = Infinity,
        maxLateral = 0;
      for (let i = 0; i < 2400; i++) {
        step(s, { ...defaults, turbulence }, neutral, 1 / 120);
        maxLateral = Math.max(maxLateral, Math.abs(s.x));
        minimum = Math.min(
          minimum,
          Math.hypot(s.x - obstacle.x, s.z - obstacle.z),
        );
      }
      assert.ok(
        s.z < -15,
        `stagnation at ${x}, turbulence ${turbulence}: ${s.z}`,
      );
      assert.ok(maxLateral < 2.8, `excessive bank deflection ${maxLateral}`);
      assert.ok(minimum >= obstacle.r + 0.28 - 1e-8);
    }
});
test("directed ripple phase follows accumulated wind displacement", () => {
  const wind = {
    ...initial(),
    intensity: 1,
    windX: 0.8,
    windZ: -0.3,
    windOffsetX: 2,
    windOffsetZ: -1,
  };
  const dx = 0.8 * defaults.windStrength * 0.2,
    dz = -0.3 * defaults.windStrength * 0.2;
  const residual = (x, z, t, w) =>
    surface(x, z, t, defaults, w) -
    surface(x, z, t, defaults, { ...w, windX: 0, windZ: 0 });
  assert.ok(
    Math.abs(
      residual(0.7, -4, 2, wind) -
        residual(0.7 + dx, -4 + dz, 2.2, {
          ...wind,
          windOffsetX: 2 + dx,
          windOffsetZ: -1 + dz,
        }),
    ) < 1e-10,
  );
});
test("late-session wind changes preserve wave phase continuity", () => {
  const s = run(initial(), 600, 1 / 120, { x: 1, z: 0, raise: 1, lower: 0 });
  assert.ok(s.windOffsetX > 400, "wind displacement was not accumulated");
  assert.equal(
    surface(0.7, -4, s.time, defaults, s),
    surface(0.7, -4, s.time, defaults, { ...s, windX: -s.windX }),
    "instant direction flip rephased waves",
  );
  assert.ok(
    Math.abs(
      surface(0.7, -4, s.time, { ...defaults, windStrength: 0.79 }, s) -
        surface(0.7, -4, s.time, defaults, s),
    ) < 0.002,
    "small strength adjustment rephased waves",
  );
  for (const input of [
    { x: -1, z: 0, raise: 0, lower: 1 },
    { x: 0, z: 1, raise: 1, lower: 0 },
  ]) {
    const before = { ...s };
    const dt = 1 / 120;
    step(s, defaults, input, dt);
    assert.ok(
      Math.hypot(
        s.windOffsetX - before.windOffsetX,
        s.windOffsetZ - before.windOffsetZ,
      ) <=
        defaults.windStrength * dt + 1e-9,
    );
    for (const x of [-1, 0, 1])
      assert.ok(
        Math.abs(
          surface(x, -4, s.time, defaults, s) -
            surface(x, -4, before.time, defaults, before),
        ) < 0.01,
        "wave popped after wind changed",
      );
  }
  assert.equal(initial().windOffsetX, 0);
  assert.equal(initial().windOffsetZ, 0);
});

test("moving leaf generates localized ripples that fade at rest", () => {
  const s = initial();
  const moving = { ...s, vz: -1 };
  const sample = (x, z, state) => surface(x, z, 1, defaults, state);
  assert.ok(Math.abs(sample(0.6, 0, moving) - sample(0.6, 0, s)) > 0.001);
  assert.equal(sample(0, 0, moving), sample(0, 0, s));
  assert.equal(sample(4, 0, moving), sample(4, 0, s));
  assert.notEqual(
    sample(0.6, 0, moving),
    surface(0.6, 0, 1.2, defaults, moving),
  );
});

test("leaf travels beyond old invisible boundary and stops inside river end", () => {
  const s = initial();
  run(s, 40, 1 / 120);
  assert.ok(s.z < -35);
  run(s, 100, 1 / 120);
  assert.equal(s.z, -109.7);
  assert.equal(s.vz, 0);
});
