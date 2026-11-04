import { createBankData, BED_WIDTH } from "./bank-terrain";
import { createLeafTopology } from "./leaf-topology";
import { createFishPhysics } from "./fish-physics";
import { triangleArea, retainedFraction, shouldEndAdventure } from "./leaf-integrity";
import type * as Rapier from "@dimforge/rapier3d";
import {
  FIXED_STEP,
  sampleEnvironment,
  type LeafFrame,
  type Vector3Data,
} from "./physics-boundary";
import { obstacles, river, type State, type Params } from "./simulation";

/** Rapier owns every gameplay vertex. Distances are metres, mass kilograms. */
export async function createRiverLeaf() {
  const R = await import("@dimforge/rapier3d");
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_STEP;
  const events = new R.EventQueue(true);
  const fish = createFishPhysics(R, world);
  for (const rock of obstacles)
    world.createCollider(
      R.ColliderDesc.ball(rock.r).setTranslation(rock.x, 0.32, rock.z),
    );
  for (const side of [-1, 1] as const) {
    const bank = createBankData(side);
    world.createCollider(R.ColliderDesc.trimesh(bank.positions, bank.indices));
  }
  world.createCollider(
    R.ColliderDesc.cuboid(
      BED_WIDTH / 2,
      0.05,
      (river.start - river.end) / 2,
    ).setTranslation(0, -0.46, (river.start + river.end) / 2),
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
      positions.push(x, 0, (t - 0.5) * 0.89);
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
  const originalArea = triangleArea(rest, indices);
  const areaCache = new Map<number, { revision: number; area: number }>();
  function materialArea(body: Rapier.SoftBody) {
    const revision = body.topologyVersion(), cached = areaCache.get(body.handle);
    if (cached?.revision === revision) return cached.area;
    const points = new Float32Array(body.numParticles() * 3);
    for (let i = 0; i < body.numParticles(); i++) {
      const p = body.particleRestPosition(i); points.set([p.x, p.y, p.z], i * 3);
    }
    const area = triangleArea(points, body.boundary());
    areaCache.set(body.handle, { revision, area });
    return area;
  }
  function primaryBody() {
    return bodies.reduce<Rapier.SoftBody | undefined>((largest, body) =>
      !largest || materialArea(body) > materialArea(largest) ? body : largest, undefined);
  }
  let bodies: Rapier.SoftBody[] = [];
  const material = R.SoftBodyMaterial.uniform(30, 1);
  material.tearStrain = 0.8;
  material.tearForce = 0.3;
  material.tearSmoothing = 0.04;
  material.maxTearsPerStep = 1;
  material.edgePlasticYield = 0.3;
  material.edgePlasticCreep = 0.2;
  material.edgePlasticMax = 0.2;
  let lastStepMs = 0,
    tears = 0;
  let origin: Vector3Data = { x: 0, y: 0.08, z: 0 };
  function reset(spawn: Vector3Data = origin) {
    origin = { ...spawn };
    tears = 0;
    for (const body of world.softBodies.getAll()) world.removeSoftBody(body);
    topology.clear();
    areaCache.clear();
    const desc = R.SoftBodyDesc.trimesh(rest, indices);
    if (!desc) throw Error("Rapier leaf triangulation failed");
    bodies = [
      world.createSoftBody(
        desc
          .setMass(0.002)
          .setTranslation(origin)
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

  function sync() {
    bodies = world.softBodies.getAll();
    topology.prune(new Set(bodies.map((b) => b.handle)));
    const active = new Set(bodies.map((b) => b.handle));
    for (const handle of areaCache.keys()) if (!active.has(handle)) areaCache.delete(handle);
  }
  return {
    world,
    frame,
    reset,
    step(state: State, p: Params) {
      const started = performance.now();
      fish.step(state, p);
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
          // Broad-leaf air resistance fades out before the supported water band.
          // This bounds the opening fall without changing in-water damping.
          const air = Math.min(1, Math.max(0, (point.y - e.height - 0.02) / 0.1));
          const airDrag = 4 * air * air * (3 - 2 * air);
          force.y = m * (19.62 * immersed - velocity.y * (6 * immersed + airDrag));
          body.addParticleForce(i, force, true);
        }
      }
      world.step(events);
      events.drainSoftBodyTearEvents(() => {
        tears++;
      });
      sync();
      const primary = primaryBody();
      if (!primary) { lastStepMs = performance.now() - started; return; }
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
      // A terminal tear at the testing-loop boundary must not heal via reset.
      if (state.z < river.stop && !shouldEndAdventure(materialArea(primary) / originalArea)) {
        reset();
        state.x = origin.x;
        state.z = origin.z;
        state.y = origin.y;
        state.vx = state.vy = state.vz = 0;
        state.laps++;
      }
      lastStepMs = performance.now() - started;
    },
    readFrame() {
      frame.fragments = bodies.map((body) => topology.read(body));
      return frame;
    },
    readFishFrame: fish.read,
    forceTear() {
      // Verification-only caller: cut across the middle using engine topology, not duplicated meshes.
      const body = primaryBody();
      if (!body) return 0;
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
        stepMs: lastStepMs,
        integrity: retainedFraction(bodies.map(materialArea), originalArea),
      };
    },
    dispose() {
      events.free();
      world.free();
    },
  };
}
