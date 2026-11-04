import type { SoftBody } from "@dimforge/rapier3d";
import type { LeafMeshData } from "./physics-boundary";

/** Owns the mapping rebuilt from Rapier rest positions after each topology revision. */
export function createLeafTopology(rest: Float32Array) {
  const snapshots = new Map<number, LeafMeshData>();
  let nextId = 0;
  function read(body: SoftBody) {
    let data = snapshots.get(body.handle);
    if (
      !data ||
      data.topologyRevision !== body.topologyVersion() ||
      data.positions.length !== body.numParticles() * 3
    ) {
      const count = body.numParticles(),
        ids = new Uint32Array(count),
        uvs = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) {
        const point = body.particleRestPosition(i);
        let closest = 0,
          distance = Infinity;
        for (let j = 0; j < rest.length / 3; j++) {
          const d =
            (point.x - rest[j * 3]) ** 2 +
            (point.y - rest[j * 3 + 1]) ** 2 +
            (point.z - rest[j * 3 + 2]) ** 2;
          if (d < distance) {
            distance = d;
            closest = j;
          }
        }
        // Only original central-vein particles keep their source ID. New interpolated
        // particles receive IDs outside the vein pattern instead of inventing connections.
        ids[i] = distance < 1e-8 ? closest : 0xffffffff;
        uvs[i * 2] = point.x / 0.54 + 0.5;
        uvs[i * 2 + 1] = point.z / 0.89 + 0.5;
      }
      data = {
        id: data?.id ?? `leaf-${nextId++}`,
        topologyRevision: body.topologyVersion(),
        vertexIds: ids,
        positions: new Float32Array(count * 3),
        normals: new Float32Array(count * 3),
        uvs,
        indices: body.boundary(),
      };
      snapshots.set(body.handle, data);
    }
    data.positions.set(body.particlePositions());
    return data;
  }
  return {
    read,
    prune(handles: Set<number>) {
      for (const handle of snapshots.keys())
        if (!handles.has(handle)) snapshots.delete(handle);
    },
    clear() {
      snapshots.clear();
    },
  };
}
