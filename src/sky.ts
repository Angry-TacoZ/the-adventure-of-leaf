import { weatherAt } from "./weather";
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";

interface EarthSky {
  domes: THREE.Mesh[];
  setClouds(name: string): void;
  transitionClouds(name: string, duration: number, overrides?: Record<string, unknown>): void;
  setColors(colors: { cloud: number[]; sky: number[] }): void;
  update(time: number, camera: THREE.Camera): void;
  dispose(): void;
}
type SkyGlobals = typeof globalThis & {
  THREE?: unknown;
  EANPA_NO_MRT?: boolean;
  makeSkySystem?: (options: { scene: THREE.Scene; opts: Record<string, unknown> }) => Promise<EarthSky>;
};

/** Stock-Three adapter. Eanpa owns only sky resources, never the gameplay clock. */
export async function createSky(light: THREE.DirectionalLight, renderer: THREE.WebGPURenderer) {
  light.position.set(-12, 18, -55); light.intensity = 5;
  const group = new THREE.Group(); group.name = "Earth sky";
  const earthScene = new THREE.Scene();
  const globals = globalThis as SkyGlobals;
  const oldThree = globals.THREE, oldMrt = globals.EANPA_NO_MRT;
  const sampleBudget = "isWebGPUBackend" in renderer.backend ? 24 : 12;
  let earth: EarthSky;
  try {
    globals.THREE = { ...THREE, ...TSL };
    globals.EANPA_NO_MRT = true; // Forward renderer has no Eanpa G-buffer outputs.
    // Pinned, unmodified MIT JavaScript; the interface above bounds its use.
    // @ts-expect-error upstream module has no TypeScript declarations
    await import("./vendor/eanpa/engine/sky_system.js");
    earth = await globals.makeSkySystem!({ scene: earthScene, opts: {
      hours: 13, clouds: "cumulus", domeRadius: 80,
      skySamples: sampleBudget, lightSamples: sampleBudget === 24 ? 8 : 3, stormSamples: 8, cloudPasses: 1,
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
  // Capture distant radiance once, rather than raymarching clouds again in
  // every water/refraction/scene pass. Cube directions preserve reflections.
  const target = new THREE.CubeRenderTarget(256, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const capture = new THREE.CubeCamera(.015, 120, target as unknown as ConstructorParameters<typeof THREE.CubeCamera>[2]);
  const skyGeometry = new THREE.SphereGeometry(80, 24, 12);
  const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMaterial.colorNode = TSL.cubeTexture(target.texture, TSL.positionWorld.sub(TSL.cameraPosition).normalize());
  const backdrop = new THREE.Mesh(skyGeometry, skyMaterial); backdrop.frustumCulled = false;
  group.add(backdrop);
  let quality = 1, storm = false, lastCapture = -Infinity, captures = 0, cacheSize = 256;
  await renderer.compileAsync(earthScene, capture.children[0] as THREE.Camera);
  const viewerCamera = new THREE.PerspectiveCamera();
  return {
    group,
    update(time: number, viewer: { y: number; z: number }, offsetX: number, offsetZ: number, nextQuality: number) {
      quality = nextQuality;
      const nextCacheSize = quality < .75 ? 128 : 256;
      if (cacheSize !== nextCacheSize) { cacheSize = nextCacheSize; target.setSize(cacheSize, cacheSize); lastCapture = -Infinity; }
      const weather = weatherAt(viewer.z, time);
      const nextStorm = weather.strength > .1;
      if (nextStorm !== storm) { storm = nextStorm; earth.transitionClouds("cumulus", 8, storm ? {
        // Earth storm density subset from pinned Eanpa weather_system.js.
        largeT: .12, largeA: 4, finalMul: .34, start: 550, height: 950,
        wispOn: .52, wispScale: .00096, wispThreshold: .36,
        wispStrength: .88, wispOpacity: 1.05, wispFilament: .32,
        wispStretch: [.4, .2, 2.18], wispTint: [.53, .60, .70],
      } : {}); }
      const shade = 1 - weather.strength * .65;
      earth.setColors({ cloud: [shade, shade, shade], sky: [shade, shade, shade] });
      light.intensity = 5 * (1 - .7 * weather.strength);
      group.position.set(0, viewer.y, viewer.z);
      viewerCamera.position.set(0, viewer.y, viewer.z);
      earth.update(time, viewerCamera);
      if (time < lastCapture || time - lastCapture >= (quality < .75 ? .75 : .25)) {
        capture.position.copy(viewerCamera.position);
        capture.update(renderer as unknown as Parameters<THREE.CubeCamera["update"]>[0], earthScene);
        lastCapture = time; captures++;
      }
    },
    diagnostics: () => ({ sun: true,
      engine: "Eanpa-Sky", sampleBudget, cacheSize, captures, refreshSeconds: quality < .75 ? .75 : .25 }),
    dispose() { earth.dispose(); target.dispose(); skyGeometry.dispose(); skyMaterial.dispose(); group.clear(); },
  };
}
