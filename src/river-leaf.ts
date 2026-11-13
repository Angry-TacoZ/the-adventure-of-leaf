import { triangleArea, retainedFraction, createGrindMeter } from "./leaf-integrity";
import { createBankData, createBedData } from "./bank-terrain";
import { waterLevel } from "./journey";
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
  // Rock collider centre height above the local waterline. The grind gate
  // measures against this same geometry (ball centre plus radius), so
  // validation stays exact. Journey reaches slope downward, so each rock
  // rides on waterLevel at its own z rather than one global height.
  const ROCK_CENTER_Y = 0.32;
  const rockCenterY = (rock: { z: number }) => waterLevel(rock.z) + ROCK_CENTER_Y;
  // Local-origin frame for distant route coordinates; public state and
  // snapshots stay in route coordinates. Extracted from PR #5 (331599e).
  const offset = { x: 0, z: 0 };
  let rebases = 0;
  const fixed: { collider: Rapier.Collider; position: { x: number; y: number; z: number } }[] = [];
  function staticCollider(desc: Rapier.ColliderDesc, position = { x: 0, y: 0, z: 0 }) {
    const collider = world.createCollider(desc.setTranslation(position.x, position.y, position.z));
    fixed.push({ collider, position });
  }
  for (const rock of obstacles)
    staticCollider(
      R.ColliderDesc.ball(rock.r),
      { x: rock.x, y: rockCenterY(rock), z: rock.z },
    );
  for (const side of [-1, 1] as const) {
    const bank = createBankData(side);
    staticCollider(R.ColliderDesc.trimesh(bank.positions, bank.indices));
  }
  const bed = createBedData();
  staticCollider(R.ColliderDesc.trimesh(bed.positions, bed.indices));
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
  // Rest-material area per body, extracted from PR #5 (commit 3a9473f).
  // The primary fragment is the largest by rest area, never by particle
  // count: equal-count fragments can hold very different material.
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
  // Keep Rapier's deformable solve near its origin. Public state/snapshots
  // remain in route coordinates; rebasing changes no velocity, rest shape
  // or world pose. Extracted from PR #5 (331599e).
  function rebaseTo(x: number, z: number) {
    const dx = x - offset.x, dz = z - offset.z;
    if (dx === 0 && dz === 0) return;
    for (const body of bodies)
      for (let i = 0; i < body.numParticles(); i++) {
        const p = body.particlePosition(i); p.x -= dx; p.z -= dz;
        body.setParticlePosition(i, p);
      }
    offset.x = x; offset.z = z; rebases++;
    for (const { collider, position } of fixed)
      collider.setTranslation({ x: position.x - x, y: position.y, z: position.z - z });
  }
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
  // The gate measures the nearest particle, so a leaf parked edge-on
  // against a rock still grinds.
  const grind = createGrindMeter(0.6, 0.15);
  let misses = 0;
  let lastStepMs = 0,
    tears = 0;
  let origin = { x: 0, y: 0.08, z: 0 };
  function reset(spawn: { x: number; y: number; z: number } = origin) {
    origin = { ...spawn };
    tears = 0;
    for (const body of world.softBodies.getAll()) world.removeSoftBody(body);
    bodies = [];
    rebaseTo(Math.round(origin.x), Math.round(origin.z));
    topology.clear();
    grind.reset();
    misses = 0;
    areaCache.clear();
    const desc = R.SoftBodyDesc.trimesh(rest, indices);
    if (!desc) throw Error("Rapier leaf triangulation failed");
    // Placement moves current particles only: Rapier perturbs stored rest
    // positions at creation, which would break topology's exact
    // rest matching (all source IDs become 0xffffffff). The rest mesh is centred
    // at y=0, so placement needs no baked-height correction.
    const place = { x: origin.x - offset.x, y: origin.y, z: origin.z - offset.z };
    bodies = [
      world.createSoftBody(
        desc
          .setMass(0.002)
          .setMaterial(material)
          .setLinearDamping(0.02)
          .setParticleRadius(0.008),
      ),
    ];
    if (place.x !== 0 || place.y !== 0 || place.z !== 0)
      for (let i = 0; i < bodies[0].numParticles(); i++) {
        const p = bodies[0].particlePosition(i);
        p.x += place.x; p.y += place.y; p.z += place.z;
        bodies[0].setParticlePosition(i, p);
      }
  }
  reset();
  const frame: LeafFrame = {
    pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    fragments: [],
  };
  const point = { x: 0, y: 0, z: 0 },
    worldPoint = { x: 0, y: 0, z: 0 },
    velocity = { x: 0, y: 0, z: 0 },
    force = { x: 0, y: 0, z: 0 };

  function grindCut(px: number, py: number, pz: number) {
    // Gameplay cut at a particle-space point, driven by sustained rock
    // contact rather than engine tear load. Shares the tear counting with
    // the verification hook. Returns true on a real split; a null cut is a
    // miss the caller records without resetting the meter.
    const body = primaryBody();
    if (!body) return false;
    const event = world.cutSoftBody(body, [
      { x: px - 2, y: py - 2, z: pz },
      { x: px + 2, y: py - 2, z: pz },
      { x: px, y: py + 4, z: pz },
    ]);
    if (event) {
      tears++;
      event.free();
      sync();
      return true;
    }
    return false;
  }
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
      const centre = primaryBody()?.centerOfMass();
      if (centre && (Math.abs(centre.x) > 1 || Math.abs(centre.z) > 1))
        rebaseTo(offset.x + Math.round(centre.x), offset.z + Math.round(centre.z));
      for (const body of bodies) {
        body.resetForces(true);
        for (let i = 0; i < body.numParticles(); i++) {
          body.particlePosition(i, point);
          body.particleVelocity(i, velocity);
          worldPoint.x = point.x + offset.x; worldPoint.y = point.y; worldPoint.z = point.z + offset.z;
          const e = sampleEnvironment(worldPoint.x, worldPoint.z, state, p),
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
      state.x = x / n + offset.x;
      state.y = y / n;
      state.z = z / n + offset.z;
      state.vx = vx / n;
      state.vy = vy / n;
      state.vz = vz / n;
      // Gap is true 3D clearance: the nearest leaf particle to the surface
      // of the spherical rock collider at (rock.x, ROCK_CENTER_Y, rock.z).
      // A leaf flying over a rock is vertically separated and must not
      // grind. Far rocks are skipped by centroid distance first so the
      // per-particle scan stays local. The cut sits halfway between the
      // centroid and the nearest particle, clamped to ±0.15 m: strictly
      // inside the leaf for any non-degenerate fragment, so the triangle
      // cannot sit tangent past a tip, even head-on. A null cut is a
      // recorded miss; the meter stays full and retries instead of
      // resetting. Below 8 particles the leaf is already destroyed, so
      // grinding pauses with no miss and no reset.
      // Rock colliders live in the rebased local frame while state is in
      // route coordinates, so the fine scan compares local particle
      // positions against local rock positions. The cut stays local too.
      let gap = Infinity, nearX = state.x - offset.x, nearZ = state.z - offset.z;
      for (const rock of obstacles) {
        const cdx = state.x - rock.x,
          cdy = state.y - rockCenterY(rock),
          cdz = state.z - rock.z;
        if (Math.hypot(cdx, cdy, cdz) - rock.r > 1.0) continue;
        const localX = rock.x - offset.x, localZ = rock.z - offset.z;
        for (let i = 0; i < primary.numParticles(); i++) {
          primary.particlePosition(i, point);
          const dx = point.x - localX,
            dy = point.y - rockCenterY(rock),
            dz = point.z - localZ;
          const d = Math.hypot(dx, dy, dz) - rock.r;
          if (d < gap) { gap = d; nearX = point.x; nearZ = point.z; }
        }
      }
      const localCentroidZ = state.z - offset.z;
      const cutZ = localCentroidZ + Math.max(-0.3, Math.min(0.3, nearZ - localCentroidZ)) * 0.5;
      if (primary.numParticles() > 8 && grind.sample(gap, FIXED_STEP)) {
        if (grindCut(nearX, y / n, cutZ)) grind.reset();
        else {
          misses++;
          grind.noteMiss();
        }
      }
      if (state.z < river.stop) {
        reset({ x: 0, y: 0.08, z: 0 });
        state.x = 0;
        state.z = 0;
        state.y = 0.08;
        state.vx = state.vy = state.vz = 0;
        state.laps++;
      }
      lastStepMs = performance.now() - started;
    },
    readFrame() {
      frame.fragments = bodies.map((body) => {
        const data = topology.read(body);
        for (let i = 0; i < data.positions.length; i += 3) {
          data.positions[i] += offset.x; data.positions[i + 2] += offset.z;
        }
        return data;
      });
      return frame;
    },
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
        misses,
        integrity: retainedFraction(bodies.map(materialArea), originalArea),
        origin: { ...offset }, rebases,
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
