import * as THREE from "three";
import {
  defaults,
  initial,
  step,
  surface,
  current,
  flowField,
  obstacle,
  type Params,
} from "./simulation";
import "./style.css";
const app = document.querySelector<HTMLDivElement>("#app")!,
  diag = document.querySelector<HTMLOutputElement>("#diagnostics")!;
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
} catch {
  document.querySelector("#error")!.textContent =
    "WebGL is unavailable. Update your graphics driver or try a browser with WebGL2 enabled.";
  throw new Error("WebGL renderer unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa7c8ba);
scene.fog = new THREE.Fog(0xa7c8ba, 25, 65);
const camera = new THREE.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.1,
  120,
);
scene.add(new THREE.HemisphereLight(0xd9eff0, 0x455337, 2));
const sun = new THREE.DirectionalLight(0xffefcc, 2);
sun.position.set(-6, 14, 8);
scene.add(sun);
const p: Params = { ...defaults };
let state = initial();
camera.position.set(
  state.x,
  state.y + p.cameraHeight,
  state.z + p.cameraDistance,
);
const keys = new Set<string>();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x586f49, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.42;
scene.add(ground);
// Temporary sculpted banks, independently generated geometry.
for (const side of [-1, 1]) {
  const bank = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.1, 65),
    new THREE.MeshStandardMaterial({ color: 0x71865b, roughness: 1 }),
  );
  bank.position.set(side * 6.7, 0.05, -12);
  bank.rotation.z = side * 0.04;
  scene.add(bank);
  for (let i = 0; i < 18; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25 + (i % 4) * 0.13, 0),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x758078 : 0x879080,
        roughness: 1,
      }),
    );
    rock.position.set(side * (4.45 + (i % 3) * 0.5), 0.35, -i * 2.8 + 6);
    rock.scale.set(1.3, 0.65, 1);
    scene.add(rock);
  }
}
const rock = new THREE.Mesh(
  new THREE.DodecahedronGeometry(obstacle.r, 1),
  new THREE.MeshStandardMaterial({ color: 0x77847e, roughness: 0.95 }),
);
rock.position.set(obstacle.x, 0.32, obstacle.z);
rock.scale.set(1, 0.75, 1);
scene.add(rock);
const foam = new THREE.Mesh(
  new THREE.RingGeometry(1.1, 1.22, 48),
  new THREE.MeshBasicMaterial({
    color: 0xd1e4cb,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
);
foam.rotation.x = -Math.PI / 2;
foam.position.set(obstacle.x, 0.08, obstacle.z);
scene.add(foam);
const geometry = new THREE.PlaneGeometry(8.3, 65, 70, 240);
geometry.rotateX(-Math.PI / 2);
geometry.translate(0, 0, -12);
const water = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({
    color: 0x3f8c8d,
    roughness: 0.26,
    metalness: 0.16,
    side: THREE.DoubleSide,
  }),
);
scene.add(water);
const leaf = new THREE.Group();
const shape = new THREE.Shape();
shape.moveTo(0, 0.95);
shape.bezierCurveTo(0.75, 0.45, 0.65, -0.5, 0, -0.9);
shape.bezierCurveTo(-0.65, -0.5, -0.75, 0.45, 0, 0.95);
const blade = new THREE.Mesh(
  new THREE.ShapeGeometry(shape, 16),
  new THREE.MeshStandardMaterial({
    color: 0xb5aa45,
    roughness: 0.8,
    side: THREE.DoubleSide,
  }),
);
blade.rotation.x = -Math.PI / 2;
leaf.add(blade);
const vein = new THREE.Mesh(
  new THREE.BoxGeometry(0.025, 0.02, 1.6),
  new THREE.MeshStandardMaterial({ color: 0x6f7235 }),
);
vein.position.y = 0.01;
leaf.add(vein);
leaf.scale.setScalar(0.48);
scene.add(leaf);
const clock = new THREE.Clock();
let accumulator = 0,
  lastRender = 0,
  frameMs = 16,
  manual =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("testMode") === "manual";
let frames = 0;
const profiling = new URLSearchParams(location.search).has("profile");
const samples: {
  frame: number;
  deform: number;
  normals: number;
  render: number;
}[] = [];
const cameraTarget = new THREE.Vector3();
function input() {
  let x =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  let z =
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
    (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  let raise = keys.has("e") ? 1 : 0,
    lower = keys.has("q") ? 1 : 0;
  const gp = navigator
    .getGamepads?.()
    ?.find((g) => g?.connected && g.mapping === "standard");
  if (gp) {
    const ax = gp.axes[0] || 0,
      az = gp.axes[1] || 0,
      mag = Math.hypot(ax, az);
    if (mag > p.deadzone) {
      const norm = Math.pow(
        Math.min(1, (mag - p.deadzone) / (1 - p.deadzone)),
        p.windCurve,
      );
      x = (ax / mag) * norm;
      z = (az / mag) * norm;
    }
    raise = Math.max(raise, gp.buttons[7]?.value || 0);
    lower = Math.max(lower, gp.buttons[6]?.value || 0);
  }
  const m = Math.hypot(x, z);
  if (m > 1) {
    x /= m;
    z /= m;
  }
  return { x, z, raise, lower, gamepad: !!gp };
}
function update(dt: number) {
  step(state, p, input(), dt);
}
function render(dt: number) {
  const started = performance.now();
  const attr = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++)
    attr.setY(
      i,
      surface(
        attr.getX(i),
        attr.getZ(i),
        state.time,
        p,
        state.intensity,
        state.windX,
        state.windZ,
      ),
    );
  attr.needsUpdate = true;
  const deformed = performance.now();
  geometry.computeVertexNormals();
  const normals = performance.now();
  foam.position.y =
    surface(
      obstacle.x + obstacle.r,
      obstacle.z,
      state.time,
      p,
      state.intensity,
      state.windX,
      state.windZ,
    ) + 0.035;
  leaf.position.set(state.x, state.y, state.z);
  const eps = 0.15;
  leaf.rotation.z =
    Math.atan2(
      surface(
        state.x + eps,
        state.z,
        state.time,
        p,
        state.intensity,
        state.windX,
        state.windZ,
      ) -
        surface(
          state.x - eps,
          state.z,
          state.time,
          p,
          state.intensity,
          state.windX,
          state.windZ,
        ),
      2 * eps,
    ) * p.alignment;
  leaf.rotation.x =
    -Math.atan2(
      surface(
        state.x,
        state.z + eps,
        state.time,
        p,
        state.intensity,
        state.windX,
        state.windZ,
      ) -
        surface(
          state.x,
          state.z - eps,
          state.time,
          p,
          state.intensity,
          state.windX,
          state.windZ,
        ),
      2 * eps,
    ) * p.alignment;
  leaf.rotation.y = Math.sin(state.time * 0.6) * 0.18 + state.vx * 0.3;
  cameraTarget.set(
    state.x,
    state.y + p.cameraHeight,
    state.z + p.cameraDistance,
  );
  camera.position.lerp(cameraTarget, 1 - Math.exp(-p.cameraSmoothing * dt));
  camera.lookAt(state.x, state.y + p.cameraAngle, state.z - 3);
  renderer.setPixelRatio(Math.min(devicePixelRatio, p.quality));
  const renderStart = performance.now();
  renderer.render(scene, camera);
  if (profiling) {
    samples.push({
      frame: lastInterval,
      deform: deformed - started,
      normals: normals - deformed,
      render: performance.now() - renderStart,
    });
    if (samples.length > 600) samples.shift();
  }
  const control = input();
  diag.textContent = `WebGL2 · ${Math.round(1000 / frameMs)} fps · ${frameMs.toFixed(1)} ms\ncurrent ${current(state.x, state.z, state.time, p).toFixed(2)} · wind ${state.windX.toFixed(2)}, ${state.windZ.toFixed(2)} × ${state.intensity.toFixed(2)}\nleaf velocity ${state.vx.toFixed(2)}, ${state.vz.toFixed(2)} · ${control.gamepad ? "gamepad" : "keyboard / no standard gamepad"}`;
}
let lastInterval = 0;
function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, clock.getDelta());
  lastInterval = lastRender ? now - lastRender : 16;
  frames++;
  frameMs = frameMs * 0.92 + lastInterval * 0.08;
  lastRender = now;
  if (!manual) {
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      update(1 / 120);
      accumulator -= 1 / 120;
    }
  }
  render(dt);
}
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    e.preventDefault();
  if (e.key.toLowerCase() === "r") state = initial();
  if (e.key.toLowerCase() === "f") {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void app.requestFullscreen();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "x right, z downstream is negative, y up",
    ...state,
    current: current(state.x, state.z, state.time, p),
    obstacle,
    renderer: "WebGL2",
    gamepad: input().gamepad,
    flow: flowField(state.x, state.z, state.time, p),
    camera: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    frames,
    manual,
    profile: samples,
    waterHeights: [
      surface(0, -4, state.time, p, state.intensity, state.windX, state.windZ),
      surface(1, -4, state.time, p, state.intensity, state.windX, state.windZ),
    ],
  });
if (manual)
  window.advanceTime = (ms: number) => {
    const count = Math.ceil(ms / (1000 / 120));
    for (let i = 0; i < count; i++) update(ms / 1000 / count);
    render(ms / 1000);
  };
if (import.meta.env.DEV) {
  void import("lil-gui").then(({ default: GUI }) => {
    const gui = new GUI({ title: "River tuning · development" });
    const waterFolder = gui.addFolder("Water / current");
    waterFolder.add(p, "current", 0.2, 2.5, 0.01);
    waterFolder.add(p, "variation", 0, 0.8, 0.01);
    waterFolder.add(p, "turbulence", 0, 1, 0.01);
    waterFolder.add(p, "ripple", 0, 0.4, 0.01);
    waterFolder.add(p, "damping", 0, 1, 0.01);
    waterFolder.add(p, "quality", 0.5, 2, 0.1);
    const phys = gui.addFolder("Wind / leaf");
    phys.add(p, "deadzone", 0, 0.4, 0.01);
    phys.add(p, "windCurve", 0.4, 3, 0.1);
    phys.add(p, "windStrength", 0, 2, 0.01);
    phys.add(p, "windResponse", 0.1, 5, 0.1);
    phys.add(p, "drag", 0.1, 5, 0.1);
    phys.add(p, "buoyancy", 1, 20, 0.1);
    phys.add(p, "alignment", 0, 8, 0.1);
    const cam = gui.addFolder("Camera");
    cam.add(p, "cameraDistance", 3, 15, 0.1);
    cam.add(p, "cameraHeight", 1, 10, 0.1);
    cam.add(p, "cameraAngle", -1, 4, 0.1);
    cam.add(p, "cameraSmoothing", 0.2, 10, 0.1);
    const presets = {
      save: () => localStorage.setItem("leaf-tuning", JSON.stringify(p)),
      load: () => {
        try {
          const saved = JSON.parse(localStorage.getItem("leaf-tuning") || "{}");
          for (const key of Object.keys(defaults) as (keyof Params)[])
            if (typeof saved[key] === "number" && Number.isFinite(saved[key]))
              p[key] = saved[key];
          gui.controllersRecursive().forEach((c) => c.updateDisplay());
        } catch {
          console.warn("Saved tuning is invalid");
        }
      },
      reset: () => {
        Object.assign(p, defaults);
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      },
    };
    gui.add(presets, "save").name("Save local preset");
    gui.add(presets, "load").name("Load local preset");
    gui.add(presets, "reset").name("Reset tuning");
    gui.close();
  });
}
requestAnimationFrame(loop);
