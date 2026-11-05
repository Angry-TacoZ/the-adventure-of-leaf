import type * as Rapier from "@dimforge/rapier3d";
import { FISH_COUNT, sampleFish, type FishFrame } from "./fish-motion";
import { initial, defaults, type State, type Params } from "./simulation";

/** World owns lifetime; this module owns kinematic targets and snapshots. */
export function createFishPhysics(R: typeof Rapier, world: Rapier.World, offset = { x: 0, z: 0 }) {
  const bodies = Array.from({ length: FISH_COUNT }, (_, id) => {
    const pose = sampleFish(id, initial(), defaults);
    const body = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.orientation));
    world.createCollider(R.ColliderDesc.capsule(0.15, 0.055)
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }).setFriction(0.15), body);
    return body;
  });
  return {
    step(state: State, params: Params) {
      bodies.forEach((body, id) => {
        const pose = sampleFish(id, state, params);
        body.setNextKinematicTranslation({ x: pose.position.x - offset.x, y: pose.position.y, z: pose.position.z - offset.z });
        body.setNextKinematicRotation(pose.orientation);
      });
    },
    read(): FishFrame[] {
      return bodies.map((body, id) => {
        const p = body.translation();
        return { id, position: { x: p.x + offset.x, y: p.y, z: p.z + offset.z }, orientation: body.rotation() };
      });
    },
    rebase(dx: number, dz: number) {
      for (const body of bodies) {
        const p = body.translation(); p.x -= dx; p.z -= dz; body.setTranslation(p, false);
      }
    },
  };
}
