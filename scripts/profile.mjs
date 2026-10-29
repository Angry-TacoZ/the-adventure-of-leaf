import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
try {
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.goto(
      `${process.env.LEAF_BASE_URL || "http://127.0.0.1:5173"}/?profile=1`,
    );
    await page.waitForTimeout(2000);
    await page.waitForTimeout(8000);
    const state = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    const data = state.profile.slice(30);
    const stats = {};
    for (const field of ["frame", "deform", "normals", "render"]) {
      const values = data.map((x) => x[field]).sort((a, b) => a - b);
      stats[field] = {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        p50: values[Math.floor(values.length * 0.5)],
        p95: values[Math.floor(values.length * 0.95)],
      };
    }
    const gl = await page.evaluate(() => {
      const g = document.querySelector("canvas").getContext("webgl2");
      const e = g.getExtension("WEBGL_debug_renderer_info");
      return e
        ? g.getParameter(e.UNMASKED_RENDERER_WEBGL)
        : g.getParameter(g.RENDERER);
    });
    results.push({
      width,
      height,
      dpr: 1,
      samples: data.length,
      browser: browser.version(),
      renderer: gl,
      stats,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
await mkdir("output", { recursive: true });
const result = { cpu: os.cpus()[0].model, platform: os.platform(), results };
await writeFile("output/profile.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
