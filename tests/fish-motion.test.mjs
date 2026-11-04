import test from "node:test";
import assert from "node:assert/strict";
import { FISH_COUNT, sampleFish } from "../src/fish-motion.ts";
import { initial, defaults, obstacles } from "../src/simulation.ts";

test("brook-trout paths remain within the river and clear the rock silhouettes", () => {
  const state = initial();
  for (let time = 0; time <= 600; time += 0.5) {
    state.time = time;
    for (let id = 0; id < FISH_COUNT; id++) {
      const { position: p, orientation: q } = sampleFish(id, state, defaults);
      assert.ok([p.x, p.y, p.z, q.y, q.w].every(Number.isFinite));
      assert.ok(Math.abs(p.x) < 3.1 && p.y >= -0.32 && p.y < 0.2);
      assert.ok(Math.abs(Math.hypot(q.y, q.w) - 1) < 1e-10);
      for (const rock of obstacles)
        assert.ok(Math.hypot(p.x - rock.x, p.z - rock.z) > rock.r + 0.28, `fish ${id} intersects a rock at ${time}`);
    }
  }
});
