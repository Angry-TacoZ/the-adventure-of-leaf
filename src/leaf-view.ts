import * as THREE from "three/webgpu";
import type { LeafFrame, LeafMeshData, Vector3Data } from "./physics-boundary";

/** Owns display buffers only. Never modifies the physics frame supplied by its caller. */
export function createLeafView() {
  const group = new THREE.Group();
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xb5aa45,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const veinMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f7235,
    side: THREE.DoubleSide,
  });
  const pieces = new Map<
    string,
    {
      root: THREE.Group;
      blade: THREE.Mesh;
      vein: THREE.Mesh;
      revision: number | undefined;
      centres: [number, number][];
    }
  >();
  function remove(id: string) {
    const piece = pieces.get(id);
    if (!piece) return;
    group.remove(piece.root);
    piece.blade.geometry.dispose();
    piece.vein.geometry.dispose();
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
      veinGeometry = new THREE.BufferGeometry();
    // Stable source IDs identify the original central vein; disconnected segments are omitted.
    const ids =
      data.vertexIds ??
      Uint32Array.from({ length: data.positions.length / 3 }, (_, i) => i);
    const centres = Array.from(ids.entries())
      .filter(([, id]) => id % 3 === 1)
      .sort((a, b) => a[1] - b[1]);
    const veinIndices: number[] = [];
    for (let i = 1; i < centres.length; i++)
      if (centres[i][1] - centres[i - 1][1] === 3) {
        const a = (i - 1) * 2;
        veinIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    veinGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(centres.length * 6),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    veinGeometry.setIndex(veinIndices);
    const vein = new THREE.Mesh(veinGeometry, veinMaterial),
      root = new THREE.Group();
    blade.frustumCulled = vein.frustumCulled = false;
    root.add(blade, vein);
    group.add(root);
    const piece = {
      root,
      blade,
      vein,
      revision: data.topologyRevision,
      centres,
    };
    pieces.set(data.id, piece);
    return piece;
  }
  return {
    group,
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
        const veinAttr = piece.vein.geometry.attributes
          .position as THREE.BufferAttribute;
        let row = 0;
        for (const [i] of piece.centres) {
          veinAttr.setXYZ(
            row * 2,
            attr.getX(i) - 0.006,
            attr.getY(i) + 0.004,
            attr.getZ(i),
          );
          veinAttr.setXYZ(
            row * 2 + 1,
            attr.getX(i) + 0.006,
            attr.getY(i) + 0.004,
            attr.getZ(i),
          );
          row++;
        }
        veinAttr.needsUpdate = true;
        piece.vein.geometry.computeVertexNormals();
      }
      group.position.set(centre.x, centre.y, centre.z);
      group.rotation.set(0, 0, 0);
    },
    dispose() {
      for (const id of pieces.keys()) remove(id);
      bladeMaterial.dispose();
      veinMaterial.dispose();
    },
  };
}
