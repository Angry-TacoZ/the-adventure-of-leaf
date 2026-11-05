import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";
import { createSky as createLightweightSky } from "./sky-lightweight";

interface EarthSky {
  domes: THREE.Mesh[];
  setClouds(name: string): void;
  update(time: number, camera: THREE.Camera): void;
  dispose(): void;
}
type SkyGlobals = typeof globalThis & {
  THREE?: unknown;
  EANPA_NO_MRT?: boolean;
  makeSkySystem?: (options: { scene: THREE.Scene; opts: Record<string, unknown> }) => Promise<EarthSky>;
};

/** Stock-Three adapter. Eanpa owns only sky resources, never the gameplay clock. */
export async function createSky(light: THREE.DirectionalLight) {
  const lightweight = createLightweightSky(light);
  const group = new THREE.Group(); group.name = "Earth sky";
  const earthScene = new THREE.Scene(); group.add(earthScene, lightweight.group);
  const globals = globalThis as SkyGlobals;
  const oldThree = globals.THREE, oldMrt = globals.EANPA_NO_MRT;
  let earth: EarthSky;
  try {
    globals.THREE = { ...THREE, ...TSL };
    globals.EANPA_NO_MRT = true; // Forward renderer has no Eanpa G-buffer outputs.
    // Pinned, unmodified MIT JavaScript; the interface above bounds its use.
    // @ts-expect-error upstream module has no TypeScript declarations
    await import("./vendor/eanpa/engine/sky_system.js");
    earth = await globals.makeSkySystem!({ scene: earthScene, opts: {
      hours: 13, clouds: "cumulus", domeRadius: 80,
      skySamples: 12, lightSamples: 3, stormSamples: 8, cloudPasses: 1,
      cloudShadowResolution: 64, cloudShadowSamples: 32,
    } });
  } finally {
    globals.THREE = oldThree; globals.EANPA_NO_MRT = oldMrt;
  }
  // Compress sky radiance locally; changing renderer tone mapping would also
  // regrade the already-approved hero and water materials.
  for (const dome of earth.domes) {
    const material = dome.material as THREE.MeshBasicNodeMaterial;
    if (material.colorNode) material.colorNode = TSL.toneMapping(THREE.ACESFilmicToneMapping, 1, material.colorNode);
  }
  let quality = 1;
  const viewerCamera = new THREE.PerspectiveCamera();
  return {
    group,
    update(time: number, viewer: { y: number; z: number }, offsetX: number, offsetZ: number, nextQuality: number) {
      quality = nextQuality;
      earthScene.visible = quality >= .75; lightweight.group.visible = quality < .75;
      lightweight.update(time, viewer, offsetX, offsetZ, quality);
      viewerCamera.position.set(0, viewer.y, viewer.z);
      earth.update(time, viewerCamera);
    },
    diagnostics: () => ({ sun: true, cloudPuffs: quality < .75 ? 32 : 64,
      engine: quality < .75 ? "lightweight-earth-compatibility" : "Eanpa-Sky", sampleBudget: quality < .75 ? 0 : 12 }),
    dispose() { earth.dispose(); lightweight.dispose(); group.clear(); },
  };
}
