import type * as Rapier from "@dimforge/rapier3d";
import {
  FIXED_STEP,
  sampleEnvironment,
  type LeafFrame,
} from "./physics-boundary";
import { obstacles, river, type State, type Params } from "./simulation";

/** Rapier owns every gameplay vertex. Distances are metres, mass kilograms. */
export async function createRiverLeaf() {
  const R = await import("@dimforge/rapier3d");
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_STEP;
  for (const rock of obstacles)
    world.createCollider(
      R.ColliderDesc.ball(rock.r).setTranslation(rock.x, 0.32, rock.z),
    );
  for (const side of [-1, 1])
    world.createCollider(
      R.ColliderDesc.cuboid(2.5, 0.55, 65).setTranslation(
        side * 6.7,
        0.05,
        -45,
      ),
    );
  const positions: number[] = [],
    triangles: number[] = [];
  for (let row = 0; row < 9; row++) {
    const t = row / 8,
      width = Math.max(0.008, 0.27 * Math.sin(Math.PI * t));
    for (const x of [-width, 0, width])
      positions.push(x, 0.08, (t - 0.5) * 0.89);
    if (row)
      for (let col = 0; col < 2; col++) {
        const a = (row - 1) * 3 + col,
          b = row * 3 + col;
        triangles.push(a, b, a + 1, a + 1, b, b + 1);
      }
  }
  const indices = new Uint32Array(triangles),
    rest = new Float32Array(positions);
  let body: Rapier.SoftBody;
  function reset() {
    if (body) world.removeSoftBody(body);
    const desc = R.SoftBodyDesc.trimesh(rest, indices);
    if (!desc) throw Error("Rapier leaf triangulation failed");
    body = world.createSoftBody(
      desc
        .setMass(0.002)
        .setSoftness(30, 1)
        .setLinearDamping(0.02)
        .setParticleRadius(0.008),
    );
  }
  reset();
  const output = new Float32Array(rest.length),
    normals = new Float32Array(rest.length),
    uvs = new Float32Array((rest.length / 3) * 2);
  const ids = Uint32Array.from({ length: rest.length / 3 }, (_, i) => i);
  for (let i = 0; i < ids.length; i++) {
    uvs[i * 2] = rest[i * 3] / 0.54 + 0.5;
    uvs[i * 2 + 1] = rest[i * 3 + 2] / 0.89 + 0.5;
  }
  const frame: LeafFrame = {
    pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    fragments: [
      {
        id: "leaf",
        positions: output,
        normals,
        uvs,
        indices,
        vertexIds: ids,
        topologyRevision: 0,
      },
    ],
  };
  const point = { x: 0, y: 0, z: 0 },
    velocity = { x: 0, y: 0, z: 0 },
    force = { x: 0, y: 0, z: 0 };
  let lastStepMs = 0;
  return {
    world,
    frame,
    reset,
    step(state: State, p: Params) {
      const started = performance.now();
      body.resetForces(true);
      for (let i = 0; i < body.numParticles(); i++) {
        body.particlePosition(i, point);
        body.particleVelocity(i, velocity);
        const e = sampleEnvironment(point.x, point.z, state, p),
          m = body.particleMass(i);
        // Effective supported thickness 4 cm: at equilibrium half is submerged.
        // Acceleration is bounded, with vertical water drag and horizontal current drag.
        const immersed = Math.max(
          0,
          Math.min(1, (e.height - point.y + 0.02) / 0.04),
        );
        force.x =
          m * ((e.current.x - velocity.x) * p.drag * immersed + e.wind.x * 3);
        force.z =
          m * ((e.current.z - velocity.z) * p.drag * immersed + e.wind.z * 3);
        force.y = m * (19.62 * immersed - velocity.y * 6 * immersed);
        body.addParticleForce(i, force, true);
      }
      world.step();
      let x = 0,
        y = 0,
        z = 0,
        vx = 0,
        vy = 0,
        vz = 0;
      for (let i = 0; i < body.numParticles(); i++) {
        body.particlePosition(i, point);
        body.particleVelocity(i, velocity);
        x += point.x;
        y += point.y;
        z += point.z;
        vx += velocity.x;
        vy += velocity.y;
        vz += velocity.z;
      }
      const n = body.numParticles();
      state.x = x / n;
      state.y = y / n;
      state.z = z / n;
      state.vx = vx / n;
      state.vy = vy / n;
      state.vz = vz / n;
      if (state.z < river.stop) {
        reset();
        state.x = 0;
        state.z = 0;
        state.y = 0.08;
        state.laps++;
      }
      lastStepMs = performance.now() - started;
    },
    readFrame() {
      output.set(body.particlePositions());
      return frame;
    },
    diagnostics() {
      return {
        engine: "Rapier",
        particles: body.numParticles(),
        constraints: body.numEdges(),
        stepMs: lastStepMs,
      };
    },
    dispose() {
      world.free();
    },
  };
}
