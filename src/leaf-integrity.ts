/** Supply rest-space positions so stretch does not change material area. */
export function triangleArea(positions: ArrayLike<number>, indices: ArrayLike<number>) {
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const x = positions[b] - positions[a], y = positions[b + 1] - positions[a + 1], z = positions[b + 2] - positions[a + 2];
    const u = positions[c] - positions[a], v = positions[c + 1] - positions[a + 1], w = positions[c + 2] - positions[a + 2];
    area += Math.hypot(y * w - z * v, z * u - x * w, x * v - y * u) / 2;
  }
  return area;
}

export function retainedFraction(areas: readonly number[], originalArea: number) {
  return originalArea > 0 ? Math.min(1, Math.max(0, ...areas) / originalArea) : 0;
}

export const shouldEndAdventure = (fraction: number) => fraction < 0.25;
