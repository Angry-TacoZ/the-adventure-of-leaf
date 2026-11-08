import type { Vector3, Quaternion } from "three/webgpu";
import type { Rng } from "./rng.js";
export interface Stem {
  level: number;
  maxLevel: number;
  points: Vector3[];
  orients: Quaternion[];
  radii: number[];
  winds: number[];
  length: number;
  radialSegments: number;
  id: number;
  parentId: number;
}
export function generateSkeleton(params: Record<string, unknown>, rng: Rng): {
  stems: Stem[];
  tips: { position: Vector3; orient: Quaternion; length: number }[];
};
