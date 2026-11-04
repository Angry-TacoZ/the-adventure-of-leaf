import * as THREE from "three/webgpu";

/** Shared hero surface: botanical detail is independent of Rapier topology. */
export function createLeafSurface() {
  let loaded!: () => void, failed!: (reason: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    loaded = resolve;
    failed = reject;
  });
  let disposed = false;
  const albedo = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}assets/yellow-birch-hero-albedo.png`,
    () => {
      if (!disposed) height.needsUpdate = true;
      loaded();
    },
    undefined,
    failed,
  );
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = 4;
  // The same authored vein pattern provides subtle relief without changing physics.
  const height = albedo.clone();
  height.colorSpace = THREE.NoColorSpace;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: albedo,
    bumpMap: height,
    bumpScale: 0.0008,
    roughness: 0.76,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return {
    material,
    ready,
    dispose() {
      disposed = true;
      material.dispose();
      albedo.dispose();
      height.dispose();
    },
  };
}
