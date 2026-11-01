import * as THREE from "three/webgpu";
import {
  reflector,
  viewportTexture,
  screenUV,
  normalWorld,
  positionWorld,
  cameraPosition,
  float,
  vec3,
  vec4,
  mix,
  uniform,
  viewportDepthTexture,
  perspectiveDepthToViewZ,
  cameraNear,
  cameraFar,
  positionView,
  normalView,
  refract,
  getScreenPosition,
  cameraProjectionMatrix,
  smoothstep,
} from "three/tsl";

// The opaque scene (including the complete leaf) is captured before transparent water.
// Both captures are supported by WebGPURenderer and its WebGL2 backend.
export function createRiverWater(geometry: THREE.BufferGeometry) {
  const benchmark = import.meta.env.DEV
    ? new URLSearchParams(location.search).get("waterBenchmark")
    : null;
  const reflection = reflector({ resolutionScale: 0.5, bounces: false });
  // Benchmark-only: match the legacy renderer's fixed 512-square capture.
  if (benchmark) {
    const base = reflection.reflector as unknown as {
      _updateResolution: (target: THREE.RenderTarget) => void;
    };
    base._updateResolution = (target) => target.setSize(512, 512);
  }
  const reflectionWeight = uniform(1);
  const refractionWeight = uniform(1);
  const eye = cameraPosition.sub(positionWorld).normalize();
  const fresnel = float(0.02037).add(
    float(0.97963).mul(float(1).sub(normalWorld.dot(eye).max(0)).pow(5)),
  );
  const absorption = uniform(new THREE.Vector3(0.35, 0.12, 0.08));
  const tint = vec3(0.12, 0.31, 0.29);
  // Share one viewport depth capture across all depth samples in the same pass.
  const sceneDepth = viewportDepthTexture();
  const sceneZ = perspectiveDepthToViewZ(sceneDepth, cameraNear, cameraFar);
  const ray = refract(
    positionView.normalize(),
    normalView.normalize(),
    float(1 / 1.333),
  );
  // One depth-guided projected Snell step. This is bounded screen-space refraction.
  const path = positionView.z
    .sub(sceneZ)
    .max(0)
    .div(ray.z.negate().max(0.1))
    .min(3);
  const projected = getScreenPosition(
    positionView.add(ray.mul(path)),
    cameraProjectionMatrix,
  );
  const edge = smoothstep(0, 0.03, projected.x)
    .mul(smoothstep(0, 0.03, projected.y))
    .mul(float(1).sub(smoothstep(0.97, 1, projected.x)))
    .mul(float(1).sub(smoothstep(0.97, 1, projected.y)));
  const offset = projected.sub(screenUV);
  const bounded = screenUV.add(
    offset.mul(float(0.015).div(offset.length().max(0.015))),
  );
  const candidateUV = mix(screenUV, bounded, edge);
  const candidateZ = perspectiveDepthToViewZ(
    sceneDepth.sample(candidateUV),
    cameraNear,
    cameraFar,
  );
  // A less-negative view-space Z is in front of the water surface.
  // Reject it exactly as viewportSafeUV does, while sharing the depth capture.
  const foreground = candidateZ.greaterThan(positionView.z);
  const safeUV = foreground.select(screenUV, candidateUV);
  const safeZ = foreground.select(sceneZ, candidateZ);
  const continuity = float(1).sub(
    smoothstep(0.03, 0.1, safeZ.sub(sceneZ).abs()),
  );
  const refractedUV = mix(screenUV, safeUV, continuity);
  const sampledZ = perspectiveDepthToViewZ(
    sceneDepth.sample(refractedUV),
    cameraNear,
    cameraFar,
  );
  const opticalPath = positionView.z
    .sub(sampledZ)
    .max(0)
    .div(ray.z.negate().max(0.1))
    .min(3);
  const transmission = absorption.mul(opticalPath).negate().exp();
  const below = viewportTexture(refractedUV)
    .rgb.mul(transmission)
    .add(tint.mul(vec3(1).sub(transmission)));
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  material.outputNode = vec4(
    mix(
      benchmark === "no-depth"
        ? viewportTexture(screenUV).rgb
        : benchmark === "no-color"
          ? tint
          : mix(tint, below, refractionWeight),
      benchmark === "no-reflection"
        ? tint
        : mix(tint, reflection.rgb, reflectionWeight),
      fresnel,
    ),
    1,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  if (benchmark === "no-water") mesh.visible = false;
  mesh.add(reflection.target);
  let captures = 0;
  mesh.onBeforeRender = () => {
    captures++;
  };
  return {
    mesh,
    material,
    reflectionWeight,
    refractionWeight,
    absorption,
    setQuality(value: number) {
      reflection.reflector.resolutionScale =
        0.5 * Math.min(1, Math.max(0.25, value));
    },
    diagnostics: () => ({
      mode: "node-planar-reflection-and-screen-refraction",
      captures,
      size: (reflection.value.image as { width: number }).width,
      height: (reflection.value.image as { height: number }).height,
    }),
  };
}
