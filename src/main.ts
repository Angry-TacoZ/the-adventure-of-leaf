import { onFinalPageHide } from "./lifecycle";
import { createForest } from "./forest";
import { createBankMeshes } from "./bank-view";
import { bankHeight, WATER_WIDTH, BED_WIDTH } from "./bank-terrain";
import { createUnderstory } from "./understory";
import { createLeafView } from "./leaf-view";
import { createRiverLeaf } from "./river-leaf";
import * as THREE from "three/webgpu";
import { createRiverWater } from "./water";
import {
  defaults,
  initial,
  updateWind,
  surface,
  current,
  flowField,
  obstacle,
  obstacles,
  river,
  type Params,
} from "./simulation";
import "./style.css";
import { FIXED_STEP } from "./physics-boundary";
const revision = import.meta.env.VITE_BUILD_REVISION?.slice(0, 7);
if (import.meta.env.VITE_DEVELOPMENT_PREVIEW === "true") {
  document.querySelector("#hud span")!.textContent =
    `Development preview · ${revision ?? "local"} · work in progress`;
}
const app = document.querySelector<HTMLDivElement>("#app")!,
  diag = document.querySelector<HTMLOutputElement>("#diagnostics")!;
let renderer: THREE.WebGPURenderer;
let gameplayReady = false;
try {
  renderer = new THREE.WebGPURenderer({
    forceWebGL:
      import.meta.env.DEV &&
      new URLSearchParams(location.search).has("forceWebGL"),
    antialias: true,
    trackTimestamp:
      import.meta.env.DEV &&
      new URLSearchParams(location.search).has("profileGPU"),
  });
  await renderer.init();
} catch {
  document.querySelector("#error")!.textContent =
    "Graphics initialization failed. Enable WebGPU or WebGL2 and update your graphics driver.";
  throw new Error("WebGPU and WebGL2 renderer unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, defaults.quality));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);
const backend = "isWebGPUBackend" in renderer.backend ? "WebGPU" : "WebGL2";
const benchmarkMode = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("waterBenchmark")
  : null;
const benchmarkCopies = { depth: 0, color: 0 };
if (benchmarkMode) {
  const originalCopy = renderer.copyFramebufferToTexture.bind(renderer);
  renderer.copyFramebufferToTexture = (texture, rectangle) => {
    if (texture instanceof THREE.DepthTexture) benchmarkCopies.depth++;
    else benchmarkCopies.color++;
    return originalCopy(texture, rectangle);
  };
}

if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("profileGPU")
) {
  Object.assign(window, {
    readVerificationGPUTime: async () => {
      if (!renderer.hasFeature("timestamp-query")) return { supported: false };
      await renderer.resolveTimestampsAsync();
      return {
        supported: true,
        batchTimestampMs: renderer.info.render.timestamp,
      };
    },
  });
}
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
const qualityControl = document.querySelector<HTMLSelectElement>("#quality")!;
if (import.meta.env.DEV) qualityControl.closest("label")!.hidden = true;
qualityControl.addEventListener("change", () => {
  p.quality = Number(qualityControl.value);
  if (gameplayReady && manual) render(0);
});
let state = initial();
const physics = await createRiverLeaf().catch((error) => {
  document.querySelector("#error")!.textContent =
    "Physics initialization failed. Reload the page to retry.";
  throw error;
});
onFinalPageHide(() => physics.dispose());
camera.position.set(
  state.x,
  state.y + p.cameraHeight,
  state.z + p.cameraDistance,
);
const keys = new Set<string>();
// Poly Haven Low Tide Rocks: diffuse color is sRGB; one tile spans approximately 2.2 m.
const bedTexture = new THREE.TextureLoader().load(
  `${import.meta.env.BASE_URL}assets/low-tide-rocks-diffuse.jpg`,
);
bedTexture.colorSpace = THREE.SRGBColorSpace;
bedTexture.wrapS = bedTexture.wrapT = THREE.RepeatWrapping;
const riverLength = river.start - river.end;
const riverCenter = (river.start + river.end) / 2;
bedTexture.repeat.set(BED_WIDTH / 2.2, riverLength / 2.2);
bedTexture.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({
    color: 0x586f49,
    roughness: 1,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.42;
ground.position.z = riverCenter;
scene.add(ground);
const bed = new THREE.Mesh(
  new THREE.PlaneGeometry(BED_WIDTH, riverLength),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: bedTexture,
    roughness: 1,
  }),
);
bed.rotation.x = -Math.PI / 2;
bed.position.set(0, -0.41, riverCenter);
scene.add(bed);
// The supplied pebble diffuse map uses world-scale UVs for each bank face.
const shoreTexture = new THREE.TextureLoader().load(
  `${import.meta.env.BASE_URL}assets/ganges-river-pebbles-diffuse.jpg`,
);
shoreTexture.colorSpace = THREE.SRGBColorSpace;
shoreTexture.wrapS = shoreTexture.wrapT = THREE.RepeatWrapping;
shoreTexture.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
const banks = createBankMeshes(shoreTexture);
for (const mesh of banks.meshes) scene.add(mesh);
onFinalPageHide(() => banks.dispose());
const rockTexture = new THREE.TextureLoader().load(
  `${import.meta.env.BASE_URL}assets/coast-sand-rocks-diffuse.jpg`,
);
rockTexture.colorSpace = THREE.SRGBColorSpace;
rockTexture.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: rockTexture,
  roughness: 1,
});
// Temporary sculpted banks, independently generated geometry.
for (const side of [-1, 1]) {
  for (let i = 0; i < 40; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25 + (i % 4) * 0.13, 0),
      rockMaterial,
    );
    const x = side * (4.45 + (i % 3) * 0.5),
      z = -i * 2.8 + 6;
    rock.position.set(x, bankHeight(x, z) + (0.25 + (i % 4) * 0.13) * 0.25, z);
    rock.scale.set(1.3, 0.65, 1);
    scene.add(rock);
  }
}
const foams: { mesh: THREE.Mesh; rock: typeof obstacle }[] = [];
for (const rock of obstacles) {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(rock.r, 1),
    rockMaterial,
  );
  mesh.position.set(rock.x, 0.32, rock.z);
  mesh.scale.set(1, 0.75, 1);
  scene.add(mesh);
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(rock.r * 1.05, rock.r * 1.16, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd1e4cb,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(rock.x, 0.08, rock.z);
  scene.add(foam);
  foams.push({ mesh: foam, rock });
}
const geometry = new THREE.PlaneGeometry(WATER_WIDTH, riverLength, 70, 480);
geometry.translate(0, -riverCenter, 0);
const optics = createRiverWater(geometry);
const water = optics.mesh;
scene.add(water);
const leafView = createLeafView();
await leafView.ready.catch(() => {
  leafView.useFallback();
  document.querySelector("#error")!.textContent =
    "Leaf detail could not load. You can keep playing; reload to retry the texture.";
});
const leaf = leafView.group;
onFinalPageHide(() => leafView.dispose());
scene.add(leaf);
const comparisonPlants =
  (import.meta.env.DEV ||
    import.meta.env.VITE_DEVELOPMENT_PREVIEW === "true") &&
  new URLSearchParams(location.search).get("understory") === "compare";
const understory = await createUnderstory(comparisonPlants);
if (understory.diagnostics().failedSpecies.length)
  document.querySelector("#error")!.textContent =
    "Some shoreline plants could not load. You can keep playing; reload to retry.";
scene.add(understory.group);
onFinalPageHide(() => understory.dispose());
const forest = createForest();
scene.add(forest.group);
onFinalPageHide(() => forest.dispose());

// Temporary wind streaks: density and opacity follow the simulated directed wind.
const streakCount = 15;
const streakSegments = 12;
const streakPositions = new Float32Array(streakCount * streakSegments * 18);
const streakGeometry = new THREE.BufferGeometry();
streakGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(streakPositions, 3).setUsage(
    THREE.DynamicDrawUsage,
  ),
);
const streakMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const streaks = new THREE.Mesh(streakGeometry, streakMaterial);
streaks.frustumCulled = false;
scene.add(streaks);
function updateWindStreaks() {
  const magnitude = Math.hypot(state.windX, state.windZ);
  const strength = Math.min(1, magnitude * state.intensity * p.windStrength);
  const count = Math.floor(streakCount * strength);
  streakGeometry.setDrawRange(0, count * streakSegments * 6);
  streakMaterial.opacity = Math.min(0.8, strength * 0.85);
  if (!count) return;
  const nx = state.windX / magnitude,
    nz = state.windZ / magnitude;
  for (let i = 0; i < count; i++) {
    const wrap = (n: number, span: number) =>
      (((n % span) + span) % span) - span / 2;
    const x = state.x + wrap(i * 2.73 + state.windOffsetX * 2, 8);
    const z = state.z + wrap(i * 4.17 + state.windOffsetZ * 2, 15) - 3;
    const y = 0.5 + (i % 7) * 0.32;
    const length = 0.7 + strength * 1.5;
    const amplitude = 0.03 + strength * 0.25;
    const phase = state.time * (2 + strength * 4) + i * 1.7;
    const point = (u: number, side: number) => {
      const bend = Math.sin(u * Math.PI * 2 - phase) * amplitude;
      const taperedWidth = Math.sin(Math.PI * u) * 0.075 * side;
      return [
        x + nx * length * u - nz * (bend + taperedWidth),
        y,
        z + nz * length * u + nx * (bend + taperedWidth),
      ];
    };
    for (let j = 0; j < streakSegments; j++) {
      const a = j / streakSegments,
        b = (j + 1) / streakSegments;
      streakPositions.set(
        [
          ...point(a, -1),
          ...point(a, 1),
          ...point(b, -1),
          ...point(a, 1),
          ...point(b, 1),
          ...point(b, -1),
        ],
        (i * streakSegments + j) * 18,
      );
    }
  }
  streakGeometry.attributes.position.needsUpdate = true;
}
const clock = new THREE.Clock();
window.addEventListener("pageshow", (event) => {
  if (event.persisted) clock.start();
});
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
let submersionTest: { offset: number; pitch: number; view: string } | undefined;
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
  const laps = state.laps;
  updateWind(state, p, input(), dt);
  physics.step(state, p);
  if (state.laps !== laps)
    camera.position.set(
      state.x,
      state.y + p.cameraHeight,
      state.z + p.cameraDistance,
    );
}
function render(dt: number) {
  const started = performance.now();
  const attr = geometry.attributes.position as THREE.BufferAttribute;
  const skipSurface = benchmarkMode === "no-surface";
  if (!skipSurface) {
    for (let i = 0; i < attr.count; i++)
      attr.setZ(i, surface(attr.getX(i), -attr.getY(i), state.time, p, state));
    attr.needsUpdate = true;
  }
  const deformed = performance.now();
  if (!skipSurface) geometry.computeVertexNormals();
  const normals = performance.now();
  for (const { mesh, rock } of foams)
    mesh.position.y =
      surface(rock.x + rock.r, rock.z, state.time, p, state) + 0.035;
  leafView.update(physics.readFrame(), state);
  if (submersionTest) {
    leaf.position.y =
      surface(state.x, state.z, state.time, p, state) + submersionTest.offset;
    leaf.rotation.set(submersionTest.pitch, 0, 0);
  }
  cameraTarget.set(
    state.x,
    state.y + p.cameraHeight,
    state.z + p.cameraDistance,
  );
  camera.position.lerp(cameraTarget, 1 - Math.exp(-p.cameraSmoothing * dt));
  camera.lookAt(state.x, state.y + p.cameraAngle, state.z - 3);
  if (submersionTest?.view === "gameplay") {
    camera.position.copy(cameraTarget);
    camera.lookAt(state.x, state.y + p.cameraAngle, state.z - 3);
  }
  if (submersionTest && submersionTest.view !== "gameplay") {
    camera.position.set(state.x, state.y + 1.4, state.z + 2);
    camera.lookAt(
      state.x + (submersionTest.view === "edge" ? 1.6 : 0),
      state.y - 0.1,
      state.z,
    );
  }
  const pixelRatio = Math.min(devicePixelRatio, p.quality);
  if (renderer.getPixelRatio() !== pixelRatio)
    renderer.setPixelRatio(pixelRatio);
  optics.setQuality(p.quality);
  understory.setQuality(p.quality);
  forest.update(state.time, state.windX, state.windZ, state.intensity * p.windStrength, p.quality, state.z);
  updateWindStreaks();
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
  diag.textContent = `${backend} · ${Math.round(1000 / frameMs)} fps · ${frameMs.toFixed(1)} ms\nwind level ${state.windLevel + 1}/5 ${state.windLevel === 0 ? "(calm)" : ""} · current ${current(state.x, state.z, state.time, p).toFixed(2)} · wind ${state.windX.toFixed(2)}, ${state.windZ.toFixed(2)} × ${state.intensity.toFixed(2)}\nleaf velocity ${state.vx.toFixed(2)}, ${state.vz.toFixed(2)} · ${control.gamepad ? "gamepad" : "keyboard / no standard gamepad"}`;
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
    while (accumulator >= FIXED_STEP) {
      update(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
  }
  if (!manual || frames === 1) render(manual ? 0 : dt);
}
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    e.preventDefault();
  if (e.key.toLowerCase() === "r") {
    state = initial();
    physics.reset();
    accumulator = 0;
    if (manual) render(0);
  }
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
  if (manual) render(0);
});
window.render_game_to_text = () =>
  JSON.stringify({
    coordinateSystem: "x right, z downstream is negative, y up",
    ...state,
    physics: physics.diagnostics(),
    understory: understory.diagnostics(),
    forest: forest.diagnostics(),
    current: current(state.x, state.z, state.time, p),
    obstacle,
    obstacles,
    river,
    renderer: backend,
    rendererEngine: "WebGPURenderer",
    benchmark: benchmarkMode
      ? { mode: benchmarkMode, copies: benchmarkCopies }
      : undefined,
    resources: { ...renderer.info.memory },
    waterOptics: optics.diagnostics(),
    windStreaks: streakGeometry.drawRange.count / (6 * streakSegments),
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
      surface(0, -4, state.time, p, state),
      surface(1, -4, state.time, p, state),
    ],
  });
if (manual)
  Object.assign(window, {
    forceLeafTear: () => physics.forceTear(),
    clearLeafSubmersion: () => {
      submersionTest = undefined;
    },
    setVerificationWaterVisible: (visible: boolean) => {
      optics.mesh.visible = visible;
    },
    setLeafSubmersion: (offset: number, pitch = 0, view = "inspection") => {
      submersionTest = { offset, pitch, view };
    },
  });
if (manual)
  window.setWaterOptics = (reflection: number, refraction: number) => {
    optics.reflectionWeight.value = reflection;
    optics.refractionWeight.value = refraction;
    render(0);
  };
if (manual)
  window.advanceTime = (ms: number) => {
    accumulator += ms / 1000;
    while (accumulator + 1e-12 >= FIXED_STEP) {
      update(FIXED_STEP);
      accumulator = Math.max(0, accumulator - FIXED_STEP);
    }
    render(ms / 1000);
  };
if (import.meta.env.DEV) {
  void import("lil-gui").then(({ default: GUI }) => {
    const gui = new GUI({ title: "River tuning · development" });
    gui.onChange(() => { if (manual) render(0); });
    const waterFolder = gui.addFolder("Water / current");
    waterFolder.add(p, "current", 0.2, 2.5, 0.01);
    waterFolder.add(p, "variation", 0, 0.8, 0.01);
    waterFolder.add(p, "turbulence", 0, 1, 0.01);
    waterFolder.add(p, "ripple", 0, 0.4, 0.01);
    waterFolder.add(p, "damping", 0, 1, 0.01);
    waterFolder.add(p, "quality", 0.5, 2, 0.1);
    waterFolder
      .add(optics.absorption.value, "x", 0, 2, 0.01)
      .name("red absorption");
    waterFolder
      .add(optics.absorption.value, "y", 0, 2, 0.01)
      .name("green absorption");
    waterFolder
      .add(optics.absorption.value, "z", 0, 2, 0.01)
      .name("blue absorption");
    const phys = gui.addFolder("Wind / leaf");
    phys.add(p, "deadzone", 0, 0.4, 0.01);
    phys.add(p, "windCurve", 0.4, 3, 0.1);
    phys.add(p, "windStrength", 0, 2, 0.01);
    phys.add(p, "windResponse", 0.1, 5, 0.1);
    phys.add(p, "drag", 0.1, 5, 0.1);
    phys.add(p, "buoyancy", 1, 20, 0.1);
    phys.add(p, "alignment", 0, 8, 0.1);
    const cam = gui.addFolder("Camera");
    cam.add(p, "cameraDistance", 0.4, 15, 0.05);
    cam.add(p, "cameraHeight", 0.1, 10, 0.05);
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
gameplayReady = true;
requestAnimationFrame(loop);
