import * as THREE from "three";
import { createSoftLeafPrototype } from "./rapier-leaf-prototype";

const physics = await createSoftLeafPrototype();
physics.world.gravity = { x: 0, y: 0, z: 0 };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7c8ba);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 4, 3); camera.lookAt(0, 1, 0);
const geometry = new THREE.BufferGeometry();
const positions = new THREE.BufferAttribute(new Float32Array(physics.body.particlePositions()), 3);
geometry.setAttribute("position", positions); geometry.setIndex(new THREE.BufferAttribute(physics.indices, 1));
geometry.computeVertexNormals();
scene.add(new THREE.Mesh(geometry, new THREE.MeshNormalMaterial({ side: THREE.DoubleSide })));
physics.body.applyParticleImpulse(0, { x: 0, y: 0.003, z: 0 }, true);
let previous = performance.now(), accumulator = 0;
function animate(now: number) {
  accumulator += Math.min((now - previous) / 1000, 0.05); previous = now;
  while (accumulator >= 1 / 120) { physics.step(); accumulator -= 1 / 120; }
  positions.array.set(physics.body.particlePositions()); positions.needsUpdate = true;
  geometry.computeVertexNormals(); renderer.render(scene, camera); requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
window.addEventListener("pagehide", () => { physics.dispose(); geometry.dispose(); renderer.dispose(); }, { once: true });
