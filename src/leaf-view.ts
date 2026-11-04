import { createLeafSurface } from "./leaf-surface";
import * as THREE from "three/webgpu";
import type { LeafFrame, LeafMeshData, Vector3Data } from "./physics-boundary";

/** Owns display buffers only. Never modifies the physics frame supplied by its caller. */
export function createLeafView() {
  const group = new THREE.Group();
  const surface = createLeafSurface();
  const bladeMaterial = surface.material;
  const pieces = new Map<
    string,
    {
      root: THREE.Group;
      blade: THREE.Mesh;
      revision: number | undefined;
    }
  >();
  function remove(id: string) {
    const piece = pieces.get(id);
    if (!piece) return;
    group.remove(piece.root);
    piece.blade.geometry.dispose();
    pieces.delete(id);
  }
  function create(data: LeafMeshData) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(data.positions.length),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    if (data.indices)
      geometry.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
    geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs.slice(), 2));
    const blade = new THREE.Mesh(geometry, bladeMaterial),
      root = new THREE.Group();
    blade.frustumCulled = false;
    root.add(blade);
    group.add(root);
    const piece = { root, blade, revision: data.topologyRevision };
    pieces.set(data.id, piece);
    return piece;
  }
  return {
    group,
    ready: surface.ready,
    update(frame: LeafFrame, centre: Vector3Data) {
      const active = new Set((frame.fragments ?? []).map((p) => p.id));
      for (const id of pieces.keys()) if (!active.has(id)) remove(id);
      for (const data of frame.fragments ?? []) {
        let piece = pieces.get(data.id);
        if (
          piece &&
          (piece.revision !== data.topologyRevision ||
            piece.blade.geometry.attributes.position.array.length !==
              data.positions.length)
        ) {
          remove(data.id);
          piece = undefined;
        }
        if (!piece) piece = create(data);
        const attr = piece.blade.geometry.attributes
          .position as THREE.BufferAttribute;
        for (let i = 0; i < attr.count; i++)
          attr.setXYZ(
            i,
            data.positions[i * 3] - centre.x,
            data.positions[i * 3 + 1] - centre.y,
            data.positions[i * 3 + 2] - centre.z,
          );
        attr.needsUpdate = true;
        piece.blade.geometry.computeVertexNormals();
      }
      group.position.set(centre.x, centre.y, centre.z);
      group.rotation.set(0, 0, 0);
    },
    dispose() {
      for (const id of pieces.keys()) remove(id);
      surface.dispose();
    },
  };
}
