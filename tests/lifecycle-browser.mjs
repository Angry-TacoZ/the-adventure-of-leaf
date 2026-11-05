import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const p = await browser.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let releaseTexture, sawTexture;
  const textureRequested = new Promise((resolve) => { sawTexture = resolve; });
  const textureGate = new Promise((resolve) => { releaseTexture = resolve; });
  await p.route("**/yellow-birch-hero-albedo.png", async (route) => {
    sawTexture();
    await textureGate;
    await route.abort();
  });
  await p.route("**/understory/fern_02.glb", (route) => route.abort());
  await p.route("**/understory/celandine_01.glb", (route) => route.abort());
  await p.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&forceWebGL`, { waitUntil: "domcontentloaded" });
  await textureRequested;
  // Settings may be used while the hero texture is still loading.
  await p.locator("#quality").evaluate((control) => {
    control.value = "0.5";
    control.dispatchEvent(new Event("change"));
  });
  releaseTexture();
  await p.waitForFunction(() => window.advanceTime);
  assert.match(
    await p.locator("#error").textContent(),
    /keep playing.*reload/i,
  );
  const states = await p.evaluate(() => {
    window.advanceTime(1000);
    const before = JSON.parse(window.render_game_to_text());
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
    window.advanceTime(1000);
    return [before, JSON.parse(window.render_game_to_text())];
  });
  assert.ok(states[1].z < states[0].z);
  assert.equal(states[1].physics.engine, "Rapier");
  assert.deepEqual(states[1].understory.failedSpecies, ["fern_02"]);
  assert.equal(states[1].understory.species.length, 3);
  await p.waitForTimeout(250);
  const idle = await p.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(idle.waterOptics.captures, states[1].waterOptics.captures,
    "manual mode redrew the water while idle");
  await p.setViewportSize({ width: 1100, height: 700 });
  await p.waitForFunction((captures) => JSON.parse(window.render_game_to_text()).waterOptics.captures > captures, idle.waterOptics.captures);
  const resized = await p.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.ok(resized.waterOptics.captures > idle.waterOptics.captures);
  assert.equal(resized.time, idle.time, "resize advanced manual physics");
  await p.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&forceWebGL&understory=compare`);
  await p.waitForFunction(() => window.advanceTime);
  const comparison = await p.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.deepEqual(comparison.understory.failedSpecies, ["fern_02", "celandine_01"]);
  assert.equal(comparison.understory.species.length, 5);
  assert.deepEqual(errors, []);
  const fixture = await browser.newPage();
  await fixture.route("**/lifecycle-fixture", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Lifecycle fixture</title>",
    }),
  );
  await fixture.goto(`${process.env.LEAF_BASE_URL}/lifecycle-fixture`);
  const counts = await fixture.evaluate(async () => {
    const { onFinalPageHide } = await import("/src/lifecycle.ts");
    let count = 0;
    onFinalPageHide(() => count++);
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    const cached = count;
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    return { cached, final: count };
  });
  assert.equal(counts.cached, 0);
  assert.equal(counts.final, 1);
  console.log(
    "Texture failure recovery and persisted-page lifecycle checks passed (synthetic cache events)",
  );
} finally {
  await browser.close();
}
