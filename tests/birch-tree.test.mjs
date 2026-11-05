import test from "node:test";
import assert from "node:assert/strict";
import { createBirchGeometry } from "../src/birch-tree.ts";

test("birch variants have reproducible, finite branch/leaf geometry and rooted trunks", () => {
  const first = createBirchGeometry("yellow-birch-0");
  const repeated = createBirchGeometry("yellow-birch-0");
  const other = createBirchGeometry("yellow-birch-1");
  try {
    for (const geometry of [first.wood, first.foliage]) {
      const positions = geometry.getAttribute("position");
      assert.ok(positions.count > 1000);
      assert.ok([...positions.array].every(Number.isFinite));
      assert.ok([...geometry.index.array].every((index) => index < positions.count));
      assert.equal(geometry.getAttribute("aWind").count, positions.count);
      geometry.computeBoundingBox();
      assert.ok(geometry.boundingBox.max.y > 8);
    }
    assert.ok(Math.abs(first.wood.boundingBox.min.y) < 0.05, "trunk floats above its origin");
    for (const part of ["wood", "foliage"]) {
      assert.deepEqual(first[part].getAttribute("position").array, repeated[part].getAttribute("position").array);
      assert.notDeepEqual(first[part].getAttribute("position").array, other[part].getAttribute("position").array);
    }
  } finally {
    for (const tree of [first, repeated, other]) { tree.wood.dispose(); tree.foliage.dispose(); }
  }
});
