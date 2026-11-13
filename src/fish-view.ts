import * as THREE from "three/webgpu";
import type { FishFrame } from "./fish-motion";
import { FISH_COUNT } from "./fish-motion";
import { Rng } from "./vendor/seedthree/rng.js";

/** Original stylized brook-trout models; transforms come only from Rapier. */
export function createFishView() {
  const group = new THREE.Group(); group.name = "Headwaters brook trout";
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "#455a35"); gradient.addColorStop(0.55, "#9a995d"); gradient.addColorStop(1, "#e6bd82");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 128);
  const rng = new Rng("brook-trout-markings");
  for (let i = 0; i < 95; i++) {
    const x = rng.range(0, 256), y = rng.range(8, 88);
    ctx.fillStyle = i % 4 ? "#d9d49a" : "#6d91a4";
    ctx.beginPath(); ctx.ellipse(x, y, 2.3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    if (i % 4 === 0) { ctx.fillStyle = "#c16046"; ctx.fillRect(x - 1, y - 1, 2, 2); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const bodyMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55 });
  const finMaterial = new THREE.MeshStandardMaterial({ color: 0xd29a65, roughness: 0.7, side: THREE.DoubleSide });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x17231b });
  const bodyGeometry = new THREE.SphereGeometry(1, 18, 12);
  const eyeGeometry = new THREE.SphereGeometry(0.009, 8, 6);
  const tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 0, 0.075, -0.11, 0, 0, -0.075,
    0, 0, 0, 0, 0, -0.075, 0, -0.075, -0.11,
  ], 3)); tailGeometry.computeVertexNormals();
  const finGeometry = new THREE.BufferGeometry();
  finGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.08, -0.015, -0.08, 0, 0, -0.09], 3));
  finGeometry.computeVertexNormals();
  const fish = Array.from({ length: FISH_COUNT }, (_, id) => {
    const root = new THREE.Group(); root.name = `Brook trout ${id + 1}`;
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial); body.scale.set(0.055, 0.065, 0.22); root.add(body);
    const tail = new THREE.Mesh(tailGeometry, finMaterial); tail.position.z = -0.2; root.add(tail);
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeometry, finMaterial); fin.scale.x = side; fin.position.set(side * 0.035, -0.025, 0.05); root.add(fin);
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial); eye.position.set(side * 0.04, 0.025, 0.145); root.add(eye);
    }
    group.add(root); return { root, tail };
  });
  return {
    group,
    update(frames: readonly FishFrame[], time: number) {
      for (const frame of frames) {
        const model = fish[frame.id];
        model.root.position.copy(frame.position);
        model.root.quaternion.copy(frame.orientation);
        model.tail.rotation.y = Math.sin(time * 9 + frame.id) * 0.35;
      }
    },
    diagnostics: () => ({ species: "Salvelinus fontinalis", count: fish.length }),
    dispose() {
      for (const g of [bodyGeometry, eyeGeometry, tailGeometry, finGeometry]) g.dispose();
      bodyMaterial.dispose(); finMaterial.dispose(); eyeMaterial.dispose(); texture.dispose(); group.clear();
    },
  };
}
