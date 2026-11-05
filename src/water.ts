import type Node from "three/src/nodes/core/Node.js";
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
  Fn,
  If,
  vec2,
  fract,
  floor,
  dot,
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
  const foamWeight = uniform(1);
  // Adapted from James's crest/FBM reference. Two noise octaves are evaluated
  // only on eligible crests; surface displacement remains shared with physics.
  const hash = (p: Node<"vec2">) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
  const noise = Fn(([p]: [Node<"vec2">]) => {
    const cell = floor(p), f = fract(p), u = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(mix(hash(cell), hash(cell.add(vec2(1, 0))), u.x),
      mix(hash(cell.add(vec2(0, 1))), hash(cell.add(vec2(1, 1))), u.x), u.y);
  });
  const foam = Fn(() => {
    const amount = float(0).toVar(), crest = attribute("aFoam", "float");
    If(frontFacing.and(crest.greaterThan(0.01)), () => {
      // Constant phase travels toward negative Z, downstream with the river.
      const flowZ = positionWorld.z.add(foamTime.mul(2.5));
      const p = vec2(positionWorld.x.mul(2.2).add(sin(flowZ.mul(.65)).mul(.3)), flowZ.mul(3.2));
      const turbulence = noise(p).mul(.7).add(noise(p.mul(2.03).add(vec2(7, 13))).mul(.3));
      const patches = smoothstep(.30, .74, turbulence);
      amount.assign(smoothstep(.12, .88, crest).mul(patches.mul(.6)).mul(foamWeight));
    });
    return amount;
  })();
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
  // Thin floating objects displace the foam layer. Use the existing scene depth
  // to retain their surface detail without changing their physical position.
  const foamDepth = positionView.z.sub(sceneZ).max(0)
    .mul(normalView.dot(positionView.normalize()).abs());
  const surfaceFoam = foam.mul(smoothstep(.1, .5, foamDepth));
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
    ), vec3(0.95, 0.98, 1), surfaceFoam),
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
    foamWeight,
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
