import { defaultVolumes, type SoundBus, type Volumes } from "./audio";

type Screen = "home" | "pause" | "settings" | "guide" | "credits" | "lost" | null;
interface Callbacks {
  manual: boolean; quality: number; volumes: Volumes;
  onStart(): void; onHome(): void; onChange(): void;
  onQuality(value: number): void; onVolume(bus: SoundBus, value: number): void;
  onSoundTest(): void;
}

/** Native dialog owns menus/focus; main owns gameplay and audio side effects. */
export function createGameUI(callbacks: Callbacks) {
  const dialog = document.createElement("dialog"); dialog.className = "game-menu";
  dialog.setAttribute("aria-labelledby", "menu-title");
  document.querySelector("#app")!.append(dialog);
  const pause = document.createElement("button"); pause.className = "pause-button"; pause.textContent = "Pause";
  pause.setAttribute("aria-label", "Pause journey"); document.querySelector("#app")!.append(pause);
  let screen: Screen = callbacks.manual ? null : "home", parent: Screen = "home";
  let quality = callbacks.quality, started = callbacks.manual;
  const volumes = { ...callbacks.volumes };
  const revision = import.meta.env.VITE_BUILD_REVISION?.slice(0, 7) ?? "local";
  const source = `https://github.com/Angry-TacoZ/the-adventure-of-leaf/blob/${import.meta.env.VITE_BUILD_REVISION || "codex/rapier-softbody-physics"}/docs/ASSET_CREDITS.md`;
  const button = (action: string, label: string, primary = false) => `<button data-action="${action}" class="${primary ? "primary" : ""}">${label}</button>`;
  function draw() {
    document.body.classList.toggle("menu-open", screen !== null);
    pause.hidden = screen !== null || callbacks.manual;
    if (screen === null) { if (dialog.open) dialog.close(); callbacks.onChange(); return; }
    let title = "", content = "";
    if (screen === "home") {
      title = "The Adventure<br>of Leaf";
      content = `<p class="menu-intro">Guide a birch leaf with the wind.</p>${button("start", "Begin journey", true)}<nav>${button("guide", "How to play")}${button("settings", "Settings")}${button("credits", "Credits")}</nav><p class="build-note">Development preview · headwaters reach · ${revision}</p>`;
    } else if (screen === "pause") {
      title = "Paused";
      content = button("resume", "Resume journey", true) + `<nav>${button("start", "Restart from the headwaters")}${button("settings", "Settings")}${button("guide", "How to play")}${button("home", "Main menu")}</nav>`;
    } else if (screen === "lost") {
      title = "The adventure of Leaf has ended, try again?";
      content = `<p class="menu-intro">The largest piece is below a quarter of the original leaf.</p>${button("start", "Restart from the headwaters", true)}${button("home", "Main menu")}`;
    } else if (screen === "settings") {
      title = "Settings";
      content = `<label class="setting-row">Graphics quality<select id="settings-quality"><option value="0.5">Low</option><option value="0.75">Medium</option><option value="1">High</option></select></label><fieldset><legend>Sound levels</legend>${(Object.keys(defaultVolumes) as SoundBus[]).map((bus) => `<label class="volume-row">${bus[0].toUpperCase() + bus.slice(1)}<input type="range" data-volume="${bus}" aria-label="${bus} volume" min="0" max="1" step="0.01" value="${volumes[bus]}"></label>`).join("")}</fieldset>${button("sound", "Play test sound")}${button("back", "Back")}`;
    } else if (screen === "guide") {
      title = "How to play";
      content = `<p>You control the wind. The leaf follows the current and keeps its momentum.</p><dl class="guide-controls"><dt>Wind direction</dt><dd>WASD / arrows · left stick</dd><dt>One level stronger</dt><dd>Tap E · right trigger</dd><dt>One level weaker</dt><dd>Tap Q · left trigger</dd><dt>Stop directed wind</dt><dd>Release direction · centre stick</dd><dt>Pause</dt><dd>Esc · controller Menu/Start</dd><dt>Restart / fullscreen</dt><dd>R / F</dd></dl><p>Five persistent wind levels include calm. Start gently and steer before reaching rocks or fish. The current will not choose a route for you.</p><p>Tears separate the leaf into pieces. The journey ends when the largest is below 25% of the original area.</p>${button("back", "Back")}`;
    } else {
      title = "Credits";
      content = `<p><strong>James Lane</strong><br>Creative direction</p><p>Engineering and procedural art with OpenAI Codex. Hero leaf texture created with OpenAI image generation.</p><p>Three.js · WebGPU / WebGL2 · Rapier 3D · TypeScript · Vite · Web Audio API</p><p>Tree generator: SeedThree, SkyeShark, MIT. Shore/rock textures and understory: Poly Haven, CC0. Fish, sky and sound effects are project-authored procedural assets.</p><ul class="credit-links"><li><a href="${import.meta.env.BASE_URL}licenses/SeedThree-MIT.txt" target="_blank" rel="noopener">SeedThree MIT notice</a></li><li><a href="${import.meta.env.BASE_URL}licenses/Three-MIT.txt" target="_blank" rel="noopener">Three.js MIT notice</a></li><li><a href="${import.meta.env.BASE_URL}licenses/Rapier-Apache-2.txt" target="_blank" rel="noopener">Rapier Apache 2.0 notice</a></li><li><a href="${source}" target="_blank" rel="noopener">Complete asset credits and AI disclosure</a></li></ul>${button("back", "Back")}`;
    }
    dialog.innerHTML = `${screen === "home" ? "" : `<p class="menu-eyebrow">THE ADVENTURE OF LEAF</p>`}<h1 id="menu-title"${screen === "home" ? ` class="home-title"` : ""}>${title}</h1>${content}<p class="menu-help">Arrow keys / stick to select · Enter / A to choose</p>`;
    const select = dialog.querySelector<HTMLSelectElement>("#settings-quality");
    if (select) select.value = String(quality);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    callbacks.onChange();
  }
  function begin() { started = true; screen = null; callbacks.onStart(); draw(); }
  function back() { screen = parent; draw(); }
  function togglePause() {
    if (screen === null) { screen = "pause"; draw(); }
    else if (screen === "pause") { screen = null; draw(); }
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (screen === "pause") togglePause();
    else if (screen !== "home" && screen !== "lost") back();
  });
  pause.addEventListener("click", togglePause);
  dialog.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "start") begin();
    else if (action === "resume") { screen = null; draw(); }
    else if (action === "home") { started = false; screen = "home"; callbacks.onHome(); draw(); }
    else if (action === "back") back();
    else if (action === "sound") callbacks.onSoundTest();
    else { parent = started ? "pause" : "home"; screen = action as Screen; draw(); }
  });
  dialog.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    if (target.id === "settings-quality") { quality = Number(target.value); callbacks.onQuality(quality); }
  });
  dialog.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement, bus = input.dataset.volume as SoundBus | undefined;
    if (bus) { volumes[bus] = Number(input.value); callbacks.onVolume(bus, volumes[bus]); }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && screen === null) { event.preventDefault(); togglePause(); }
    if (screen !== null && !(event.target instanceof HTMLSelectElement) && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault(); moveFocus(event.key === "ArrowDown" ? 1 : -1);
    }
  });
  function moveFocus(direction: number) {
    const controls = [...dialog.querySelectorAll<HTMLElement>("button,select,input,a")];
    const index = controls.indexOf(document.activeElement as HTMLElement);
    const target = controls[(index + direction + controls.length) % controls.length]; target?.focus(); target?.scrollIntoView({ block: "nearest" });
  }
  let previousA = false, previousB = false, previousStart = false, nextMove = 0;
  draw();
  return {
    get paused() { return screen !== null; },
    get screen() { return screen; },
    begin,
    lose() { if (screen === "lost") return; screen = "lost"; draw(); },
    setQuality(value: number) { quality = value; const select = dialog.querySelector<HTMLSelectElement>("#settings-quality"); if (select) select.value = String(value); },
    pollGamepad(now: number) {
      const pad = navigator.getGamepads?.().find((p) => p?.connected && p.mapping === "standard");
      const a = (pad?.buttons[0]?.value ?? 0) > 0.5, b = (pad?.buttons[1]?.value ?? 0) > 0.5, start = (pad?.buttons[9]?.value ?? 0) > 0.5;
      if (start && !previousStart) togglePause();
      if (screen !== null) {
        const axis = pad?.axes[1] ?? 0;
        const direction = axis > 0.6 || (pad?.buttons[13]?.value ?? 0) > 0.5 ? 1 : axis < -0.6 || (pad?.buttons[12]?.value ?? 0) > 0.5 ? -1 : 0;
        if (direction && now >= nextMove) { moveFocus(direction); nextMove = now + 220; }
        const horizontal = pad?.axes[0] ?? 0;
        const focused = document.activeElement;
        if (Math.abs(horizontal) > 0.6 && now >= nextMove) {
          const step = horizontal > 0 ? 1 : -1;
          if (focused instanceof HTMLInputElement && focused.type === "range") {
            focused.value = String(Math.max(0, Math.min(1, Number(focused.value) + step * 0.05)));
            focused.dispatchEvent(new Event("input", { bubbles: true }));
          } else if (focused instanceof HTMLSelectElement) {
            focused.selectedIndex = Math.max(0, Math.min(focused.options.length - 1, focused.selectedIndex + step));
            focused.dispatchEvent(new Event("change", { bubbles: true }));
          }
          nextMove = now + 220;
        }
        if (a && !previousA && (focused instanceof HTMLButtonElement || focused instanceof HTMLAnchorElement)) focused.click();
        if (b && !previousB) { if (screen === "pause") { screen = null; draw(); } else if (screen !== "home" && screen !== "lost") back(); }
      }
      previousA = a; previousB = b; previousStart = start;
    },
  };
}
