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
  attribute,
  frontFacing,
  sin,
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
  const foamTime = uniform(0);
  const flecks = sin(positionWorld.x.mul(17).add(positionWorld.z.mul(11)).add(foamTime.mul(3)))
    .mul(sin(positionWorld.x.mul(9).sub(positionWorld.z.mul(15)).add(foamTime.mul(1.9)))).mul(0.5).add(0.5);
  const foam = frontFacing.select(smoothstep(0.3, 0.95, attribute("aFoam", "float"))
    .mul(smoothstep(0.6, 0.85, flecks)).mul(0.45), float(0));
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
    frontFacing.select(float(1 / 1.333), float(1.333)),
  );
  const reflectionMix = ray.length().lessThan(0.001).select(float(1), fresnel);
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
  // Millimetre-scale contact matters for the paper-thin hero. A centimetres-wide
  // depth tolerance pulled isolated gold slivers across nearby rock silhouettes.
  // Fall back to the undistorted capture at these discontinuities, retaining the
  // submerged leaf rather than discarding water or lifting the physics surface.
  const continuity = float(1).sub(
    smoothstep(0.002, 0.01, safeZ.sub(sceneZ).abs()),
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
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  material.outputNode = vec4(
    mix(mix(
      benchmark === "no-depth"
        ? viewportTexture(screenUV).rgb
        : benchmark === "no-color"
          ? tint
          : mix(tint, below, refractionWeight),
      benchmark === "no-reflection"
        ? tint
        : mix(tint, reflection.rgb, reflectionWeight),
      reflectionMix,
    ), vec3(0.78, 0.87, 0.81), foam),
    1,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  if (benchmark === "no-water") mesh.visible = false;
  // Bias the flat reflection plane above the mean waterline. The animated
  // surface otherwise exposes a strip of reflected sky where it meets a bank.
  // Local Z maps to world Y after the water mesh is rotated.
  reflection.target.position.z = 0.12;
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
    setSurfaceFrame(height: number, z: number, slope: number, viewer: { y: number; z: number }, time: number) {
      foamTime.value = time;
      mesh.position.y = height;
      reflection.target.position.y = -z;
      // Capture the viewed side rather than clearing the reflection below its plane.
      const below = viewer.y < height + 0.12 + slope * (viewer.z - z);
      reflection.target.rotation.x = -Math.atan(slope) + (below ? Math.PI : 0);
    },
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
