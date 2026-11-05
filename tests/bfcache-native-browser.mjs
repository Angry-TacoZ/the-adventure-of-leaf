import { chromium } from "playwright";
import assert from "node:assert/strict";

// Native acceptance only: Playwright disables the browser cache by default.
const browser = await chromium.launch({
  channel: "chrome", headless: true,
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.LEAF_BASE_URL;
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  await page.getByRole("button", { name: "Begin journey", exact: true }).click();
  const before = await page.evaluate(() => {
    window.cacheProbe = "retained";
    window.addEventListener("pageshow", (event) => { window.cachePersisted = event.persisted; });
    return JSON.parse(window.render_game_to_text());
  });
  // A same-origin JSON document has no renderer or asset loading of its own.
  await page.goto(`${base}/package.json`);
  // A cached document resumes without firing a new load event.
  await page.goBack({ waitUntil: "commit" });
  await page.waitForFunction((time) => window.cachePersisted === true &&
    JSON.parse(window.render_game_to_text()).time > time + 0.1, before.time);
  const after = await page.evaluate(() => ({
    retained: window.cacheProbe, persisted: window.cachePersisted,
    state: JSON.parse(window.render_game_to_text()),
  }));
  assert.equal(after.retained, "retained");
  assert.equal(after.persisted, true);
  assert.equal(after.state.renderer, "WebGPU");
  assert.equal(after.state.physics.engine, "Rapier");
  assert.ok(Number.isFinite(after.state.z));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ cachedRestore: true, backend: after.state.renderer,
    beforeTime: before.time, afterTime: after.state.time, errors }));
} finally { await browser.close(); }
