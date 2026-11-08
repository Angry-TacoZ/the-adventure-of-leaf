import { chromium } from "playwright";
import assert from "node:assert/strict";

// Back/forward-cache acceptance on bundled Chromium: Playwright disables the
// cache by default, so the flag is removed the same way the native suite
// does. Full Chromium is required: the default headless-shell build cannot
// restore from the cache at all (BackForwardCacheDisabledForDelegate).
const browser = await chromium.launch({
  channel: "chromium",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.LEAF_BASE_URL || "http://127.0.0.1:5173";
  await page.goto(`${base}/?testMode=manual`);
  await page.waitForFunction(() => window.advanceTime);
  const before = await page.evaluate(() => {
    window.cacheProbe = "retained";
    window.addEventListener("pageshow", (event) => {
      window.cachePersisted = event.persisted;
    });
    window.advanceTime(120);
    return JSON.parse(window.render_game_to_text());
  });
  // A same-origin JSON document has no renderer or asset loading of its own.
  await page.goto(`${base}/package.json`);
  // A cached document resumes without firing a new load event, and physics
  // must still step: disposal runs only on final (non-persisted) pagehide.
  await page.goBack({ waitUntil: "commit" });
  await page.waitForFunction(() => window.cachePersisted === true);
  const after = await page.evaluate(() => {
    const t0 = JSON.parse(window.render_game_to_text()).time;
    window.advanceTime(120);
    return {
      retained: window.cacheProbe,
      persisted: window.cachePersisted,
      t0,
      state: JSON.parse(window.render_game_to_text()),
    };
  });
  assert.equal(after.retained, "retained");
  assert.equal(after.persisted, true);
  assert.ok(after.state.time > after.t0, "restored physics still steps");
  assert.equal(after.state.physics.engine, "Rapier");
  assert.ok(Number.isFinite(after.state.z));
  assert.deepEqual(errors, []);
  // A final (non-persisted) pagehide must dispose the physics world, so a
  // later read can no longer reach it. This is the normal-exit path.
  const disposed = await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    try {
      window.render_game_to_text();
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(disposed, true);
  console.log("Lifecycle bfcache restore, resumed physics and final-exit disposal passed");
} finally {
  await browser.close();
}
