/**
 * Sustained rock contact builds grind toward a tear. Pure logic, no engine.
 * `gap` is metres from the nearest leaf particle to the rock surface
 * (negative overlaps). Non-positive steps never move the meter. A zero
 * budget means zero contact tolerance: any touching sample fires. Firing
 * does not reset the meter; the caller resets only after a successful cut,
 * so a missed cut keeps the meter full and is retried instead of silently
 * restarting. Clear water drains the meter twice as fast as contact fills
 * it, so taps never accumulate across the route. A rejected cut calls
 * noteMiss, which freezes the meter for a short cooldown so a persistently
 * missing cut cannot retry at full step rate.
 */
export function createGrindMeter(budget: number, margin: number, missCooldownSteps = 30) {
  let grind = 0,
    cooldown = 0;
  return {
    fraction: () => (budget > 0 ? Math.min(1, grind / budget) : 0),
    reset() {
      grind = 0;
      cooldown = 0;
    },
    noteMiss() {
      cooldown = missCooldownSteps;
    },
    sample(gap: number, dt: number) {
      if (cooldown > 0) {
        cooldown--;
        return false;
      }
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
