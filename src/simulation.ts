export type Params = {
  current: number;
  variation: number;
  windStrength: number;
  windResponse: number;
  drag: number;
  buoyancy: number;
  alignment: number;
  turbulence: number;
  ripple: number;
  damping: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraAngle: number;
  cameraSmoothing: number;
  quality: number;
  deadzone: number;
  windCurve: number;
};
export const defaults: Params = {
  current: 1.15,
  variation: 0.22,
  windStrength: 0.8,
  windResponse: 1.5,
  drag: 1.8,
  buoyancy: 8,
  alignment: 4,
  turbulence: 0.12,
  ripple: 0.11,
  damping: 0.7,
  cameraDistance: 0.65,
  cameraHeight: 0.22,
  cameraAngle: 0.12,
  cameraSmoothing: 3,
  quality: 1,
  deadzone: 0.16,
  windCurve: 1,
};
export type State = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  windX: number;
  windZ: number;
  intensity: number;
  windLevel: number;
  raisePressed: boolean;
  lowerPressed: boolean;
  windOffsetX: number;
  windOffsetZ: number;
  time: number;
  collision: boolean;
};
export const initial = (): State => ({
  x: 0,
  y: 0.1,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  windX: 0,
  windZ: 0,
  intensity: 0,
  windLevel: 0,
  raisePressed: false,
  lowerPressed: false,
  windOffsetX: 0,
  windOffsetZ: 0,
  time: 0,
  collision: false,
});
export const river = { start: 20, end: -110, stop: -109.7 };
export const obstacle = { x: 0.25, z: -9, r: 1.05 };
export function surface(
  x: number,
  z: number,
  t: number,
  p: Params,
  wind: Pick<
    State,
    | "intensity"
    | "windX"
    | "windZ"
    | "windOffsetX"
    | "windOffsetZ"
    | "x"
    | "z"
    | "vx"
    | "vz"
  >,
) {
  const { intensity, windX, windZ, windOffsetX, windOffsetZ } = wind;
  const a = p.ripple * (1 + intensity * 0.55);
  const waves =
    a *
    (Math.sin(z * 1.5 + t * 2.1 + x * 0.5) * 0.55 +
      Math.sin(x * 2.2 - z * 0.6 + t * 1.3) * 0.3 +
      Math.sin(z * 3.1 + x * 1.3 + t * 3) * 0.15) *
    p.damping;
  const distance = Math.hypot(x - obstacle.x, z - obstacle.z);
  const eddy =
    p.turbulence *
    0.12 *
    Math.sin(distance * 5 - t * 3) *
    Math.exp(-Math.max(0, distance - obstacle.r) * 1.8); // Advect two crossing ripple components by the same effective wind used by the leaf.
  const wx = windX * p.windStrength * intensity,
    wz = windZ * p.windStrength * intensity;
  const agitation = Math.min(1, Math.hypot(wx, wz));
  const windWaves =
    p.ripple *
    p.damping *
    agitation *
    0.5 *
    (Math.sin(2.4 * x + 1.2 * z - (2.4 * windOffsetX + 1.2 * windOffsetZ)) +
      0.5 *
        Math.sin(
          -1.1 * x + 2.8 * z - (-1.1 * windOffsetX + 2.8 * windOffsetZ),
        ));
  // A bounded expanding ripple follows the moving leaf and vanishes at rest.
  const dx = x - wind.x,
    dz = z - wind.z;
  let leafRipple = 0;
  if (Math.abs(dx) < 2.5 && Math.abs(dz) < 2.5) {
    const r = Math.hypot(dx, dz);
    const strength = Math.min(1, Math.hypot(wind.vx, wind.vz));
    leafRipple =
      p.ripple *
      p.damping *
      1.8 *
      strength *
      Math.sin(r * 9 - t * 5) *
      Math.exp(-r * 1.2) *
      (1 - Math.exp(-r * 8));
  }
  return waves + eddy + windWaves + leafRipple;
}
export function current(x: number, z: number, t: number, p: Params) {
  return Math.max(
    0.15,
    p.current *
      (1 +
        p.variation * Math.sin(z * 0.31 + t * 0.37) +
        p.turbulence * 0.25 * Math.sin(x * 3 + t)),
  );
}
// A local steering field approximates water splitting upstream and rejoining downstream.
// The slight asymmetric split avoids an exact centreline stagnation point.
export function flowField(x: number, z: number, t: number, p: Params) {
  const dx = x - obstacle.x,
    dz = z - obstacle.z;
  const speed = current(x, z, t, p);
  const approach =
    Math.exp(-(((dz - 1.8) / 2.4) ** 2)) * Math.exp(-((dx / 1.7) ** 2));
  const split = Math.tanh((dx - 0.15) * 3);
  const wake = Math.exp(-(((dz + 2) / 2.5) ** 2)) * Math.exp(-((dx / 2) ** 2));
  const lateral =
    speed * 0.85 * approach * split +
    p.turbulence * 0.35 * wake * Math.sin(t * 1.4 - dz * 2);
  return { x: lateral, z: -speed * (1 - 0.35 * approach) };
}
export function step(
  s: State,
  p: Params,
  input: { x: number; z: number; raise: number; lower: number },
  dt: number,
) {
  s.time += dt;
  const k = 1 - Math.exp(-p.windResponse * dt);
  const magnitude = Math.min(1, Math.hypot(input.x, input.z));
  // Hysteresis prevents analog trigger jitter from creating extra presses.
  const raising = s.raisePressed ? input.raise > 0.4 : input.raise >= 0.6;
  const lowering = s.lowerPressed ? input.lower > 0.4 : input.lower >= 0.6;
  const up = raising && !s.raisePressed;
  const down = lowering && !s.lowerPressed;
  if (up !== down)
    s.windLevel = Math.max(0, Math.min(4, s.windLevel + (up ? 1 : -1)));
  s.raisePressed = raising;
  s.lowerPressed = lowering;
  s.intensity += (s.windLevel / 4 - s.intensity) * k;
  s.windX += (input.x * (magnitude ? 1 : 0) - s.windX) * k;
  s.windZ += (input.z * (magnitude ? 1 : 0) - s.windZ) * k;
  // Integrate velocity rather than recomputing phase from total session time.
  // Reversing or changing wind cannot teleport an existing ripple pattern.
  s.windOffsetX += s.windX * p.windStrength * s.intensity * dt;
  s.windOffsetZ += s.windZ * p.windStrength * s.intensity * dt;
  const flow = flowField(s.x, s.z, s.time, p);
  const wind = p.windStrength * s.intensity;
  const targetX = flow.x + s.windX * wind;
  const targetZ = Math.min(-0.15, flow.z + s.windZ * wind);
  const drag = 1 - Math.exp(-p.drag * dt);
  s.vx += (targetX - s.vx) * drag;
  s.vz += (targetZ - s.vz) * drag;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  s.x = Math.max(-3.65, Math.min(3.65, s.x));
  if (Math.abs(s.x) >= 3.65) s.vx *= 0.1;
  s.collision = false;
  const dx = s.x - obstacle.x,
    dz = s.z - obstacle.z,
    dist = Math.hypot(dx, dz);
  if (dist < obstacle.r + 0.28) {
    const nx = dist ? dx / dist : 1,
      nz = dist ? dz / dist : 0;
    s.x = obstacle.x + nx * (obstacle.r + 0.28);
    s.z = obstacle.z + nz * (obstacle.r + 0.28);
    const dot = s.vx * nx + s.vz * nz;
    if (dot < 0) {
      s.vx -= dot * nx * 1.15;
      s.vz -= dot * nz * 1.15;
    }
    s.collision = true;
  }
  if (s.z < river.stop) {
    s.z = river.stop;
    s.vz = 0;
  }
  const targetY = surface(s.x, s.z, s.time, p, s) + 0.05;
  s.vy += (targetY - s.y) * p.buoyancy * dt;
  s.vy *= Math.exp(-3 * dt);
  s.y += s.vy * dt;
}
