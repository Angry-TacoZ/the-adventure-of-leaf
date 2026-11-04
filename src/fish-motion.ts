import { surface, type State, type Params } from "./simulation.ts";
import type { Vector3Data } from "./physics-boundary";

export const FISH_COUNT = 6;
export interface FishFrame {
  id: number;
  position: Vector3Data;
  orientation: Vector3Data & { w: number };
}
/** Bounded holding/swimming paths, shared by the Rapier fish owner. */
export function sampleFish(index: number, state: State, params: Params) {
  const phase = state.time * 0.55 + index * 1.7;
  // The school beside the central rock holds to its clear right-hand channel.
  const x = (index === 3 ? 2.5 : index % 2 ? 1.4 : -1.4) + 0.45 * Math.sin(phase);
  const z = 1.3 - index * 3.4 + 0.6 * Math.cos(phase * 0.8);
  const depth = 0.14 - 0.07 * Math.max(0, Math.sin(phase * 0.6 + index)) ** 6;
  const y = Math.max(-0.32, surface(x, z, state.time, params, state) - depth);
  const heading = Math.atan2(0.45 * Math.cos(phase), -0.48 * Math.sin(phase * 0.8));
  return { position: { x, y, z }, orientation: { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) } };
}
