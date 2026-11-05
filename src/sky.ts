import { lightningAt } from "./lightning";
import { weatherAt } from "./weather";
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";

interface EarthSky {
  domes: THREE.Mesh[];
  setClouds(name: string, overrides?: Record<string, unknown>): void;
  uniforms: { cloudDisplacement: { value: THREE.Vector3 } };
  cloudTransitionInfo: { active: boolean };
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
  const nativeWebGPU = "isWebGPUBackend" in renderer.backend;
  const sampleBudget = nativeWebGPU ? 24 : 12;
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
  const highCacheSize = sampleBudget === 24 ? 256 : 128;
  const target = new THREE.CubeRenderTarget(highCacheSize, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const capture = new THREE.CubeCamera(.015, 120, target as unknown as ConstructorParameters<typeof THREE.CubeCamera>[2]);
  const skyGeometry = new THREE.SphereGeometry(80, 24, 12);
  const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const flash = TSL.uniform(0);
  const filterRadius = TSL.uniform(2 / highCacheSize);
  const rawDirection = TSL.positionWorld.sub(TSL.cameraPosition).normalize();
  // Stock WebGL fallback cube captures use the opposite vertical orientation.
  // Correct sampling so the upper hemisphere stays above the river on both backends.
  const direction = nativeWebGPU ? rawDirection : rawDirection.mul(TSL.vec3(1, -1, 1));
  let radiance = TSL.cubeTexture(target.texture, direction).rgb.mul(2);
  // Direction-space filtering crosses cube seams and avoids magnifying sparse
  // raymarch samples into hard blocks. No new render target or raymarch pass.
  for (const offset of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
    radiance = radiance.add(TSL.cubeTexture(target.texture,
      direction.add(TSL.vec3(...offset as [number,number,number]).mul(filterRadius))).rgb);
  }
  skyMaterial.colorNode = radiance.div(8).mul(flash.add(1));
  const backdrop = new THREE.Mesh(skyGeometry, skyMaterial); backdrop.frustumCulled = false;
  group.add(backdrop);
  let previousTime = -1;
  const stormClouds = { largeT: .12, largeA: 4, finalMul: .34, start: 550, height: 950,
    wispOn: .52, wispScale: .00096, wispThreshold: .36, wispStrength: .88, wispOpacity: 1.05,
    wispFilament: .32, wispStretch: [.4, .2, 2.18], wispTint: [.53, .60, .70] };
  let quality = 1, storm = false, lastCapture = -Infinity, captures = 0, cacheSize = highCacheSize;
  await renderer.compileAsync(earthScene, capture.children[0] as THREE.Camera);
  const viewerCamera = new THREE.PerspectiveCamera();
  return {
    group,
    update(time: number, viewer: { x: number; y: number; z: number }, offsetX: number, offsetZ: number, nextQuality: number) {
      quality = nextQuality;
      const nextCacheSize = quality < .75 ? highCacheSize / 2 : highCacheSize;
      if (cacheSize !== nextCacheSize) { cacheSize = nextCacheSize; filterRadius.value = 2 / cacheSize; target.setSize(cacheSize, cacheSize); lastCapture = -Infinity; }
      const weather = weatherAt(viewer.z, time);
      const nextStorm = weather.strength > .1;
      if (time < previousTime) {
        storm = nextStorm; earth.setClouds("cumulus", storm ? stormClouds : {});
      } else if (nextStorm !== storm) {
        storm = nextStorm; earth.transitionClouds("cumulus", 8, storm ? stormClouds : {});
      }
      previousTime = time;
      const shade = 1 - weather.strength * .65;
      earth.setColors({ cloud: [shade, shade, shade], sky: [shade, shade, shade] });
      flash.value = lightningAt(time, weather.strength).flash * 1.5;
      light.intensity = 5 * (1 - .7 * weather.strength) + flash.value * 3;
      group.position.set(viewer.x, viewer.y, viewer.z);
      viewerCamera.position.set(viewer.x, viewer.y, viewer.z);
      earth.update(time, viewerCamera);
      // Eanpa resets this value from its owned advection each update. Add the
      // game's integrated player-wind phase once, preserving direction changes.
      earth.uniforms.cloudDisplacement.value.x += offsetX;
      earth.uniforms.cloudDisplacement.value.z += offsetZ;
      if (time < lastCapture || time - lastCapture >= (quality < .75 ? .75 : .25)) {
        capture.position.copy(viewerCamera.position);
        capture.update(renderer as unknown as Parameters<THREE.CubeCamera["update"]>[0], earthScene);
        lastCapture = time; captures++;
      }
    },
    diagnostics: () => ({ sun: true,
      engine: "Eanpa-Sky", storm, transitionActive: earth.cloudTransitionInfo.active,
      cloudDisplacement: earth.uniforms.cloudDisplacement.value.toArray(), sampleBudget, cacheSize, captures, refreshSeconds: quality < .75 ? .75 : .25 }),
    dispose() { earth.dispose(); target.dispose(); skyGeometry.dispose(); skyMaterial.dispose(); group.clear(); },
  };
}
