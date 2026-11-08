import type { BufferGeometry } from "three/webgpu";
import type { Stem } from "./weber-penn.js";
export function buildBranchGeometry(stems: Stem[], options?: {
  tileWorldSize?: number; radialScale?: number; ringStride?: number;
}): BufferGeometry;
