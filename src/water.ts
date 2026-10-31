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
} from "three/tsl";

// The opaque scene (including the complete leaf) is captured before transparent water.
// Both captures are supported by WebGPURenderer and its WebGL2 backend.
export function createRiverWater(geometry: THREE.BufferGeometry) {
  const reflection = reflector({ resolutionScale: 0.5, bounces: false });
  const reflectionWeight = uniform(1);
  const refractionWeight = uniform(1);
  const eye = cameraPosition.sub(positionWorld).normalize();
  const fresnel = float(0.02037).add(
    float(0.97963).mul(float(1).sub(normalWorld.dot(eye).max(0)).pow(5)),
  );
  const refractedUV = screenUV
    .add(normalWorld.xz.mul(0.012))
    .clamp(0.001, 0.999);
  const below = viewportTexture(refractedUV).rgb.mul(vec3(0.72, 0.93, 0.9));
  const tint = vec3(0.12, 0.31, 0.29);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  material.outputNode = vec4(
    mix(
      mix(tint, below, refractionWeight),
      mix(tint, reflection.rgb, reflectionWeight),
      fresnel,
    ),
    1,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
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
