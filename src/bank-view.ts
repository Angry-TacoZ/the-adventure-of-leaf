import * as THREE from "three/webgpu";
import { createBankData } from "./bank-terrain";
/** Terrain appearance is separate from the shared collision/height data. */
export function createBankMeshes(pebbles: THREE.Texture) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  let seed = 1743;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pixels = ctx.createImageData(256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const n = random() * 22;
    pixels.data.set([78 + n, 76 + n * 0.9, 48 + n * 0.6, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  // Small scattered humus/leaf-litter marks; original procedural placeholder texture.
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = i % 3 ? "#605236" : "#807441";
    ctx.fillRect(
      random() * 256,
      random() * 256,
      1 + random() * 3,
      1 + random() * 2,
    );
  }
  const soilTexture = new THREE.CanvasTexture(canvas);
  soilTexture.colorSpace = THREE.SRGBColorSpace;
  soilTexture.wrapS = soilTexture.wrapT = THREE.RepeatWrapping;
  const gravelMaterial = new THREE.MeshStandardMaterial({
    map: pebbles,
    vertexColors: true,
    roughness: 1,
  });
  const soilMaterial = new THREE.MeshStandardMaterial({
    map: soilTexture,
    vertexColors: true,
    roughness: 1,
  });
  const meshes = ([-1, 1] as const).map((side) => {
    const data = createBankData(side),
      g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    g.addGroup(0, data.gravelIndexCount, 0);
    g.addGroup(
      data.gravelIndexCount,
      data.indices.length - data.gravelIndexCount,
      1,
    );
    g.computeVertexNormals();
    return new THREE.Mesh(g, [gravelMaterial, soilMaterial]);
  });
  return {
    meshes,
    dispose() {
      for (const m of meshes) m.geometry.dispose();
      gravelMaterial.dispose();
      soilMaterial.dispose();
      soilTexture.dispose();
    },
  };
}
