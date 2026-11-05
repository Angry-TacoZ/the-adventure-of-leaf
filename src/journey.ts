/** Authored route in metres. Environment sampling has no renderer or physics dependency. */
export const riverExtent = { start: 20, end: -570, stop: -569.7 };
export const headwatersExtent = { start: 20, end: -110 };
export const routeStages = [
  { id: "headwaters", name: "Mountain headwaters", start: 0 },
  { id: "rapids", name: "Rapids", start: 100 },
  { id: "lake", name: "Mountain lake", start: 190 },
  { id: "valley", name: "River valley", start: 270 },
  { id: "lowlands", name: "Lowlands", start: 370 },
  { id: "estuary", name: "Atlantic estuary", start: 430 },
  { id: "ocean", name: "Atlantic Ocean", start: 510 },
] as const;
export function smoothRange(value: number, start: number, end: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}
function interpolate(distance: number, keys: readonly (readonly [number, number])[]) {
  for (let i = 1; i < keys.length; i++)
    if (distance < keys[i][0]) {
      const [a, x] = keys[i - 1], [b, y] = keys[i];
      return x + (y - x) * smoothRange(distance, a, b);
    }
  return keys.at(-1)![1];
}
const levelKeys = [[100, 0], [190, -1.7], [270, -1.7], [370, -2.6], [430, -3], [570, -3]] as const;
const widthKeys = [[100, 3.7], [145, 3.2], [185, 3.7], [230, 12], [270, 12], [310, 6], [370, 6], [420, 9], [480, 40], [550, 140]] as const;
const depthKeys = [[100, 0.41], [190, 0.55], [230, 1.3], [270, 1.3], [320, 0.7], [430, 0.7], [550, 2.5]] as const;
export const waterLevel = (z: number) => interpolate(-z, levelKeys);
export const waterSlope = (z: number) => (waterLevel(z + 0.1) - waterLevel(z - 0.1)) / 0.2;
/** The first bank column remains at the historical 3.7 m through the headwaters. */
export const channelHalfWidth = (z: number) => interpolate(-z, widthKeys);
export const waterHalfWidth = (z: number) => channelHalfWidth(z) + 2.1;
export const bedHalfWidth = (z: number) => channelHalfWidth(z) + 0.7;
export const bedDepth = (z: number) => interpolate(-z, depthKeys);
export const hillScale = (z: number) => 1 - 0.94 * smoothRange(-z, 270, 520);
export const rapidsStrength = (z: number) => smoothRange(-z, 100, 120) * (1 - smoothRange(-z, 172, 190));
export const stormStrength = (z: number) => smoothRange(-z, 275, 300) * (1 - smoothRange(-z, 345, 370));
export const currentScale = (z: number) => 1 + rapidsStrength(z) * 0.85
  - smoothRange(-z, 190, 210) * (1 - smoothRange(-z, 250, 275)) * 0.35;
export function journeyAt(z: number) {
  const distance = Math.max(0, -z);
  let stage: (typeof routeStages)[number] = routeStages[0];
  for (const candidate of routeStages) if (distance >= candidate.start) stage = candidate;
  return { ...stage, distance, progress: Math.min(1, distance / 510),
    waterLevel: waterLevel(z), halfWidth: channelHalfWidth(z),
    rapids: rapidsStrength(z), storm: stormStrength(z), ocean: stage.id === "ocean" };
}
