import test from "node:test";
import assert from "node:assert/strict";
import { createGrindMeter } from "../src/leaf-integrity.ts";

test("grind meter tears after sustained contact and forgives taps", () => {
  const meter = createGrindMeter(0.6, 0.15);
  for (let i = 0; i < 30; i++) assert.equal(meter.sample(0, 1 / 120), false);
  for (let i = 0; i < 600; i++) meter.sample(10, 1 / 120);
  assert.equal(meter.fraction(), 0);
  let fires = 0;
  for (let i = 0; i < 72; i++) if (meter.sample(0, 1 / 120)) fires++;
  assert.equal(fires, 1);
  assert.equal(meter.sample(0, 1 / 120), true);
  assert.equal(meter.fraction(), 1);
  meter.reset();
  assert.equal(meter.fraction(), 0);
  assert.equal(meter.sample(0, 1 / 120), false);
  meter.reset();
  for (let i = 0; i < 71; i++) assert.equal(meter.sample(-0.2, 1 / 120), false);
  assert.equal(meter.sample(-0.2, 1 / 120), true);
});

test("grind meter ignores non-positive dt and degrades budget 0 sanely", () => {
  const meter = createGrindMeter(0.6, 0.15);
  assert.equal(meter.sample(0, 0), false);
  assert.equal(meter.sample(0, -1 / 120), false);
  assert.equal(meter.fraction(), 0);
  for (let i = 0; i < 30; i++) meter.sample(0, 1 / 120);
  const filled = meter.fraction();
  assert.ok(filled > 0);
  assert.equal(meter.sample(0, 0), false);
  assert.equal(meter.fraction(), filled);
  const zero = createGrindMeter(0, 0.15);
  assert.equal(zero.sample(0, 1 / 120), true);
  assert.equal(zero.sample(10, 1 / 120), false);
  assert.ok(Number.isFinite(zero.fraction()));
});
