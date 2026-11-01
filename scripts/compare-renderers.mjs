import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("output", { recursive: true });
const native = process.env.LEAF_PROFILE_NATIVE === "1";
const browser = await chromium.launch(
  native
    ? { headless: true, channel: "chrome" }
    : {
        headless: true,
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      },
);
const results = [];
try {
  for (const [revision, base] of [
    ["main-f69dc7d", process.env.LEAF_BASELINE_URL || "http://127.0.0.1:5190"],
    ["migration", process.env.LEAF_BASE_URL || "http://127.0.0.1:5186"],
  ])
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (!native)
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "gpu", { value: undefined }),
        );
      await page.goto(base + "/?profile=1");
      await page.waitForFunction(() => window.render_game_to_text);
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).frames >= 180,
        null,
        { timeout: 180000 },
      );
      const s = await page.evaluate(() =>
        JSON.parse(window.render_game_to_text()),
      );
      const stats = {};
      for (const key of ["frame", "deform", "normals", "render"]) {
        const a = s.profile
          .slice(-120)
          .map((x) => x[key])
          .sort((a, b) => a - b);
        stats[key] = {
          mean: a.reduce((a, b) => a + b, 0) / a.length,
          p95: a[Math.floor(a.length * 0.95)],
        };
      }
      const gpu = await page.evaluate(async () => {
        const gl = document.querySelector("canvas").getContext("webgl2");
        if (!gl) {
          const a = await navigator.gpu.requestAdapter();
          return {
            vendor: a.info.vendor,
            architecture: a.info.architecture,
            description: a.info.description,
            isFallbackAdapter: a.info.isFallbackAdapter,
          };
        }
        const e = gl.getExtension("WEBGL_debug_renderer_info");
        return gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
      });
      results.push({
        revision,
        width,
        height,
        backend: s.renderer,
        engine: s.rendererEngine || "WebGLRenderer",
        gpu,
        browser: browser.version(),
        samples: 120,
        stats,
        resources: s.resources,
        optics: s.waterOptics,
      });
      console.log(JSON.stringify(results.at(-1)));
      assert.deepEqual(errors, []);
      if (revision === "migration" && width === 1280) {
        const snapshots = [];
        await page
          .getByRole("button", { name: "River tuning · development" })
          .click();
        for (let i = 0; i < 12; i++) {
          await page.setViewportSize({
            width: i % 2 ? 1280 : 960,
            height: i % 2 ? 720 : 540,
          });
          await page
            .getByRole("textbox", { name: "quality", exact: true })
            .fill(i % 2 ? "1" : "0.5");
          await page
            .getByRole("textbox", { name: "quality", exact: true })
            .press("Enter");
          await page.evaluate(
            () =>
              new Promise((resolve) => {
                let n = 0;
                function f() {
                  if (++n === 8) resolve();
                  else requestAnimationFrame(f);
                }
                requestAnimationFrame(f);
              }),
          );
          if (i % 2)
            snapshots.push(
              await page.evaluate(
                () => JSON.parse(window.render_game_to_text()).resources,
              ),
            );
        }
        results.at(-1).resourceCycles = snapshots;
        await page.waitForTimeout(60000);
        const afterSoak = await page.evaluate(
          () => JSON.parse(window.render_game_to_text()).resources,
        );
        results.at(-1).after60s = afterSoak;
        assert.deepEqual(
          afterSoak,
          snapshots.at(-1),
          "resource growth during 60-second soak",
        );
        assert.deepEqual(
          snapshots.at(-1),
          snapshots.at(-2),
          "resource growth after repeated resize/quality cycles",
        );
      }
      await page.close();
    }
} finally {
  await browser.close();
  await writeFile(
    native
      ? "output/matched-performance-native.json"
      : "output/matched-performance.json",
    JSON.stringify(results, null, 2),
  );
}
