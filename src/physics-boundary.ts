import { weatherAt } from "./weather.ts";
import {
  surface,
  flowField,
  obstacles,
  type State,
  type Params,
} from "./simulation.ts";
export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}
export interface LeafPose {
  position: Vector3Data;
  /** Euler radians for the current rigid presentation. */
  rotation: Vector3Data;
  /** Optional world quaternion for future physics-driven pieces; overrides Euler rotation. */
  orientation?: Vector3Data & { w: number };
}
export interface LeafMeshData {
  id: string;
  /** World pose for this piece; essential when disconnected pieces rotate independently. */
  pose?: LeafPose;
  /** Increment when indices or vertex-to-particle mapping changes. */
  topologyRevision?: number;
  vertexIds?: Uint32Array;
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices?: Uint32Array;
}
/** A future physics step may replace topology and supply several connected fragments. */
export interface LeafFrame {
  pose: LeafPose;
  fragments?: readonly LeafMeshData[];
}
export const FIXED_STEP = 1 / 120;
export function sampleEnvironment(
  x: number,
  z: number,
  state: State,
  params: Params,
) {
  const weather = weatherAt(z, state.time);
  const height = surface(x, z, state.time, params, state);
  const epsilon = 0.15;
  const slopeX =
    (surface(x + epsilon, z, state.time, params, state) -
      surface(x - epsilon, z, state.time, params, state)) /
    (2 * epsilon);
  const slopeZ =
    (surface(x, z + epsilon, state.time, params, state) -
      surface(x, z - epsilon, state.time, params, state)) /
    (2 * epsilon);
  const length = Math.hypot(slopeX, 1, slopeZ);
  return {
    time: state.time,
    height,
    slopeX,
    slopeZ,
    normal: { x: -slopeX / length, y: 1 / length, z: -slopeZ / length },
    current: flowField(x, z, state.time, params),
    wind: {
      x: state.windX * state.intensity * params.windStrength + weather.gustX,
      z: state.windZ * state.intensity * params.windStrength + weather.gustZ,
    },
    obstacles: obstacles as readonly Readonly<(typeof obstacles)[number]>[],
  };
}
