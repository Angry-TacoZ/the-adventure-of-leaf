import * as THREE from "three/webgpu";
import { createForest } from "../src/forest.ts";

const renderer = new THREE.WebGPURenderer({
  forceWebGL: new URLSearchParams(location.search).has("forceWebGL"), antialias: true,
});
await renderer.init();
window.forestBackend = "isWebGPUBackend" in renderer.backend ? "WebGPU" : "WebGL2";
renderer.setSize(900, 700); document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xa7c8ba);
scene.add(new THREE.HemisphereLight(0xffffff, 0x455337, 2));
const sun = new THREE.DirectionalLight(0xffefcc, 2); sun.position.set(-6, 14, 8); scene.add(sun);
const camera = new THREE.PerspectiveCamera(48, 900 / 700, 0.1, 120);
camera.position.set(0, 3, 20); camera.lookAt(9, 6, 0);
renderer.render(scene, camera);
window.emptyForestResources = { ...renderer.info.memory };
const forest = createForest(); scene.add(forest.group);
window.drawForest = (time, wind, viewerZ = 0) => {
  forest.update(time, wind, 0, 1, 1, viewerZ); renderer.render(scene, camera);
};
window.forestDiagnostics = () => forest.diagnostics();
window.forestResources = () => ({ ...renderer.info.memory });
window.disposeForest = () => { forest.dispose(); scene.remove(forest.group); renderer.render(scene, camera); };
window.drawForest(0, 0);
