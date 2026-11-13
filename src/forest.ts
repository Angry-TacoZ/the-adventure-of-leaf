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
    roots: { matrix: THREE.Matrix4; z: number; slot: number; opening?: boolean }[] }[] = [];
  const rng = new Rng("headwaters-forest-placement");
  const matrix = new THREE.Matrix4();
  let opening: THREE.Vector3 | undefined, openingScore = Infinity;
  let selectedRoot: { opening?: boolean } | undefined;
  let openingCanopy: THREE.BufferGeometry | undefined, openingLocal: THREE.Vector3 | undefined;
  const candidate = new THREE.Vector3();
  for (let variant = 0; variant < 3; variant++) {
    const { wood, foliage } = createBirchGeometry(`yellow-birch-${variant}`);
    geometries.push(wood, foliage);
    const roots: { matrix: THREE.Matrix4; z: number; slot: number; opening?: boolean }[] = [];
    for (let section = 0; section < 4; section++) {
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? -1 : 1;
        let z = river.start - (section + (variant * 2 + Math.floor(i / 2) + 0.5) / 6) * (river.start - river.end) / 4 + rng.range(-1.8, 1.8);
        let x = side * rng.range(7, 12.5), scale = rng.range(0.8, 1.16);
        // One of the existing trees overhangs the headwaters. The opening point
        // below is selected from its actual blade geometry, not a floating prop.
        const openingTree = variant === 0 && section === 0 && i === 2;
        if (openingTree) { x = 6.7; z = 3; scale = 1; }
        matrix.makeScale(scale * (openingTree ? 1.5 : 1), scale, scale);
        // Bury the root flare below both sides of the local slope.
        matrix.setPosition(x, bankHeight(x, z) - 0.22, z);
        const root = { matrix: matrix.clone(), z, slot: i, opening: false };
        roots.push(root);
        if (z > -8 && z < 18) {
          const blades = foliage.getAttribute("position");
          for (let vertex = 6; vertex < blades.count; vertex += 7) {
            candidate.fromBufferAttribute(blades, vertex).applyMatrix4(matrix);
            if (Math.abs(candidate.x) > 3.3 || candidate.z < 0 || candidate.z > 8 || candidate.y < 2.5 || candidate.y > 8) continue;
            const score = Math.abs(candidate.x) + Math.abs(candidate.z - 3) * 0.3 + Math.abs(candidate.y - 4) * 0.05;
            if (score < openingScore) {
              if (selectedRoot) selectedRoot.opening = false;
              root.opening = true; selectedRoot = root;
              openingScore = score; opening = candidate.clone();
              openingCanopy = foliage;
              openingLocal = new THREE.Vector3().fromBufferAttribute(blades, vertex);
            }
          }
        }
      }
    }
    const trunk = new THREE.InstancedMesh(wood, woodMaterial, roots.length);
    const crown = new THREE.InstancedMesh(foliage, leafMaterial, roots.length);
    group.add(trunk, crown); batches.push({ trunk, crown, roots });
  }
  if (openingCanopy && openingLocal) {
    // The hero replaces a blade at this bough. Clear the small attachment/camera
    // pocket so adjacent leaves cannot sit directly inside the opening lens.
    const position = openingCanopy.getAttribute("position"), index = openingCanopy.index!;
    const tiers: number[][] = [[], []];
    const split = openingCanopy.userData.lowDetailIndexCount as number;
    for (let i = 0; i < index.count; i += 18) {
      candidate.fromBufferAttribute(position, index.getX(i)).sub(openingLocal);
      if (Math.abs(candidate.x) < 0.8 && Math.abs(candidate.y) < 0.8 && candidate.z > -0.6 && candidate.z < 1.2) continue;
      const tier = i < split ? 0 : 1;
      for (let j = 0; j < 18; j++) tiers[tier].push(index.getX(i + j));
    }
    openingCanopy.setIndex([...tiers[0], ...tiers[1]]);
    openingCanopy.userData.lowDetailIndexCount = tiers[0].length;
  }
  let quality = NaN, cell = NaN, openingVisible = false;
  return {
    group,
    opening: opening ? { x: opening.x, y: opening.y + 0.03, z: opening.z } : undefined,
    update(time: number, x: number, z: number, intensity: number, nextQuality: number, viewerZ: number) {
      clock.value = time;
      const strength = Math.min(1, Math.max(0, intensity));
      wind.value.set(x * strength * 0.24, 0, z * strength * 0.24);
      const nextCell = Math.round(viewerZ / 8);
      if (quality !== nextQuality || cell !== nextCell) {
        quality = nextQuality;
        cell = nextCell;
        openingVisible = false;
        for (const { trunk, crown, roots } of batches) {
          crown.geometry.setDrawRange(0, quality < 0.75 ? crown.geometry.userData.lowDetailIndexCount : Infinity);
          let count = 0;
          for (const root of roots) {
            // Cull beyond opaque fog; low quality keeps paired banks throughout.
            if (Math.abs(root.z - cell * 8) > 75 || (quality < 0.75 && root.slot >= 2 && !root.opening)) continue;
            trunk.setMatrixAt(count, root.matrix); crown.setMatrixAt(count, root.matrix); count++;
            if (root.opening) openingVisible = true;
          }
          for (const mesh of [trunk, crown]) {
            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere(); mesh.boundingSphere!.radius += 0.4;
          }
        }
      }
    },
    diagnostics: () => ({ openingVisible, species: "Betula alleghaniensis", variants: 3,
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
