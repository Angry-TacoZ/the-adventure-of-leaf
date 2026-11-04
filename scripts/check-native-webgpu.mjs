import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("output", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.LEAF_BROWSER_CHANNEL || undefined,
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
let result;
try {
  await page.goto(
    (process.env.LEAF_BASE_URL || "http://127.0.0.1:5186") +
      "/?profile=1&profileGPU=1",
    { waitUntil: "domcontentloaded" },
  );
  result = await page.evaluate(async () => {
    if (!navigator.gpu)
      return { available: false, reason: "navigator.gpu unavailable" };
    const adapter = await navigator.gpu.requestAdapter();
    return adapter
      ? {
          available: true,
          info: adapter.info.toJSON?.() || {
            vendor: adapter.info.vendor,
            architecture: adapter.info.architecture,
            device: adapter.info.device,
            description: adapter.info.description,
            isFallbackAdapter: adapter.info.isFallbackAdapter,
          },
        }
      : { available: false, reason: "requestAdapter returned null" };
  });
  if (result.available) {
    await page.waitForFunction(() => window.render_game_to_text);
    await page.waitForFunction(
      () => JSON.parse(window.render_game_to_text()).frames > 20,
    );
    result.opening = await page.evaluate(() => JSON.parse(window.render_game_to_text()).opening);
    await page.waitForFunction(() => {
      const s = JSON.parse(window.render_game_to_text());
      return s.opening.phase === "afloat" && s.z < 0;
    }, null, { timeout: 60000 });
    result.gameplay = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    assert.equal(result.gameplay.renderer, "WebGPU");
    assert.ok(result.gameplay.time > 0 && result.gameplay.z < 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(
      (frames) => JSON.parse(window.render_game_to_text()).frames > frames + 20,
      result.gameplay.frames,
    );
    await page.screenshot({ path: "output/native-webgpu.png" });
    const timings = [];
    for (let i = 0; i < 30; i++) {
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(resolve)),
      );
      const timing = await page.evaluate(async () =>
        window.readVerificationGPUTime
          ? await window.readVerificationGPUTime()
          : { supported: false },
      );
      if (!timing.supported) {
        result.gpuTiming = timing;
        break;
      }
      timings.push(timing.batchTimestampMs);
    }
    if (timings.length) {
      const sorted = [...timings].sort((a, b) => a - b);
      result.gpuTiming = {
        supported: true,
        samples: timings.length,
        width: 1440,
        height: 900,
        meanMs: timings.reduce((a, b) => a + b, 0) / timings.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        raw: timings,
      };
    }
    assert.deepEqual(errors, []);
  }
  console.log(JSON.stringify({ result, errors }));
  await writeFile(
    "output/native-webgpu-attempt.json",
    JSON.stringify(
      {
        browser: browser.version(),
        channel: process.env.LEAF_BROWSER_CHANNEL || "chromium",
        result,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    "output/native-webgpu-attempt.json",
    JSON.stringify({ result, errors, failure: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
