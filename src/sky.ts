import * as THREE from "three/webgpu";
import { Rng } from "./vendor/seedthree/rng.js";

/** Distant daytime sky; its clock/advection come from the simulation. */
export function createSky(light: THREE.DirectionalLight) {
  const group = new THREE.Group(); group.name = "Headwaters sky";
  // Match the visible disk and directional light. The grazing sun is brighter
  // to retain the established illumination of the horizontal hero surface.
  light.position.set(-12, 18, -55); light.intensity = 5;
  const sunGeometry = new THREE.SphereGeometry(1.1, 20, 12);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffefcc, fog: false });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.copy(light.position).multiplyScalar(1.8); group.add(sun);
  const cloudGeometry = new THREE.SphereGeometry(1, 12, 8);
  const cloudColors: number[] = [];
  const shade = new THREE.Color(), bottom = new THREE.Color(0xb9c8c7), top = new THREE.Color(0xfffdf0);
  const points = cloudGeometry.getAttribute("position");
  for (let i = 0; i < points.count; i++) {
    shade.copy(bottom).lerp(top, (points.getY(i) + 1) / 2);
    cloudColors.push(shade.r, shade.g, shade.b);
  }
  cloudGeometry.setAttribute("color", new THREE.Float32BufferAttribute(cloudColors, 3));
  // Distant diffuse cloud light is independent of the green ground hemisphere.
  const cloudMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, 64);
  clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  clouds.frustumCulled = false;
  group.add(clouds);
  const rng = new Rng("appalachian-headwater-clouds");
  const puffs = Array.from({ length: 16 }, () => {
    const x = rng.range(-85, 85), y = rng.range(19, 25), z = rng.range(-95, -50);
    return Array.from({ length: 4 }, (_, i) => ({
      x: x + i * 2.5, y: y + rng.range(-0.4, 0.9) + (i === 1 ? 1 : 0), z: z + rng.range(-2, 2),
      sx: rng.range(2.8, 4.2), sy: rng.range(1.3, 2.2), sz: rng.range(2, 3.2),
    }));
  }).flat();
  const matrix = new THREE.Matrix4();
  return {
    group,
    update(time: number, viewer: { y: number; z: number }, offsetX: number, offsetZ: number, quality: number) {
      // Treat the sky as distant: falling/travel does not drag it through trees.
      group.position.set(0, viewer.y, viewer.z);
      clouds.count = quality < 0.75 ? 32 : 64;
      for (let i = 0; i < clouds.count; i++) {
        const puff = puffs[i];
        const x = ((puff.x + time * 0.15 + offsetX * 0.08 + 100) % 200 + 200) % 200 - 100;
        matrix.makeScale(puff.sx, puff.sy, puff.sz);
        matrix.setPosition(x, puff.y, THREE.MathUtils.clamp(puff.z + offsetZ * 0.05, -98, -45));
        clouds.setMatrixAt(i, matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
    diagnostics: () => ({ sun: true, cloudPuffs: clouds.count }),
    dispose() {
      clouds.dispose(); cloudGeometry.dispose(); cloudMaterial.dispose();
      sunGeometry.dispose(); sunMaterial.dispose(); group.clear();
    },
  };
}
