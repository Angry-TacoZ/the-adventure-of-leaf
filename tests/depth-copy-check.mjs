import { chromium } from "playwright";
import assert from "node:assert/strict";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(
  native
    ? { headless: true, channel: "chrome" }
    : {
        headless: true,
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      },
);
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${process.env.LEAF_BASE_URL || "http://127.0.0.1:5186"}/?testMode=manual&waterBenchmark=full${native ? "" : "&forceWebGL"}`,
  );
  await page.waitForFunction(() => window.advanceTime);
  const result = await page.evaluate(() => {
    window.advanceTime(0);
    const before = JSON.parse(window.render_game_to_text());
    window.advanceTime(0);
    const after = JSON.parse(window.render_game_to_text());
    return {
      backend: after.renderer,
      depth: after.benchmark.copies.depth - before.benchmark.copies.depth,
      color: after.benchmark.copies.color - before.benchmark.copies.color,
      optics: after.waterOptics,
    };
  });
  assert.equal(result.backend, native ? "WebGPU" : "WebGL2");
  assert.equal(result.depth, 1, "water should copy scene depth once per frame");
  assert.equal(result.color, 1, "water should copy scene color once per frame");
  assert.equal(result.optics.size, 512);
  assert.equal(result.optics.height, 512);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
