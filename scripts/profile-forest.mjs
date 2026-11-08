import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";

// Fixed-pose draw ablation. CPU submission costs are not GPU time or FPS.
const results = [];
const quality = process.env.LEAF_FOREST_QUALITY || "1";
assert.ok(["1", "0.5"].includes(quality));
for (const native of [true, false]) {
  const browser = await chromium.launch(native
    ? { channel: "chrome", headless: true }
    : { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const visible of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let patched = false;
      if (!visible) await page.route("**/src/forest.ts*", async (route) => {
        const response = await route.fetch(); const code = await response.text();
        const marker = 'group.name = "Appalachian yellow-birch canopy";';
        assert.ok(code.includes(marker), "forest draw ablation source changed");
        patched = true;
        await route.fulfill({ response, body: code.replace(marker, marker + " group.visible = false;") });
      });
      await page.goto(`${process.env.LEAF_BASE_URL || "http://127.0.0.1:5200"}/?testMode=manual&profile=1${native ? "" : "&forceWebGL"}`);
      await page.waitForFunction(() => window.advanceTime);
      if (!visible) assert.ok(patched);
      await page.locator("#quality").evaluate((control, value) => {
        control.value = value; control.dispatchEvent(new Event("change"));
      }, quality);
      await page.evaluate(() => { for (let i = 0; i < 5; i++) window.advanceTime(0); });
      await page.screenshot(); // Finish initial shader compilation/capture before samples.
      const measured = await page.evaluate(() => new Promise((resolve) => {
        const wall = [], intervals = [];
        let first, previous;
        function frame(now) {
          first ??= now;
          if (previous !== undefined) intervals.push(now - previous);
          previous = now;
          const start = performance.now(); window.advanceTime(0); wall.push(performance.now() - start);
          if (now - first >= 4000)
            resolve({ wall, intervals, state: JSON.parse(window.render_game_to_text()) });
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }));
      const stats = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        return { mean: values.reduce((a, b) => a + b, 0) / values.length, p95: sorted[Math.floor(sorted.length * 0.95)] };
      };
      assert.equal(measured.state.renderer, native ? "WebGPU" : "WebGL2");
      assert.deepEqual(errors, []);
      results.push({ backend: measured.state.renderer, software: !native, forestVisible: visible,
        browser: browser.version(), wallMs: stats(measured.wall),
        frameIntervalMs: stats(measured.intervals), samples: measured.wall.length,
        renderSubmitMs: stats(measured.state.profile.slice(-measured.wall.length).map((p) => p.render)),
        resources: measured.state.resources, forest: measured.state.forest });
      await page.close();
    }
  } finally { await browser.close(); }
}
await mkdir("output", { recursive: true });
const result = { cpu: os.cpus()[0].model, viewport: [1280, 720], quality: Number(quality), windowMsPerCase: 4000, results };
await writeFile(`output/forest-profile${quality === "1" ? "" : "-low"}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
