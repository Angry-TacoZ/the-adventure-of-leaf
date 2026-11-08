import { river } from "./simulation.ts";

export const WATER_WIDTH = 11.6;
export const BED_WIDTH = 8.8;
const distances = [3.7, 4.3, 4.8, 5.5, 6.5, 8, 11, 15, 24, 40];
const heights = [-0.44, -0.19, -0.02, 0.2, 0.42, 0.7, 1.3, 2.2, 4.7, 8.5];
export function bankBend(z: number, side: number) {
  return 0.22 * Math.sin(z * 0.09 + side) + 0.12 * Math.sin(z * 0.17 - side);
}
/** Shared static terrain sampler for plant roots and scenery placement. */
export function bankHeight(x: number, z: number) {
  const side = x < 0 ? -1 : 1,
    d = Math.abs(x) - bankBend(z, side);
  let height = heights[0];
  for (let i = 1; i < distances.length; i++)
    if (d > distances[i - 1]) {
      const t = Math.max(
        0,
        Math.min(1, (d - distances[i - 1]) / (distances[i] - distances[i - 1])),
      );
      height = heights[i - 1] + (heights[i] - heights[i - 1]) * t;
    }
  return (
    height +
    Math.max(0, (d - 6.5) / 33.5) *
      (0.7 * Math.sin(z * 0.07 + side) + 0.5 * Math.sin(z * 0.14 - side))
  );
}
/** These same buffers are consumed by rendering and Rapier's bank colliders. */
export function createBankData(side: -1 | 1) {
  const rows = 131,
    columns = distances.length,
    positions = new Float32Array(rows * columns * 3),
    uvs = new Float32Array(rows * columns * 2),
    colors = new Float32Array(rows * columns * 3);
  const gravel: number[] = [],
    soil: number[] = [];
  for (let row = 0; row < rows; row++) {
    const z = river.start + ((river.end - river.start) * row) / (rows - 1);
    for (let col = 0; col < columns; col++) {
      const x = side * (distances[col] + bankBend(z, side)),
        i = row * columns + col;
      positions.set([x, bankHeight(x, z), z], i * 3);
      uvs.set([x / 2.2, z / 2.2], i * 2);
      const shade = 0.9 + 0.07 * Math.sin(z * 0.63 + x * 0.8);
      colors.set([shade, shade, shade], i * 3);
      if (row < rows - 1 && col < columns - 1) {
        const a = i,
          b = i + columns,
          c = i + 1,
          d = b + 1;
        const target = col < 4 ? gravel : soil;
        target.push(...(side === 1 ? [a, c, b, c, d, b] : [a, b, c, c, b, d]));
      }
    }
  }
  return {
    positions,
    uvs,
    colors,
    indices: new Uint32Array([...gravel, ...soil]),
    gravelIndexCount: gravel.length,
  };
}
