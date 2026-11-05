import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { compareLeafSilhouette } from "./leaf-silhouette.mjs";
import { compareLeafContribution } from "./leaf-contribution.mjs";
import { changedPixelFraction } from "./image-difference.mjs";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const counterfactual = process.env.LEAF_ENTRY_COUNTERFACTUAL === "1";
const suffix = `${native ? "native" : "webgl2"}${counterfactual ? "-counterfactual" : ""}`;
const browser = await chromium.launch(native ? { channel: "chrome", headless: true } : {
  headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], results = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  if (counterfactual) await page.route("**/src/water.ts*", async (route) => {
    const response = await route.fetch(), body = await response.text();
    assert.match(body, /side:\s*THREE.DoubleSide/);
    await route.fulfill({ response, body: body.replace(/side:\s*THREE.DoubleSide/, "side: THREE.FrontSide") });
  });
  if (counterfactual) await page.route("**/src/main.ts*", async (route) => {
    const response = await route.fetch(), body = await response.text();
    assert.ok(body.includes(".015"), "near-plane counterfactual marker changed");
    await route.fulfill({ response, body: body.replace(/\.015\b/, ".1") });
  });
  await page.goto(`${process.env.LEAF_BASE_URL || "http://127.0.0.1:5200"}/?testMode=manual&journeyZ=-140&journeyX=2.7${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  for (let frame = 1; frame <= 120; frame++) {
    await page.evaluate(() => window.advanceTime(1000 / 60));
    if (![40, 58, 80, 110].includes(frame)) continue;
    const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const actual = await page.screenshot({ path: `output/web-game/water-entry-${suffix}-${frame}.png` });
    await page.evaluate(() => { window.setVerificationLeafVisible(false); window.advanceTime(0); });
    const actualBackground = await page.screenshot();
    await page.evaluate(() => { window.setVerificationWaterVisible(false); window.advanceTime(0); });
    const referenceBackground = await page.screenshot();
    await page.evaluate(() => { window.setVerificationLeafVisible(true); window.advanceTime(0); });
    const reference = await page.screenshot();
    await page.evaluate(() => { window.setVerificationWaterVisible(true); window.advanceTime(0); });
    const silhouette = await compareLeafContribution(page, reference, referenceBackground, actual, actualBackground);
    const colorMask = await compareLeafSilhouette(page, reference, actual);
    const waterCoverage = await changedPixelFraction(page, actualBackground, referenceBackground, [0.05, 0.25, 0.8, 0.9]);
    results.push({ frame, time: state.time, camera: state.camera, y: state.y, silhouette, colorMask, waterCoverage });
    await writeFile(`output/web-game/water-entry-${suffix}.json`, JSON.stringify(results, null, 2));
    assert.ok(waterCoverage > 0.75, `near-camera water has holes: ${JSON.stringify(results.at(-1))}`);
    assert.ok(silhouette.reference > 1000 && silhouette.coverage > 0.85 && silhouette.area > 0.65 && silhouette.area < 1.4,
      `low rapid camera lost the hero: ${JSON.stringify(results.at(-1))}`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`output/web-game/water-entry-${suffix}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
