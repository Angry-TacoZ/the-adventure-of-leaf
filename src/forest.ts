import * as THREE from "three/webgpu";
import { attribute, positionLocal, uniform, sin } from "three/tsl";
import { createBirchGeometry } from "./birch-tree";
import { bankHeight } from "./bank-terrain";
import { river } from "./simulation";
import { Rng } from "./vendor/seedthree/rng.js";

function barkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#8f805d"; ctx.fillRect(0, 0, 256, 256);
  const rng = new Rng("yellow-birch-bark");
  for (let i = 0; i < 240; i++) {
    const y = rng.range(0, 256), x = rng.range(0, 256), width = rng.range(3, 52);
    ctx.fillStyle = i % 3 ? "#635c45" : "#b4a27a";
    ctx.fillRect(x, y, width, rng.range(0.5, 2.3));
    // Repeat across the U seam rather than exposing a vertical texture edge.
    ctx.fillRect(x - 256, y, width, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Static rooted scenery; independent of navigation, collisions and leaf damage. */
export function createForest() {
  const group = new THREE.Group(); group.name = "Appalachian yellow-birch canopy";
  const clock = uniform(0), wind = uniform(new THREE.Vector3());
  const weight = attribute("aWind", "float");
  const bend = sin(clock.mul(1.6).add(positionLocal.y.mul(0.55))).mul(0.25).add(0.75);
  const position = positionLocal.add(wind.mul(weight.pow(2)).mul(bend));
  const bark = barkTexture();
  const woodMaterial = new THREE.MeshStandardNodeMaterial({ map: bark, roughness: 0.95 });
  woodMaterial.positionNode = position;
  const leafMaterial = new THREE.MeshStandardNodeMaterial({
    vertexColors: true, roughness: 0.85, side: THREE.DoubleSide,
  });
  leafMaterial.positionNode = position;
  const geometries: THREE.BufferGeometry[] = [];
  const batches: { trunk: THREE.InstancedMesh; crown: THREE.InstancedMesh;
    roots: { matrix: THREE.Matrix4; z: number; slot: number }[] }[] = [];
  const rng = new Rng("headwaters-forest-placement");
  const matrix = new THREE.Matrix4();
  for (let variant = 0; variant < 3; variant++) {
    const { wood, foliage } = createBirchGeometry(`yellow-birch-${variant}`);
    geometries.push(wood, foliage);
    const roots: { matrix: THREE.Matrix4; z: number; slot: number }[] = [];
    for (let section = 0; section < 4; section++) {
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? -1 : 1;
        const z = river.start - (section + (variant * 2 + Math.floor(i / 2) + 0.5) / 6) * (river.start - river.end) / 4 + rng.range(-1.8, 1.8);
        const x = side * rng.range(7, 12.5), scale = rng.range(0.8, 1.16);
        matrix.makeScale(scale, scale, scale);
        // Bury the root flare below both sides of the local slope.
        matrix.setPosition(x, bankHeight(x, z) - 0.22, z);
        roots.push({ matrix: matrix.clone(), z, slot: i });
      }
    }
    const trunk = new THREE.InstancedMesh(wood, woodMaterial, roots.length);
    const crown = new THREE.InstancedMesh(foliage, leafMaterial, roots.length);
    group.add(trunk, crown); batches.push({ trunk, crown, roots });
  }
  let quality = NaN, cell = NaN;
  return {
    group,
    update(time: number, x: number, z: number, intensity: number, nextQuality: number, viewerZ: number) {
      clock.value = time;
      const strength = Math.min(1, Math.max(0, intensity));
      wind.value.set(x * strength * 0.24, 0, z * strength * 0.24);
      const nextCell = Math.round(viewerZ / 8);
      if (quality !== nextQuality || cell !== nextCell) {
        quality = nextQuality;
        cell = nextCell;
        for (const { trunk, crown, roots } of batches) {
          crown.geometry.setDrawRange(0, quality < 0.75 ? crown.geometry.index!.count / 2 : Infinity);
          let count = 0;
          for (const root of roots) {
            // Cull beyond opaque fog; low quality keeps paired banks throughout.
            if (Math.abs(root.z - cell * 8) > 75 || (quality < 0.75 && root.slot >= 2)) continue;
            trunk.setMatrixAt(count, root.matrix); crown.setMatrixAt(count, root.matrix); count++;
          }
          for (const mesh of [trunk, crown]) {
            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere(); mesh.boundingSphere!.radius += 0.4;
          }
        }
      }
    },
    diagnostics: () => ({ species: "Betula alleghaniensis", variants: 3,
      totalTrees: 48, trees: batches.reduce((n, batch) => n + batch.trunk.count, 0),
      leafTriangles: batches.reduce((n, batch) => n + batch.crown.count *
        Math.min(batch.crown.geometry.drawRange.count, batch.crown.geometry.index!.count) / 3, 0),
      windDisplacement: wind.value.length(), geometries: geometries.length }),
    dispose() {
      for (const { trunk, crown } of batches) { trunk.dispose(); crown.dispose(); }
      for (const geometry of geometries) geometry.dispose();
      woodMaterial.dispose(); leafMaterial.dispose(); bark.dispose(); group.clear();
    },
  };
}
