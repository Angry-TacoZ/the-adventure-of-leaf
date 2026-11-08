/**
 * Sustained rock contact builds grind toward a tear. Pure logic, no engine.
 * `gap` is metres from the nearest leaf particle to the rock surface
 * (negative overlaps). Non-positive steps never move the meter. A zero
 * budget means zero contact tolerance: any touching sample fires. Firing
 * does not reset the meter; the caller resets only after a successful cut,
 * so a missed cut keeps the meter full and is retried instead of silently
 * restarting. Clear water drains the meter twice as fast as contact fills
 * it, so taps never accumulate across the route.
 */
export function createGrindMeter(budget: number, margin: number) {
  let grind = 0;
  return {
    fraction: () => (budget > 0 ? Math.min(1, grind / budget) : 0),
    reset() {
      grind = 0;
    },
    sample(gap: number, dt: number) {
      if (dt > 0) {
        if (gap < margin) grind += dt;
        else grind = Math.max(0, grind - 2 * dt);
        if (budget > 0) grind = Math.min(budget, grind);
      }
      if (budget <= 0) return gap < margin;
      return grind >= budget;
    },
  };
}
