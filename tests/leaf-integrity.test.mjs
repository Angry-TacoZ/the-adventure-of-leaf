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
  assert.equal(meter.fraction(), 0);
  meter.reset();
  for (let i = 0; i < 71; i++) assert.equal(meter.sample(-0.2, 1 / 120), false);
  assert.equal(meter.sample(-0.2, 1 / 120), true);
});
