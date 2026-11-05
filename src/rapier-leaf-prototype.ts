import type * as Rapier from "@dimforge/rapier3d";
import { FIXED_STEP } from "./physics-boundary";

/** Isolated prototype: Rapier is authoritative for these vertices, not gameplay yet. */
export async function createSoftLeafPrototype() {
  const R = await import("@dimforge/rapier3d");
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_STEP;
  const vertices = new Float32Array([
    0, 1, -0.9, -0.5, 1, -0.4, 0, 1, -0.35, 0.5, 1, -0.4,
    -0.55, 1, 0.3, 0, 1, 0.3, 0.55, 1, 0.3, 0, 1, 0.95,
  ]);
  const indices = new Uint32Array([0,1,2, 0,2,3, 1,4,2, 2,4,5, 2,5,3, 3,5,6, 4,7,5, 5,7,6]);
  const desc = R.SoftBodyDesc.trimesh(vertices, indices);
  if (!desc) { world.free(); throw new Error("Rapier could not create leaf mesh"); }
  const body: Rapier.SoftBody = world.createSoftBody(desc.setMass(0.02).setSoftness(20, 0.8).setLinearDamping(0.2));
  return { world, body, indices, step() { world.step(); }, dispose() { world.free(); } };
}
