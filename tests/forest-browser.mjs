import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("output/web-game", { recursive: true });
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const hardwareGL = process.env.LEAF_FOREST_HARDWARE_GL === "1";
const suffix = native ? "native" : hardwareGL ? "hardware-webgl2" : "webgl2";
const browser = await chromium.launch(native || hardwareGL
  ? { headless: true, channel: "chrome" }
  : { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const base = process.env.LEAF_BASE_URL;
  await page.goto(`${base}/?testMode=manual${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const initial = await read();
  assert.equal(initial.renderer, native ? "WebGPU" : "WebGL2");
  assert.ok(initial.forest.totalTrees >= 48);
  assert.equal(initial.forest.variants, 3);
  assert.equal(initial.forest.species, "Betula alleghaniensis");
  assert.equal(initial.forest.windDisplacement, 0);
  assert.ok(initial.forest.trees > 20);
  const openingTree = await page.evaluate(async () => {
    const { createForest } = await import("/src/forest.ts");
    const owner = createForest(), matrix = owner.group.matrix.clone();
    try {
      const results = [];
      for (const quality of [1, 0.5, 1, 0.5]) {
        owner.update(0, 0, 0, 0, quality, 4);
        let supportingTrunk = false;
        for (let batch = 0; batch < owner.group.children.length; batch += 2) {
          const trunk = owner.group.children[batch];
          for (let i = 0; i < trunk.count; i++) {
            trunk.getMatrixAt(i, matrix);
            if (Math.abs(matrix.elements[12] - 6.7) < 1e-4 && Math.abs(matrix.elements[14] - 3) < 1e-4)
              supportingTrunk = true;
          }
        }
        results.push({ quality, supportingTrunk });
      }
      return results;
    } finally { owner.dispose(); }
  });
  assert.ok(openingTree.every((r) => r.supportingTrunk),
    `the physical opening bough lost its supporting tree: ${JSON.stringify(openingTree)}`);
  for (const quality of ["0.5", "1", "0.5", "1"]) {
    await page.locator("#quality").evaluate((e, value) => {
      e.value = value; e.dispatchEvent(new Event("change"));
    }, quality);
    const current = await read();
    assert.equal(current.resources.geometries, initial.resources.geometries);
    if (quality === "1") {
      assert.equal(current.forest.trees, initial.forest.trees);
      assert.equal(current.forest.leafTriangles, initial.forest.leafTriangles);
    } else {
      assert.ok(current.forest.trees > 0 && current.forest.trees < initial.forest.trees);
      assert.ok(current.forest.leafTriangles < initial.forest.leafTriangles * 0.3);
    }
  }
  await page.screenshot({ path: `output/web-game/forest-gameplay-${suffix}.png` });
  for (let level = 0; level < 4; level++) {
    await page.keyboard.down("e"); await page.evaluate(() => window.advanceTime(20));
    await page.keyboard.up("e"); await page.evaluate(() => window.advanceTime(20));
  }
  await page.keyboard.down("d"); await page.evaluate(() => window.advanceTime(1000)); await page.keyboard.up("d");
  assert.ok((await read()).forest.windDisplacement > 0.1);
  await page.getByRole("button", { name: "River tuning · development" }).click();
  const windStrength = page.getByRole("textbox", { name: "windStrength", exact: true });
  await windStrength.fill("0"); await windStrength.press("Enter");
  assert.equal((await read()).forest.windDisplacement, 0, "trees ignored disabled environment wind");
  await page.close();

  // Isolate tree animation from moving water/leaf, and exercise real owner cleanup.
  const fixture = await browser.newPage({ viewport: { width: 900, height: 700 } });
  fixture.on("pageerror", (e) => errors.push(e.message));
  fixture.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await fixture.route((url) => url.pathname === "/forest-fixture", (route) => route.fulfill({ contentType: "text/html", body:
    '<style>body{margin:0}</style><script type="module" src="/tests/forest-fixture.mjs"></script>' }));
  await fixture.goto(`${base}/forest-fixture${native ? "" : "?forceWebGL"}`);
  await fixture.waitForFunction(() => window.drawForest);
  assert.equal(await fixture.evaluate(() => window.forestBackend), native ? "WebGPU" : "WebGL2");
  const calm = await fixture.screenshot();
  await fixture.evaluate(() => window.drawForest(0, 1));
  const bent = await fixture.screenshot();
  await fixture.evaluate(() => window.drawForest(1, 1));
  const swayed = await fixture.screenshot({ path: `output/web-game/forest-isolated-${suffix}.png` });
  assert.notDeepEqual(calm, bent, "directed wind did not bend the trees");
  assert.notDeepEqual(bent, swayed, "wind sway did not animate");
  const near = await fixture.evaluate(() => window.forestDiagnostics());
  await fixture.evaluate(() => window.drawForest(0, 0, -105));
  const downstream = await fixture.evaluate(() => window.forestDiagnostics());
  assert.ok(downstream.trees > 0 && downstream.trees < downstream.totalTrees);
  await fixture.evaluate(() => window.drawForest(0, 0, 0));
  assert.equal((await fixture.evaluate(() => window.forestDiagnostics())).trees, near.trees);
  assert.deepEqual(await fixture.screenshot(), calm, "returning upstream changed static tree placement");
  const allocated = await fixture.evaluate(() => window.forestResources());
  assert.ok(allocated.geometries > 0);
  await fixture.evaluate(() => window.disposeForest());
  assert.equal((await fixture.evaluate(() => window.forestResources())).geometries,
    await fixture.evaluate(() => window.emptyForestResources.geometries));
  assert.deepEqual(errors, []);
  console.log(`Forest placement, quality stability, visible wind sway and disposal passed on ${native ? "WebGPU" : "WebGL2"}`);
} finally { await browser.close(); }
