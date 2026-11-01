import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
const target = path.resolve("output/main-baseline/src/main.ts");
const original = await readFile(target, "utf8");
const expected = execFileSync(
  "git",
  ["show", "f69dc7d66d4176df8fe0c3bedbccf14845b78277:src/main.ts"],
  { encoding: "utf8" },
);
assert.equal(
  original.replaceAll("\r\n", "\n"),
  expected.replaceAll("\r\n", "\n"),
  "baseline source differs from pinned main",
);
const setup = `\nconst legacyGPUEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('legacyGPUProfile');\nconst legacyGL = renderer.getContext();\nconst legacyExt = legacyGPUEnabled ? legacyGL.getExtension('EXT_disjoint_timer_query_webgl2') : null;\nconst legacyPending: WebGLQuery[] = [];\nconst legacySamples: number[] = [];\n`;
const render = `const legacyQuery = legacyExt && legacyPending.length < 32 ? legacyGL.createQuery() : null;\n  if (legacyQuery && legacyExt) legacyGL.beginQuery(legacyExt.TIME_ELAPSED_EXT, legacyQuery);\n  renderer.render(scene, camera);\n  if (legacyQuery && legacyExt) { legacyGL.endQuery(legacyExt.TIME_ELAPSED_EXT); legacyPending.push(legacyQuery); }\n  while (legacyExt && legacyPending.length && legacyGL.getQueryParameter(legacyPending[0], legacyGL.QUERY_RESULT_AVAILABLE)) {\n    const q = legacyPending.shift()!;\n    if (!legacyGL.getParameter(legacyExt.GPU_DISJOINT_EXT)) legacySamples.push(legacyGL.getQueryParameter(q, legacyGL.QUERY_RESULT) / 1e6);\n    legacyGL.deleteQuery(q);\n    if (legacySamples.length > 300) legacySamples.shift();\n  }`;
const updated = original
  .replace(
    "app.prepend(renderer.domElement);",
    "app.prepend(renderer.domElement);" + setup,
  )
  .replace("renderer.render(scene, camera);", render)
  .replace(
    'coordinateSystem: "x right, z downstream is negative, y up",',
    'coordinateSystem: "x right, z downstream is negative, y up",\n    legacyGpuSupported: !!legacyExt,\n    legacyGpuSamples: legacyGPUEnabled ? legacySamples : undefined,',
  );
assert.notEqual(updated, original);
const results = [];
let browser;
await mkdir("output", { recursive: true });
try {
  await writeFile(target, updated);
  browser = await chromium.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-frame-rate-limit", "--disable-gpu-vsync"],
  });
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      (process.env.LEAF_BASELINE_URL || "http://127.0.0.1:5190") +
        "/?legacyGPUProfile=1",
    );
    await p.waitForFunction(() => window.render_game_to_text);
    const supported = await p.evaluate(
      () => JSON.parse(window.render_game_to_text()).legacyGpuSupported,
    );
    if (!supported) {
      results.push({ width, height, supported: false });
      await p.close();
      continue;
    }
    await p.waitForFunction(
      () =>
        JSON.parse(window.render_game_to_text()).legacyGpuSamples.length >= 90,
      null,
      { timeout: 120000 },
    );
    const state = await p.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    const raw = state.legacyGpuSamples.slice(-60);
    const sorted = [...raw].sort((a, b) => a - b);
    results.push({
      width,
      height,
      supported: true,
      browser: browser.version(),
      backend: state.renderer,
      reflection: state.waterOptics,
      mean: raw.reduce((a, b) => a + b, 0) / raw.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      raw,
      errors,
    });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(results.at(-1)));
    await p.close();
  }
} finally {
  if (browser) await browser.close();
  await writeFile(target, original);
  await writeFile(
    "output/legacy-gpu-timing.json",
    JSON.stringify(results, null, 2),
  );
}
