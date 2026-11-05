/** Distant storm illumination; no damage or separate clock. */
export function lightningAt(time: number, strength: number) {
  const cycle = Math.floor(time / 19);
  const age = time - cycle * 19 - 3;
  const flash = age >= 0 && age < .24 ? Math.sin(Math.PI * age / .24) * Math.exp(-age * 9) : 0;
  return { cycle, flash: flash * strength, thunderTime: cycle * 19 + 4.2 };
}

/** Fixed-step event latch prevents duplicate or unrelated thunder on redraw. */
export function createStormTimeline() {
  let last = -1, armed = -1;
  return {
    step(time: number, strength: number) {
      if (time < last) armed = -1;
      const event = lightningAt(time, strength);
      if (event.flash > 0 && strength > .3) armed = event.cycle;
      const thunder = armed === event.cycle && last < event.thunderTime && time >= event.thunderTime && strength > .3;
      if (thunder || strength <= .3) armed = -1;
      last = time;
      return { ...event, thunder };
    },
  };
}
