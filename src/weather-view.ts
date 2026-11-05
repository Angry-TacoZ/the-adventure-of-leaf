import * as THREE from "three/webgpu";
import { weatherAt } from "./weather";

/** Fixed-allocation rain presentation. Simulation time owns animation. */
export function createWeatherView() {
  const positions = new Float32Array(384 * 6);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3); attribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", attribute);
  const material = new THREE.LineBasicMaterial({ color: 0xc5d8e5, transparent: true, opacity: 0, depthWrite: false });
  const group = new THREE.LineSegments(geometry, material); group.name = "Valley rain"; group.frustumCulled = false;
  let count = 0, strength = 0;
  return {
    group,
    update(time: number, viewer: { x: number; y: number; z: number }, quality: number) {
      const weather = weatherAt(viewer.z, time); strength = weather.rain;
      count = Math.floor((quality < .75 ? 128 : 384) * strength);
      geometry.setDrawRange(0, count * 2); group.visible = count > 0; material.opacity = strength * .4;
      group.position.set(viewer.x, viewer.y, viewer.z);
      for (let i = 0; i < count; i++) {
        const x = ((i * 7.319) % 20) - 10, z = ((i * 3.173) % 20) - 10;
        const y = ((i * .719 - time * 8) % 9 + 9) % 9 - .5;
        const j = i * 6;
        positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
        positions[j + 3] = x - .1 - weather.gustX; positions[j + 4] = y + .45; positions[j + 5] = z - weather.gustZ;
      }
      attribute.needsUpdate = true;
    },
    diagnostics: () => ({ rainSegments: count, strength, allocatedSegments: 384 }),
    dispose() { geometry.dispose(); material.dispose(); group.clear(); },
  };
}
