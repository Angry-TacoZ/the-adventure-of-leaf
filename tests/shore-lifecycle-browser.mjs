import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/understory/fern_02.glb", (route) => route.abort());
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&forceWebGL`);
  await page.waitForFunction(() => window.advanceTime);
  assert.match(await page.locator("#error").textContent(), /shoreline plants/i);
  const [before, after] = await page.evaluate(() => {
    window.advanceTime(1000);
    const before = JSON.parse(window.render_game_to_text());
    window.dispatchEvent(new PageTransitionEvent("pagehide", {persisted: true}));
    window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted: true}));
    window.advanceTime(1000);
    return [before, JSON.parse(window.render_game_to_text())];
  });
  assert.ok(after.z < before.z, "cached page must retain active physics");
  assert.deepEqual(after.understory.failedSpecies, ["fern_02"]);
  assert.deepEqual(errors, []);
  console.log("Cached-page gameplay and missing shoreline plant recovery passed");
} finally { await browser.close(); }
