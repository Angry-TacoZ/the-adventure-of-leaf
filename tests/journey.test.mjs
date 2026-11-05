import test from "node:test";
import assert from "node:assert/strict";
import { journeyAt, channelHalfWidth, waterLevel, bedDepth, riverExtent } from "../src/journey.ts";
import { createBedData } from "../src/bank-terrain.ts";
import { surface, initial, defaults } from "../src/simulation.ts";

test("the connected route reaches the Atlantic with continuous terrain and water", () => {
  assert.equal(journeyAt(0).id, "headwaters");
  assert.equal(journeyAt(-140).id, "rapids");
  assert.equal(journeyAt(-230).id, "lake");
  assert.equal(journeyAt(-320).id, "valley");
  assert.equal(journeyAt(-400).id, "lowlands");
  assert.equal(journeyAt(-470).id, "estuary");
  assert.equal(journeyAt(-530).id, "ocean");
  assert.ok(channelHalfWidth(-530) > 100);
  assert.equal(journeyAt(-530).progress, 1);
  for (let z = riverExtent.end; z < riverExtent.start; z += 0.25) {
    assert.ok(Math.abs(waterLevel(z + 0.001) - waterLevel(z)) < 0.001);
    assert.ok(Math.abs(channelHalfWidth(z + 0.001) - channelHalfWidth(z)) < 0.01);
    assert.ok(bedDepth(z) > 0.3);
    assert.ok(Math.abs(surface(0, z, 0, defaults, initial()) - waterLevel(z)) < 0.5);
  }
  const bed = createBedData();
  assert.ok(bed.positions.every(Number.isFinite));
  for (let i = 0; i < bed.positions.length; i += 3)
    assert.ok(Math.abs(bed.positions[i + 1] - (waterLevel(bed.positions[i + 2]) - bedDepth(bed.positions[i + 2]))) < 1e-5);
  for (let i = 0; i < bed.indices.length; i += 3) {
    const a = bed.indices[i] * 3, b = bed.indices[i + 1] * 3, c = bed.indices[i + 2] * 3;
    assert.ok((bed.positions[b + 2] - bed.positions[a + 2]) * (bed.positions[c] - bed.positions[a]) -
      (bed.positions[b] - bed.positions[a]) * (bed.positions[c + 2] - bed.positions[a + 2]) > 0);
  }
});
