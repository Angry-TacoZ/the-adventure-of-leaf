import * as THREE from "three/webgpu";
import { generateSkeleton } from "./vendor/seedthree/weber-penn.js";
import { buildBranchGeometry } from "./vendor/seedthree/branch-mesh.js";
import { Rng } from "./vendor/seedthree/rng.js";

/** Project-owned yellow-birch interpretation; no editor, DOM or physics owner. */
export function createBirchGeometry(seed: string) {
  const rng = new Rng(seed);
  const { stems } = generateSkeleton({
    scale: 12, scaleV: 1.2, levels: 3, ratio: 0.018, ratioPower: 1.3,
    baseSize: 0.3, shape: 1, flare: 0.45, attractionUp: 0.22,
    branches: [0, 18, 10, 0], length: [1, 0.4, 0.25, 0.1],
    lengthV: [0, 0.08, 0.05, 0], curveRes: [10, 5, 3, 2],
    radialSegments: [8, 5, 3, 3], downAngle: [0, 60, 50, 45],
    curveV: [8, 28, 34, 0],
  }, rng);
  const wood = buildBranchGeometry(stems, { radialScale: 0.7, tileWorldSize: 1.4 });
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [],
    colors: number[] = [], winds: number[] = [], indices: number[][] = [[], []];
  const blade = [[0, 0], [-0.34, 0.28], [-0.39, 0.61], [0, 1], [0.39, 0.61], [0.34, 0.28]];
  const offset = new THREE.Vector3(), point = new THREE.Vector3(), normal = new THREE.Vector3();
  const orientation = new THREE.Quaternion(), turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), across = new THREE.Vector3(1, 0, 0);
  const color = new THREE.Color();
  for (const stem of stems.filter((s) => s.level === s.maxLevel)) {
    for (let leaf = 0; leaf < 14; leaf++) {
      const t = rng.range(0.15, 0.98) * (stem.points.length - 1);
      const i = Math.floor(t), blend = t - i;
      point.copy(stem.points[i]).lerp(stem.points[i + 1], blend);
      orientation.copy(stem.orients[i]);
      orientation.multiply(turn.setFromAxisAngle(up, leaf * 2.399 + stem.id));
      orientation.multiply(turn.setFromAxisAngle(across, rng.range(0.8, 1.9)));
      const length = rng.range(0.14, 0.24);
      const base = positions.length / 3;
      color.setHSL(rng.range(0.16, 0.26), rng.range(0.4, 0.6), rng.range(0.24, 0.38));
      normal.set(0, 0, 1).applyQuaternion(orientation);
      // Convex blade plus centre: actual leaf silhouettes, not opaque square cards.
      for (const [x, y] of [...blade, [0, 0.45]]) {
        offset.set(x * length, y * length, 0.012 * Math.sin(y * Math.PI));
        offset.applyQuaternion(orientation).add(point);
        positions.push(offset.x, offset.y, offset.z);
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(x + 0.5, y);
        colors.push(color.r, color.g, color.b);
        winds.push(stem.winds[i] * (1 - blend) + stem.winds[i + 1] * blend);
      }
      // First index tier contains alternating blades across every twig. Low
      // quality can halve leaf detail without removing one side of the crown.
      for (let edge = 0; edge < 6; edge++) indices[leaf % 2].push(base + 6, base + (edge + 1) % 6, base + edge);
    }
  }
  const foliage = new THREE.BufferGeometry();
  for (const [name, data, size] of [
    ["position", positions, 3], ["normal", normals, 3], ["uv", uvs, 2],
    ["color", colors, 3], ["aWind", winds, 1],
  ] as const) foliage.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
  foliage.setIndex([...indices[0], ...indices[1]]);
  foliage.computeBoundingSphere();
  // Both geometries sway in the same local frame, continuous at branch forks.
  wood.deleteAttribute("aStemCenter");
  return { wood, foliage };
}
