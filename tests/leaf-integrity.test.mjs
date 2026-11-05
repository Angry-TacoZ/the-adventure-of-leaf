import test from "node:test";
import assert from "node:assert/strict";
import { triangleArea, retainedFraction, shouldEndAdventure, createGrindMeter } from "../src/leaf-integrity.ts";

test("material-area loss uses the largest piece and the strict approved quarter boundary", () => {
  const square = [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1];
  const triangles = [0, 1, 2, 0, 2, 3];
  const original = triangleArea(square, triangles);
  assert.equal(original, 1);
  assert.equal(triangleArea(square.map((v, i) => v + [7, -4, 13][i % 3]), triangles), original);
  assert.equal(shouldEndAdventure(retainedFraction([0.25, 0.25, 0.25, 0.25], original)), false);
  assert.equal(shouldEndAdventure(retainedFraction([0.2, 0.2, 0.2, 0.2, 0.2], original)), true);
  assert.equal(shouldEndAdventure(retainedFraction([0.7, 0.1], original)), false);
  assert.equal(shouldEndAdventure(retainedFraction([], original)), true);
  // A copied boundary vertex does not add surface area.
  const copied = [...square, 0, 0, 0];
  assert.equal(triangleArea(copied, [4, 1, 2, 4, 2, 3]), original);
});

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
