import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { writeFile, mkdir, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import os from "node:os";

// Baseline is an immutable git archive, using the same installed dependencies.
// Its Vite cache must be separate from the live workspace's cache.
const baselineSha = process.argv.find(a => a.startsWith("--baseline="))?.slice(11) || "3a9473fb8c174ec568202b7fa9d997c233190ec3";
assert.match(baselineSha, /^[0-9a-f]{40}$/, "Supply an exact baseline commit SHA");
const baselineKey = baselineSha.slice(0, 7);
const baseline = fileURLToPath(new URL(`../output/benchmark-${baselineKey}/`, import.meta.url));
const root = fileURLToPath(new URL("../", import.meta.url));
const archive = path.join(root, "output", `benchmark-${baselineKey}.tar`);
await mkdir(baseline, { recursive: true });
execFileSync("git", ["archive", "--format=tar", `--output=${archive}`,
  baselineSha, "src", "public", "index.html", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts"], { cwd: root });
execFileSync("tar", ["-xf", archive, "-C", baseline]);
if (!existsSync(path.join(baseline, "node_modules")))
  await symlink(path.join(root, "node_modules"), path.join(baseline, "node_modules"), "junction");
await writeFile(path.join(baseline, "vite.config.ts"),
  'import {defineConfig} from "vite";import wasm from "vite-plugin-wasm";export default defineConfig({plugins:[wasm()],cacheDir:".vite-benchmark-cache"});\n');
if (process.argv.includes("--prepare-only")) { console.log(`Prepared baseline ${baseline}`); process.exit(0); }
const port = await new Promise((resolve) => {
  const p = createServer(); p.listen(0, "127.0.0.1", () => { const port = p.address().port; p.close(() => resolve(port)); });
});
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: baseline, stdio: "ignore" });
const exited = new Promise((resolve) => server.once("exit", resolve));
let browser;
const results = [];
const stats = (v) => { const s = [...v].sort((a, b) => a - b); return { mean: v.reduce((a, b) => a + b, 0) / v.length, p95: s[Math.floor(s.length * 0.95)] }; };
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    try { ready = (await fetch(`http://127.0.0.1:${port}`)).ok; } catch {}
    if (!ready) await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "baseline server unavailable");
  for (const backend of ["WebGPU", "WebGL2"])
    for (const [width, height] of [[1280, 720], [1920, 1080]])
      for (const [label, base, z] of [
        ["baseline-headwaters", `http://127.0.0.1:${port}`, 0],
        ["journey-headwaters", process.env.LEAF_BASE_URL || "http://127.0.0.1:5200", 0],
        ["journey-rapids", process.env.LEAF_BASE_URL || "http://127.0.0.1:5200", -140],
        ["journey-ocean", process.env.LEAF_BASE_URL || "http://127.0.0.1:5200", -530],
      ].filter(([label]) => !process.argv.includes("--matched-only") || label.endsWith("headwaters"))) {
        const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 }), errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
        await p.route("**/src/main.ts*", async (route) => {
          const response = await route.fetch(), body = await response.text(), marker = "gameplayReady = true;";
          assert.ok(body.includes(marker), "profiling injection marker changed");
          await route.fulfill({ response, body: body.replace(marker, marker + `
            window.completeProfileFrame = async () => {
              const start = performance.now(); ${process.argv.includes("--animate") ? "state.time += 1 / 60;" : ""} render(0); const submit = performance.now();
              if ('isWebGPUBackend' in renderer.backend) await renderer.backend.device.queue.onSubmittedWorkDone();
              else renderer.backend.gl.finish();
              return { submit: submit-start, complete: performance.now()-start };
            };`) });
        });
        await p.goto(`${base}/?testMode=manual&profile=1&profileGPU=1&journeyZ=${z}${backend === "WebGL2" ? "&forceWebGL" : ""}`);
        await p.waitForFunction(() => window.completeProfileFrame);
        await p.evaluate(async () => {
          const start = performance.now(); let frames = 0;
          while (frames < 60 || performance.now() - start < 1000) { await window.completeProfileFrame(); frames++; }
        });
        await p.screenshot();
        const measured = await p.evaluate(async () => {
          const samples = [];
          for (let i = 0; i < 80; i++) samples.push(await window.completeProfileFrame());
          const adapter = navigator.gpu && await navigator.gpu.requestAdapter();
          return { samples, state: JSON.parse(window.render_game_to_text()),
            adapter: adapter && { vendor: adapter.info.vendor, architecture: adapter.info.architecture, isFallbackAdapter: adapter.info.isFallbackAdapter },
            timestamp: await window.readVerificationGPUTime() };
        });
        assert.equal(measured.state.renderer, backend); assert.deepEqual(errors, []);
        const profile = measured.state.profile.slice(-80);
        const result = { label, backend, viewport: [width, height], quality: 1, adapter: measured.adapter,
          cpuSubmitMs: stats(measured.samples.map((v) => v.submit)),
          serialCompletionMs: stats(measured.samples.map((v) => v.complete)),
          deformMs: stats(profile.map((v) => v.deform)), normalsMs: stats(profile.map((v) => v.normals)),
          reportedBatchTimestamp: measured.timestamp, resources: measured.state.resources, samples: measured.samples };
        results.push(result);
        console.log(JSON.stringify({ label, backend, viewport: result.viewport, cpuSubmitMs: result.cpuSubmitMs, serialCompletionMs: result.serialCompletionMs }));
        await p.close();
      }
  const sourceBlobs = Object.fromEntries(["src/main.ts", "src/sky.ts", "src/weather.ts", "src/weather-view.ts", "src/lightning.ts", "src/water.ts", "src/water-grid.ts", "src/journey.ts", "src/simulation.ts", "src/forest.ts", "src/understory.ts", "src/bank-terrain.ts"].map((file) =>
    [file, execFileSync("git", ["hash-object", `--path=${file}`, file], { cwd: root, encoding: "utf8" }).trim()]));
  await writeFile(process.argv.find(a => a.startsWith("--output="))?.slice(9) || (process.argv.includes("--animate") ? "output/weather-profile.json" : "output/journey-profile.json"), JSON.stringify({ cpu: os.cpus()[0].model, browser: browser.version(), baseline: baselineSha, sourceBlobs, conditions: `${process.argv.includes("--animate") ? "Fixed physical pose, render animation clock advances1/60s per serial frame (no physics integration); cloud refreshes included" : "Fixed pose/time"}, quality1, hardware Chrome, profileGPU instrumentation enabled, 80 serialized frames after at least 60 frames and one second warmup. Completion includes CPU plus GPU queue fence/gl.finish; it is not isolated GPU time or display FPS. Batch timestamps have a narrower scope. Other active GPU work is uncontrolled.`, results }, null, 2));
} finally { await browser?.close(); server.kill(); await exited; }
