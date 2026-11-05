import test from "node:test";
import assert from "node:assert/strict";
import { weatherAt } from "../src/weather.ts";

test("weather is bounded, deterministic and confined to the authored valley", () => {
  for (const z of [0, -140, -230, -400, -530]) assert.deepEqual(weatherAt(z, 200), { strength: 0, rain: 0, gustX: 0, gustZ: 0 });
  for (let t = 0; t < 1200; t += .13) {
    const w = weatherAt(-320, t);
    assert.equal(w.strength, 1); assert.ok(Math.abs(w.gustX) <= .18); assert.ok(Math.abs(w.gustZ) <= .08);
    assert.deepEqual(w, weatherAt(-320, t));
  }
  for (const edge of [-275, -300, -345, -370]) {
    assert.ok(Math.abs(weatherAt(edge, 100).gustX - weatherAt(edge + .001, 100).gustX) < .001);
  }
});
