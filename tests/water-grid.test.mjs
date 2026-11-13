import test from "node:test";
import assert from "node:assert/strict";
import { createWaterGrid } from "../src/water-grid.ts";

test("streamed water retains constant allocation, upward winding and near-leaf detail", () => {
  const grid = createWaterGrid(), positions = grid.geometry.attributes.position;
  const count = positions.count, allocation = positions.array;
  try {
    for (const [x, z] of [[0, 0], [2.7, -140], [15, -230], [0, -470], [45, -530], [0, 0]]) {
      grid.layout(x, z); grid.geometry.computeVertexNormals();
      assert.equal(positions.count, count); assert.equal(positions.array, allocation);
      assert.ok(positions.array.every(Number.isFinite));
      const normals = grid.geometry.attributes.normal;
      for (let i = 0; i < normals.count; i++) assert.ok(normals.getZ(i) > 0.99, "water wound below its viewer");
      const row = Math.round(grid.rows * 0.7), middle = row * (grid.columns + 1) + grid.columns / 2;
      assert.ok(positions.getX(middle + 1) - positions.getX(middle) < 0.7, "ocean lost near-leaf wave detail");
      assert.ok(-positions.getY(row * (grid.columns + 1)) < z + 30);
    }
    assert.equal(grid.foam.length, count);
  } finally { grid.geometry.dispose(); }
});
