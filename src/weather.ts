import { stormStrength } from "./journey.ts";

/** Authored valley weather, sampled on the existing simulation clock. */
export function weatherAt(z: number, time: number) {
  const strength = stormStrength(z);
  if (strength === 0) return { strength: 0, rain: 0, gustX: 0, gustZ: 0 };
  return {
    strength,
    rain: strength,
    gustX: strength * (0.12 * Math.sin(time * 0.83) + 0.06 * Math.sin(time * 2.17)),
    gustZ: strength * (0.08 * Math.sin(time * 0.61 + 1.4)),
  };
}
