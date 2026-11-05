import test from "node:test";
import assert from "node:assert/strict";
import { lightningAt } from "../src/lightning.ts";
test("distant lightning has bounded pulses, quiet gaps and delayed thunder", () => {
  for (let t = 0; t < 600; t += .013) {
    const v = lightningAt(t, 1);
    assert.ok(v.flash >= 0 && v.flash <= 1);
    assert.equal(lightningAt(t, 0).flash, 0);
    assert.ok(v.thunderTime > v.cycle * 19 + 3.24);
    if (t % 19 > 3.24 || t % 19 < 3) assert.equal(v.flash, 0);
  }
  assert.ok(lightningAt(3.08, 1).flash > .1);
});

import { createStormTimeline } from "../src/lightning.ts";
test("fixed-step thunder follows an observed flash once, clears on reset and leaving storm", () => {
  const timeline = createStormTimeline(); let thunder = 0;
  for (let i = 0; i < 120 * 60; i++) thunder += Number(timeline.step(i / 120, 1).thunder);
  assert.equal(thunder, 3);
  assert.equal(timeline.step(4.3, 1).thunder, false);
  timeline.step(3.1, 1); timeline.step(3.2, 0);
  assert.equal(timeline.step(4.3, 1).thunder, false);
  timeline.step(22.1, 1);
  assert.equal(timeline.step(23.3, 1).thunder, true);
  assert.equal(timeline.step(23.3, 1).thunder, false);
});
