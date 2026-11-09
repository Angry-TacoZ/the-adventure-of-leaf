import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = process.env.LEAF_BASE_URL;
try {
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/yellow-birch-hero-albedo.png", (route) => route.abort());
    await page.goto(`${base}/?testMode=manual&forceWebGL`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.advanceTime);
    await page.getByText(/leaf detail could not load/i).waitFor();
    const [before, after] = await page.evaluate(() => {
      window.advanceTime(1000);
      const before = JSON.parse(window.render_game_to_text());
      window.advanceTime(1000);
      return [before, JSON.parse(window.render_game_to_text())];
    });
    assert.ok(after.z < before.z, "failed texture must allow downstream motion");
    assert.deepEqual(errors, []);
    await page.close();
  }
  {
    const page = await browser.newPage();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let requested;
    const request = new Promise((resolve) => { requested = resolve; });
    await page.route("**/yellow-birch-hero-albedo.png", async (route) => {
      requested();
      await gate;
      await route.continue();
    });
    await page.goto(`${base}/?testMode=manual&forceWebGL`, { waitUntil: "domcontentloaded" });
    await request;
    await page.waitForFunction(() => window.advanceTime, null, { timeout: 30000 });
    const initiallyPlain = await page.evaluate(async () => {
      const { createLeafView } = await import("/src/leaf-view.ts");
      const view = createLeafView();
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]);
      view.update({ fragments: [{ id: "piece", positions, uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]), topologyRevision: 0 }] }, { x: 0, y: 0, z: 0 });
      const blade = view.group.children[0].children[0];
      window.pendingLeafView = view;
      window.pendingBlade = blade;
      window.pendingGeometry = blade.geometry;
      window.pendingPositions = positions;
      return !blade.material.map && !blade.material.bumpMap;
    });
    assert.ok(initiallyPlain, "leaf must render with a plain material while loading");
    await page.keyboard.down("e");
    const moved = await page.evaluate(() => {
      const before = JSON.parse(window.render_game_to_text());
      window.advanceTime(2000);
      const after = JSON.parse(window.render_game_to_text());
      return after.time > before.time && after.z < before.z && after.windLevel === 1;
    });
    await page.keyboard.up("e");
    assert.ok(moved, "pending texture must not block physics");
    release();
    const activated = await page.evaluate(async () => {
      await window.pendingLeafView.ready;
      const blade = window.pendingLeafView.group.children[0].children[0];
      const result = blade === window.pendingBlade && blade.geometry === window.pendingGeometry &&
        !!blade.material.map && !!blade.material.bumpMap &&
        JSON.stringify(Array.from(window.pendingPositions)) === JSON.stringify([0, 0, 0, 1, 0, 0, 0, 0, 1]);
      window.pendingLeafView.dispose();
      return result;
    });
    assert.ok(activated, "late texture must activate without replacing fragments or changing physics data");
    await page.close();
  }
  {
    const page = await browser.newPage();
    await page.goto(`${base}/?testMode=manual&forceWebGL`, { waitUntil: "load" });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let requested;
    const request = new Promise((resolve) => { requested = resolve; });
    await page.route("**/yellow-birch-hero-albedo.png", async (route) => {
      requested();
      await gate;
      await route.continue();
    });
    await page.evaluate(async () => {
      const { createLeafSurface } = await import("/src/leaf-surface.ts");
      const surface = createLeafSurface();
      window.testSurface = surface;
      window.fallbackSurface = createLeafSurface();
      window.fallbackSurface.useFallback();
      window.testMaterialDisposals = 0;
      surface.material.addEventListener("dispose", () => window.testMaterialDisposals++);
      surface.dispose();
    });
    await request;
    release();
    const result = await page.evaluate(async () => {
      await window.testSurface.ready;
      await window.fallbackSurface.ready;
      const m = window.testSurface.material;
      const f = window.fallbackSurface.material;
      const fallbackUnchanged = !f.map && !f.bumpMap && f.color.getHex() === 0xb5aa45;
      window.fallbackSurface.dispose();
      return { map: !!m.map, bump: !!m.bumpMap, color: m.color.getHex(), disposals: window.testMaterialDisposals, fallbackUnchanged };
    });
    assert.deepEqual(result, { map: false, bump: false, color: 0xb5aa45, disposals: 1, fallbackUnchanged: true });
    await page.close();
  }
  console.log("Leaf texture failure, pending startup, and late completion after disposal passed");
} finally {
  await browser.close();
}
