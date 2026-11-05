/**
 * Sustained rock contact builds grind toward a tear. Pure logic, no engine.
 * `gap` is metres from the leaf edge to the rock surface (negative overlaps).
 * Returns true once per filled budget, then restarts. Drains at twice the
 * fill rate when clear so taps do not accumulate across the route.
 */
export function createGrindMeter(budget: number, margin: number) {
  let grind = 0;
  return {
    fraction: () => Math.min(1, grind / budget),
    reset() {
      grind = 0;
    },
    sample(gap: number, dt: number) {
      if (gap < margin) grind += dt;
      else grind = Math.max(0, grind - 2 * dt);
      if (grind >= budget) {
        grind = 0;
        return true;
      }
      return false;
    },
  };
}
