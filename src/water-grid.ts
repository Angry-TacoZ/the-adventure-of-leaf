import * as THREE from "three/webgpu";
import { waterHalfWidth, waterLevel, rapidsStrength } from "./journey.ts";

/** One constant-size water grid follows the viewer, including a wide ocean horizon. */
export function createWaterGrid() {
  const columns = 70, rows = 480, length = 140;
  const detailHalfWidth = waterHalfWidth(0);
  const geometry = new THREE.PlaneGeometry(detailHalfWidth * 2, length, columns, rows);
  const foam = new Float32Array((columns + 1) * (rows + 1));
  geometry.setAttribute("aFoam", new THREE.BufferAttribute(foam, 1));
  const levels = new Float32Array(rows + 1), rapids = new Float32Array(rows + 1);
  let cellZ = Infinity, cellX = Infinity;
  function layout(x: number, z: number) {
    const nextZ = Math.floor(z / 4) * 4, nextX = Math.round(x);
    if (cellZ === nextZ && cellX === nextX) return;
    cellZ = nextZ; cellX = nextX;
    const positions = geometry.attributes.position;
    for (let row = 0; row <= rows; row++) {
      // PlaneGeometry row order must retain its upward winding after rotation.
      const worldZ = cellZ - 112 + row / rows * length;
      const half = waterHalfWidth(worldZ), centre = THREE.MathUtils.clamp(cellX, Math.min(0, -half + detailHalfWidth), Math.max(0, half - detailHalfWidth));
      levels[row] = waterLevel(worldZ); rapids[row] = rapidsStrength(worldZ);
      // Concentrate detail around the leaf; distant ocean edges need fewer samples.
      const curvature = Math.max(0, Math.log(Math.max(1, half / detailHalfWidth)) * 1.65);
      const divisor = curvature > 0.001 ? Math.sinh(curvature) : 1;
      for (let col = 0; col <= columns; col++) {
        const u = col / columns * 2 - 1;
        const w = curvature > 0.001 ? Math.sinh(u * curvature) / divisor : u;
        const worldX = centre + w * (w < 0 ? half + centre : half - centre);
        const i = row * (columns + 1) + col;
        positions.setX(i, worldX); positions.setY(i, -worldZ);
      }
    }
  }
  layout(0, 0);
  // Layout/deformation changes world bounds; fixed static bounds would cull downstream water.
  return { geometry, foam, levels, rapids, columns, rows, length, layout,
    diagnostics: () => ({ vertices: foam.length, length, centreZ: cellZ, centreX: cellX }) };
}
