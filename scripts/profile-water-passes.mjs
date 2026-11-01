import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import os from "node:os";
await mkdir("output", { recursive: true });
const results = [];
for (const backend of process.env.LEAF_ABLATION_BACKEND
  ? [process.env.LEAF_ABLATION_BACKEND]
  : ["software", "hardware"]) {
  const flags = ["--disable-frame-rate-limit", "--disable-gpu-vsync"];
  const browser = await chromium.launch(
    backend !== "software"
      ? { headless: true, channel: "chrome", args: flags }
      : {
          headless: true,
          args: [
            ...flags,
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
  );
  try {
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
    ])
      for (const mode of (
        process.env.LEAF_ABLATION_MODES ||
        "main,full,no-reflection,no-depth,no-color,no-water,no-surface"
      ).split(",")) {
        const page = await browser.newPage({
          viewport: { width, height },
          deviceScaleFactor: 1,
        });
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        if (backend === "software")
          await page.addInitScript(() =>
            Object.defineProperty(navigator, "gpu", { value: undefined }),
          );
        const base =
          mode === "main"
            ? process.env.LEAF_BASELINE_URL || "http://127.0.0.1:5190"
            : process.env.LEAF_BASE_URL || "http://127.0.0.1:5186";
        await page.goto(
          `${base}/?profile=1${mode === "main" ? "" : `&waterBenchmark=${mode}${backend === "hardware-fallback" ? "&forceWebGL" : ""}`}`,
        );
        await page.waitForFunction(() => window.render_game_to_text);
        await page.waitForFunction(
          () => JSON.parse(window.render_game_to_text()).frames >= 90,
          null,
          { timeout: 180000 },
        );
        const state = await page.evaluate(() =>
          JSON.parse(window.render_game_to_text()),
        );
        const data = state.profile.slice(-60);
        assert.equal(data.length, 60);
        const stats = {};
        for (const k of ["frame", "deform", "normals", "render"]) {
          const v = data.map((x) => x[k]).sort((a, b) => a - b);
          stats[k] = {
            mean: v.reduce((a, b) => a + b, 0) / v.length,
            p95: v[Math.floor(v.length * 0.95)],
          };
        }
        const gpu = await page.evaluate(async () => {
          const canvas = document.querySelector("canvas");
          const gl = canvas.getContext("webgl2");
          if (gl) {
            const ext = gl.getExtension("WEBGL_debug_renderer_info");
            return {
              name: gl.getParameter(
                ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
              ),
              timerQuery: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
            };
          }
          const adapter = await navigator.gpu.requestAdapter();
          return {
            vendor: adapter.info.vendor,
            architecture: adapter.info.architecture,
            isFallbackAdapter: adapter.info.isFallbackAdapter,
            features: [...adapter.features],
          };
        });
        if (mode === "full") {
          assert.equal(state.waterOptics.size, 512);
          assert.equal(state.waterOptics.height, 512);
        }
        if (backend === "hardware" && mode !== "main")
          assert.equal(state.renderer, "WebGPU");
        if (backend === "hardware-fallback" && mode !== "main")
          assert.equal(state.renderer, "WebGL2");
        assert.deepEqual(errors, []);
        results.push({
          backend,
          mode,
          width,
          height,
          browser: browser.version(),
          renderer: state.renderer,
          engine: state.rendererEngine || "WebGLRenderer",
          gpu,
          stats,
          copies: state.benchmark?.copies,
          frames: state.frames,
          optics: state.waterOptics,
        });
        console.log(JSON.stringify(results.at(-1)));
        await page.close();
      }
  } finally {
    await browser.close();
    await writeFile(
      process.env.LEAF_ABLATION_BACKEND
        ? `output/water-ablation-${backend}.json`
        : "output/water-ablation.json",
      JSON.stringify(
        { cpu: os.cpus()[0].model, platform: os.platform(), results },
        null,
        2,
      ),
    );
  }
}
