import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? { channel: "chrome", headless: true } : {
  headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
await mkdir("output/web-game", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.addInitScript(() => {
    window.menuPad = { connected: true, mapping: "standard", axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0 })) };
    Object.defineProperty(navigator, "getGamepads", { value: () => [window.menuPad] });
  });
  const base = process.env.LEAF_BASE_URL || "http://127.0.0.1:5200";
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const screen = async (value) => assert.equal((await read()).menu, value);
  const click = (name) => page.getByRole("button", { name, exact: true }).click();
  await screen("home");
  const home = await read();
  await page.waitForTimeout(200);
  assert.equal((await read()).time, home.time, "home must not simulate the journey");
  assert.equal(home.audio.state, "locked");
  await page.screenshot({ path: `output/web-game/menu-home-${native ? "native" : "webgl2"}.png` });
  await click("Settings"); await screen("settings");
  const quality = page.locator("#settings-quality");
  await quality.selectOption("0.5");
  await page.waitForFunction(() => document.querySelector("canvas").width === 480);
  // Native keyboard select behavior must not be swallowed by gameplay bindings.
  await quality.focus(); await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");
  assert.equal(await quality.inputValue(), "0.75");
  await quality.selectOption("1");
  await click("Play test sound");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.state === "running");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.activeEffects === 0);
  await page.getByRole("slider", { name: "master volume", exact: true }).fill("0");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.levels.master === 0);
  await page.getByRole("slider", { name: "master volume", exact: true }).fill("0.5");
  await page.screenshot({ path: "output/web-game/menu-settings.png" });
  await click("Back"); await click("Credits");
  await page.getByText("James Lane", { exact: true }).waitFor();
  for (const href of await page.locator(".credit-links a").evaluateAll((links) => links.map((a) => a.href))) {
    if (href.startsWith(base)) assert.equal((await page.request.get(href)).status(), 200, href);
  }
  await click("Back"); await click("How to play");
  await page.getByText(/25% of the original area/).waitFor();
  await click("Back"); await click("Begin journey"); await screen(null);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).time > 0.2);
  await page.keyboard.press("Escape"); await screen("pause");
  const paused = await read();
  await page.keyboard.down("d"); await page.waitForTimeout(400); await page.keyboard.up("d");
  assert.equal((await read()).time, paused.time);
  assert.equal((await read()).x, paused.x);
  await click("Settings"); await page.keyboard.press("Escape"); await screen("pause");
  await click("Resume journey"); await screen(null);
  await page.waitForFunction((t) => JSON.parse(window.render_game_to_text()).time > t, paused.time);
  assert.ok((await read()).time < paused.time + 0.5, "resume simulated time spent in menus");
  const pressPad = async (index) => {
    await page.evaluate((i) => { window.menuPad.buttons[i].value = 1; }, index);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate((i) => { window.menuPad.buttons[i].value = 0; }, index);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  await pressPad(9); await screen("pause");
  await pressPad(1); await screen(null);
  await pressPad(9); await screen("pause");
  await click("Main menu"); await screen("home");
  await pressPad(13);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "guide");
  await pressPad(0); await screen("guide");
  await pressPad(1); await screen("home");
  await pressPad(0); await screen(null);
  await page.keyboard.press("Escape"); await click("Main menu");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Settings", "How to play", "Credits"]) {
    await click(name);
    const bounds = await page.locator("dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844, name);
    await click("Back");
  }
  await page.screenshot({ path: "output/web-game/menu-mobile.png" });
  // Real engine cuts trigger the ending. No synthetic health or fake loss hook.
  await page.goto(`${base}/?testMode=manual&opening${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  const damage = [];
  for (let i = 0; i < 12 && (await read()).menu !== "lost"; i++) {
    damage.push(await page.evaluate(() => {
      window.forceLeafTear(); window.advanceTime(10);
      return JSON.parse(window.render_game_to_text()).physics;
    }));
  }
  await screen("lost");
  assert.ok(damage.at(-1).integrity < 0.25, JSON.stringify(damage));
  await page.getByRole("heading", { name: "The adventure of Leaf has ended, try again?", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Resume journey" }).count(), 0);
  const ended = await read();
  await page.evaluate(() => window.advanceTime(2000));
  assert.equal((await read()).time, ended.time);
  await page.keyboard.press("Escape"); await screen("lost");
  await page.screenshot({ path: `output/web-game/menu-ending-${native ? "native" : "webgl2"}.png` });
  await click("Restart from the headwaters");
  const reset = await read();
  assert.equal(reset.menu, null); assert.equal(reset.physics.fragments, 1);
  assert.ok(Math.abs(reset.physics.integrity - 1) < 1e-5);
  assert.equal(reset.opening.phase, "falling"); assert.ok(reset.y > 2.5);
  // Repeat the ending and exercise its alternate recovery route.
  for (let i = 0; i < 12 && (await read()).menu !== "lost"; i++)
    await page.evaluate(() => { window.forceLeafTear(); window.advanceTime(10); });
  await screen("lost"); await click("Main menu"); await screen("home");
  await click("Begin journey"); assert.equal((await read()).physics.fragments, 1);
  assert.deepEqual(errors, []);
  const result = { backend: (await read()).renderer, damage, pauseTime: paused.time,
    reset: reset.physics, audio: home.audio.state, errors };
  await writeFile(`output/web-game/menu-${native ? "native" : "webgl2"}.json`, JSON.stringify(result, null, 2));
  console.log("Menu, actual damage ending, audio, keyboard/controller and narrow viewport checks passed", JSON.stringify(result));
} finally { await browser.close(); }
