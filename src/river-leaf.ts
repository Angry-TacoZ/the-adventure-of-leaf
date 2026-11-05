import { createGrindMeter } from "./leaf-integrity";
import { createLeafTopology } from "./leaf-topology";
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
  const events = new R.EventQueue(true);
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
  for (let row = 0; row < 17; row++) {
    const t = row / 16,
      width = Math.max(
        0.006,
        0.29 *
          Math.sin(Math.PI * t) ** 0.65 *
          (1 - 0.22 * t) *
          (row % 2 ? 0.94 : 1),
      );
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

  const topology = createLeafTopology(rest);
  let bodies: Rapier.SoftBody[] = [];
  const material = R.SoftBodyMaterial.uniform(30, 1);
  material.tearStrain = 0.08;
  material.tearForce = 0.01;
  material.tearSmoothing = 0.04;
  material.maxTearsPerStep = 1;
  material.edgePlasticYield = 0.3;
  material.edgePlasticCreep = 0.2;
  material.edgePlasticMax = 0.2;
  // Sustained rock grinding tears the leaf: a free 2 g cloth builds no engine
  // tear load against smooth balls, so contact time drives damage instead.
  // The leaf is 0.89 m long, so contact counts from the leaf edge, not its
  // centre — a leaf parked edge-on against a rock still grinds.
  const grind = createGrindMeter(0.6, 0.15);
  const LEAF_HALF = 0.45;
  let lastStepMs = 0,
    tears = 0;
  function reset() {
    tears = 0;
    for (const body of world.softBodies.getAll()) world.removeSoftBody(body);
    topology.clear();
    grind.reset();
    const desc = R.SoftBodyDesc.trimesh(rest, indices);
    if (!desc) throw Error("Rapier leaf triangulation failed");
    bodies = [
      world.createSoftBody(
        desc
          .setMass(0.002)
          .setMaterial(material)
          .setLinearDamping(0.02)
          .setParticleRadius(0.008),
      ),
    ];
  }
  reset();
  const frame: LeafFrame = {
    pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    fragments: [],
  };
  const point = { x: 0, y: 0, z: 0 },
    velocity = { x: 0, y: 0, z: 0 },
    force = { x: 0, y: 0, z: 0 };

  function grindCut(px: number, py: number, pz: number) {
    // Gameplay cut at a particle-space point, driven by sustained rock
    // contact rather than engine tear load. Shares the tear counting with
    // the verification hook.
    const body = bodies.reduce((a, b) =>
      a.numParticles() >= b.numParticles() ? a : b,
    );
    if (!body) return 0;
    const event = world.cutSoftBody(body, [
      { x: px - 2, y: py - 2, z: pz },
      { x: px + 2, y: py - 2, z: pz },
      { x: px, y: py + 4, z: pz },
    ]);
    if (event) {
      tears++;
      event.free();
      sync();
    }
    return bodies.length;
  }
  function sync() {
    bodies = world.softBodies.getAll();
    topology.prune(new Set(bodies.map((b) => b.handle)));
  }
  return {
    world,
    frame,
    reset,
    step(state: State, p: Params) {
      const started = performance.now();
      for (const body of bodies) {
        body.resetForces(true);
        for (let i = 0; i < body.numParticles(); i++) {
          body.particlePosition(i, point);
          body.particleVelocity(i, velocity);
          const e = sampleEnvironment(point.x, point.z, state, p),
            m = body.particleMass(i);
          // Effective 4 cm supported-area approximation, with half immersion at equilibrium.
          const immersed = Math.max(
            0,
            Math.min(1, (e.height - point.y + 0.02) / 0.04),
          );
          force.x =
            m * ((e.current.x - velocity.x) * p.drag * immersed + e.wind.x * 3);
          force.z =
            m *
            ((e.current.z - velocity.z) * p.drag * immersed +
              Math.min(
                e.wind.z * 3,
                Math.max(0, (-e.current.z - 0.15) * p.drag * immersed),
              ));
          force.y = m * (19.62 * immersed - velocity.y * 6 * immersed);
          body.addParticleForce(i, force, true);
        }
      }
      world.step(events);
      events.drainSoftBodyTearEvents(() => {
        tears++;
      });
      sync();
      const primary = bodies.reduce((a, b) =>
        a.numParticles() >= b.numParticles() ? a : b,
      );
      let x = 0,
        y = 0,
        z = 0,
        vx = 0,
        vy = 0,
        vz = 0;
      for (let i = 0; i < primary.numParticles(); i++) {
        primary.particlePosition(i, point);
        primary.particleVelocity(i, velocity);
        x += point.x;
        y += point.y;
        z += point.z;
        vx += velocity.x;
        vy += velocity.y;
        vz += velocity.z;
      }
      const n = primary.numParticles();
      state.x = x / n;
      state.y = y / n;
      state.z = z / n;
      state.vx = vx / n;
      state.vy = vy / n;
      state.vz = vz / n;
      // Sustained rock grinding cuts the leaf. Gap is distance from the leaf
      // edge to the nearest rock surface; the cut lands on the rock-side
      // surface point. State is already in world space on this branch.
      let gap = Infinity, contactX = state.x, contactZ = state.z;
      for (const rock of obstacles) {
        const dx = state.x - rock.x, dz = state.z - rock.z;
        const dist = Math.hypot(dx, dz);
        const d = dist - rock.r - LEAF_HALF;
        if (d < gap) {
          gap = d;
          const s = dist > 1e-6 ? rock.r / dist : 0;
          contactX = rock.x + dx * s;
          contactZ = rock.z + dz * s;
        }
      }
      if (grind.sample(gap, FIXED_STEP)) grindCut(contactX, y / n, contactZ);
      if (state.z < river.stop) {
        reset();
        state.x = 0;
        state.z = 0;
        state.y = 0.08;
        state.vx = state.vy = state.vz = 0;
        state.laps++;
      }
      lastStepMs = performance.now() - started;
    },
    readFrame() {
      frame.fragments = bodies.map((body) => topology.read(body));
      return frame;
    },
    forceTear() {
      // Verification-only caller: cut across the middle using engine topology, not duplicated meshes.
      const body = bodies.reduce((a, b) =>
        a.numParticles() >= b.numParticles() ? a : b,
      );
      let x = 0,
        y = 0,
        z = 0;
      for (let i = 0; i < body.numParticles(); i++) {
        const v = body.particlePosition(i);
        x += v.x;
        y += v.y;
        z += v.z;
      }
      const n = body.numParticles();
      x /= n;
      y /= n;
      z = z / n - 0.02;
      const event = world.cutSoftBody(body, [
        { x: x - 2, y: y - 2, z },
        { x: x + 2, y: y - 2, z },
        { x, y: y + 4, z },
      ]);
      if (event) {
        tears++;
        event.free();
        sync();
      }
      return bodies.length;
    },
    diagnostics() {
      return {
        engine: "Rapier",
        particles: bodies.reduce((n, b) => n + b.numParticles(), 0),
        constraints: bodies.reduce((n, b) => n + b.numEdges(), 0),
        fragments: bodies.length,
        tears,
        grind: grind.fraction(),
        stepMs: lastStepMs,
      };
    },
    dispose() {
      events.free();
      world.free();
    },
  };
}
