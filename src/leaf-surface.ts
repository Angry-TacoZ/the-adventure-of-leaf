import * as THREE from "three/webgpu";

/** Shared hero surface: botanical detail is independent of Rapier topology. */
export function createLeafSurface() {
  let loaded!: () => void, failed!: (reason: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    loaded = resolve;
    failed = reject;
  });
  let disposed = false;
  let fallback = false;
  const material = new THREE.MeshStandardMaterial({
    color: 0xb5aa45,
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const albedo = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}assets/yellow-birch-hero-albedo.png`,
    () => {
      if (!disposed && !fallback) {
        height.needsUpdate = true;
        material.map = albedo;
        material.bumpMap = height;
        material.bumpScale = 0.0008;
        material.color.setHex(0xffffff);
        material.needsUpdate = true;
      }
      loaded();
    },
    undefined,
    (reason) => {
      if (disposed || fallback) loaded();
      else failed(reason);
    },
  );
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 4;
  // The same authored vein pattern provides subtle relief without changing physics.
  const height = albedo.clone();
  height.colorSpace = THREE.NoColorSpace;
  return {
    material,
    ready,
    useFallback() {
      if (disposed) return;
      fallback = true;
      material.map = null;
      material.bumpMap = null;
      material.color.setHex(0xb5aa45);
      material.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      material.dispose();
      albedo.dispose();
      height.dispose();
    },
  };
}
