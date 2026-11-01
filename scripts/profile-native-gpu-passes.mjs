import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("output", { recursive: true });
const results = [];
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
});
try {
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ])
    for (const mode of (
      process.env.LEAF_ABLATION_MODES ||
      "full,no-reflection,no-depth,no-color,no-water,no-surface"
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
      await page.goto(
        `http://127.0.0.1:5186/?profile=1&profileGPU=1&waterBenchmark=${mode}`,
      );
      await page.waitForFunction(
        () => window.readVerificationGPUTime && window.render_game_to_text,
      );
      await page.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).frames >= 90,
        null,
        { timeout: 120000 },
      );
      const state = await page.evaluate(() =>
        JSON.parse(window.render_game_to_text()),
      );
      assert.equal(state.renderer, "WebGPU");
      if (mode === "full") {
        assert.equal(state.waterOptics.size, 512);
        assert.equal(state.waterOptics.height, 512);
      }
      const samples = [];
      for (let i = 0; i < 30; i++) {
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        const result = await page.evaluate(() =>
          window.readVerificationGPUTime(),
        );
        if (!result.supported) break;
        samples.push(result.batchTimestampMs);
      }
      const values = [...samples].sort((a, b) => a - b);
      results.push({
        width,
        height,
        mode,
        backend: state.renderer,
        browser: browser.version(),
        copies: state.benchmark?.copies,
        optics: state.waterOptics,
        supported: !!values.length,
        mean: values.reduce((a, b) => a + b, 0) / (values.length || 1),
        p95: values[Math.floor(values.length * 0.95)],
        samples,
      });
      console.log(JSON.stringify(results.at(-1)));
      assert.deepEqual(errors, []);
      await page.close();
    }
} finally {
  await browser.close();
  await writeFile(
    "output/native-gpu-ablation.json",
    JSON.stringify(results, null, 2),
  );
}
