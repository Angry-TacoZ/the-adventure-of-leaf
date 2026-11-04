import test from "node:test";
import assert from "node:assert/strict";
import { triangleArea, retainedFraction, shouldEndAdventure } from "../src/leaf-integrity.ts";

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
