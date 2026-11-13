import { bankHeight } from "./bank-terrain";
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { river } from "./simulation";

/** Supplied asset placement, independent of leaf physics and tree generation. */
export async function createUnderstory(comparison = false) {
  const group = new THREE.Group();
  group.name = "Riverbank understory";
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  const instances: { mesh: THREE.InstancedMesh; count: number }[] = [];
  const failedSpecies: string[] = [];
  const names = comparison
    ? [
        "fern_02",
        "grass_medium_01",
        "moss_01",
        "nettle_plant",
        "dandelion_01",
        "celandine_01",
        "searsia_lucida",
      ]
    : ["fern_02", "grass_medium_01", "moss_01", "nettle_plant"];
  const matrix = new THREE.Matrix4(),
    original = new THREE.Matrix4(),
    rotation = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  await Promise.all(
    names.map(async (name, kind) => {
      const gltf = await new GLTFLoader().loadAsync(
        `${import.meta.env.BASE_URL}assets/understory/${name}.glb`,
      ).catch(() => { failedSpecies.push(name); return null; });
      if (!gltf) return;
      gltf.scene.updateMatrixWorld(true);
      const count = comparison
        ? 12
        : ({ fern_02: 144, grass_medium_01: 288, moss_01: 192, nettle_plant: 80 }[
            name
          ] ?? 12);
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const mat of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          mat.side = THREE.DoubleSide;
          mat.transparent = false;
          mat.alphaTest = 0.45;
          mat.depthWrite = true;
          mat.forceSinglePass = true;
          materials.add(mat);
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) textures.add(value);
        }
        const mesh = new THREE.InstancedMesh(
          object.geometry,
          object.material,
          count,
        );
        original.copy(object.matrixWorld);
        for (let i = 0; i < count; i++) {
          const side = i % 2 ? -1 : 1;
          // Modular permutation distributes the low-detail subset along the whole reach.
          const slot = (Math.floor(i / 2) * 7) % (count / 2);
          const z = comparison
            ? 5 - slot * 4 - kind * 0.7
            : river.start -
              ((slot + 0.5) / (count / 2)) * (river.start - river.end);
          // Spread larger plants onto the outer slopes; keep moss near the water.
          const bankBand =
            comparison || name === "moss_01" ? 0 : Math.floor(i / 2) % 3;
          const x =
            side *
            (({
              searsia_lucida: 7.0,
              moss_01: 5.1,
              grass_medium_01: 5.5,
              nettle_plant: 6.3,
            }[name] ?? 5.65) +
              (i % 3) * 0.17 + bankBand * 3.3);
          const y = bankHeight(x, z) + (name === "moss_01" ? 0.01 : -0.02);
          rotation.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            i * 2.399 + kind,
          );
          const size = name === "moss_01" ? 2 : name === "grass_medium_01" ? 1.5 : 1;
          scale.setScalar((0.85 + (i % 4) * 0.1) * size);
          matrix
            .compose(new THREE.Vector3(x, y, z), rotation, scale)
            .multiply(original);
          mesh.setMatrixAt(i, matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
        instances.push({ mesh, count });
      });
    }),
  );
  let quality = 1;
  return {
    group,
    setQuality(value: number) {
      if (quality === value) return;
      quality = value;
      for (const { mesh, count } of instances)
        mesh.count = Math.ceil(count * (value < 0.75 ? 0.5 : 1));
    },
    diagnostics() {
      return {
        comparison,
        species: names.filter((name) => !failedSpecies.includes(name)),
        failedSpecies: names.filter((name) => failedSpecies.includes(name)),
        instances: instances.reduce((n, p) => n + p.mesh.count, 0),
      };
    },
    dispose() {
      for (const { mesh } of instances) mesh.dispose();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
      group.clear();
    },
  };
}
