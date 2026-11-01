import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.LEAF_BASE_URL || "http://127.0.0.1:5186";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const outputDirectory = native ? "output/optics-native" : "output/optics";
const browser = await chromium.launch(
  native
    ? { headless: true, channel: "chrome" }
    : {
        headless: true,
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      },
);
await mkdir(outputDirectory, { recursive: true });
const results = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    base + (native ? "/?testMode=manual" : "/?forceWebGL&testMode=manual"),
  );
  await page.waitForFunction(() => window.advanceTime);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(window.render_game_to_text()).renderer,
    ),
    native ? "WebGPU" : "WebGL2",
  );
  await page.evaluate(() => window.advanceTime(3000));
  for (const view of (
    process.env.LEAF_OPTICS_VIEWS || "inspection,gameplay,edge,turbulent"
  )
    .split(",")
    .filter((v) => v !== "none")) {
    if (view === "turbulent") {
      await page
        .getByRole("button", { name: "River tuning · development" })
        .click();
      for (const [name, value] of [
        ["turbulence", "0.6"],
        ["ripple", "0.2"],
      ]) {
        const control = page.getByRole("textbox", { name, exact: true });
        await control.fill(value);
        await control.press("Enter");
      }
      for (let i = 0; i < 4; i++) {
        await page.keyboard.down("e");
        await page.evaluate(() => window.advanceTime(20));
        await page.keyboard.up("e");
        await page.evaluate(() => window.advanceTime(20));
      }
      await page.keyboard.down("d");
    }
    for (const offset of [
      0.14, 0.07, 0, -0.07, -0.14, -0.21, -0.14, -0.07, 0, 0.07, 0.14,
    ]) {
      await page.evaluate(
        ([o, v]) => {
          window.setLeafSubmersion(o, 0.25, v);
          window.setVerificationWaterVisible(false);
          window.advanceTime(v === "turbulent" ? 100 : 0);
        },
        [offset, view],
      );
      const reference = await page.screenshot();
      await page.evaluate(() => {
        window.setVerificationWaterVisible(true);
        window.advanceTime(0);
      });
      const actual = await page.screenshot();
      const metrics = await page.evaluate(
        async ([ref, actual]) => {
          async function mask(encoded) {
            const im = new Image();
            im.src = "data:image/png;base64," + encoded;
            await im.decode();
            const c = document.createElement("canvas");
            c.width = im.width;
            c.height = im.height;
            const ctx = c.getContext("2d");
            ctx.drawImage(im, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            const mask = new Uint8Array(c.width * c.height);
            for (let y = 180; y < 700; y++)
              for (let x = 200; x < 1100; x++) {
                const i = (y * c.width + x) * 4;
                if (
                  d[i] > 75 &&
                  d[i + 1] > 75 &&
                  d[i + 2] < Math.min(d[i], d[i + 1]) * 0.65
                )
                  mask[y * c.width + x] = 1;
              }
            let points = [];
            for (let seed = 0; seed < mask.length; seed++) {
              if (!mask[seed]) continue;
              const queue = [seed],
                component = [];
              mask[seed] = 0;
              for (let k = 0; k < queue.length; k++) {
                const i = queue[k];
                component.push([i % c.width, Math.floor(i / c.width)]);
                for (const n of [i - 1, i + 1, i - c.width, i + c.width])
                  if (n >= 0 && n < mask.length && mask[n]) {
                    mask[n] = 0;
                    queue.push(n);
                  }
              }
              if (component.length > points.length) points = component;
            }
            return points;
          }
          const a = await mask(ref),
            b = await mask(actual);
          const cells = new Set(
            b.map(([x, y]) => Math.floor(x / 16) + "," + Math.floor(y / 16)),
          );
          let matched = 0;
          for (const [x, y] of a) {
            let hit = false;
            for (let dx = -1; dx <= 1; dx++)
              for (let dy = -1; dy <= 1; dy++)
                if (
                  cells.has(
                    Math.floor(x / 16) + dx + "," + (Math.floor(y / 16) + dy),
                  )
                )
                  hit = true;
            if (hit) matched++;
          }
          return {
            reference: a.length,
            actual: b.length,
            coverage: matched / Math.max(1, a.length),
            area: b.length / Math.max(1, a.length),
          };
        },
        [reference.toString("base64"), actual.toString("base64")],
      );
      results.push({ view, offset, ...metrics });
      console.log(results.at(-1));
      if (
        metrics.reference > 500 &&
        (metrics.coverage <= 0.85 ||
          metrics.area <= 0.65 ||
          metrics.area >= 1.4)
      )
        await writeFile(`${outputDirectory}/failed.png`, actual);
      assert.ok(metrics.reference > 500, "reference leaf outside test region");
      if (metrics.reference > 500) {
        assert.ok(
          metrics.coverage > 0.85,
          "missing silhouette " + JSON.stringify(results.at(-1)),
        );
        assert.ok(
          metrics.area > 0.65 && metrics.area < 1.4,
          "silhouette area/ghost " + JSON.stringify(results.at(-1)),
        );
      }
      if (offset === 0 || offset === -0.21) {
        await writeFile(
          `${outputDirectory}/${view}-${offset}-reference.png`,
          reference,
        );
        await page.screenshot({
          path: `${outputDirectory}/${view}-${offset}.png`,
        });
      }
    }
  }
  await page.reload();
  await page.waitForFunction(() => window.advanceTime);
  await page.evaluate(() => {
    window.advanceTime(3000);
    window.setVerificationWaterVisible(false);
    window.advanceTime(0);
  });
  const foregroundReference = await page.screenshot();
  await page.evaluate(() => {
    window.setVerificationWaterVisible(true);
    window.advanceTime(0);
  });
  const foregroundActual = await page.screenshot({
    path: `${outputDirectory}/foreground.png`,
  });
  const foreground = await page.evaluate(
    async ([a, b]) => {
      async function data(encoded) {
        const im = new Image();
        im.src = "data:image/png;base64," + encoded;
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.width;
        c.height = im.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(im, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      }
      const ref = await data(a),
        actual = await data(b);
      return [
        [540, 260, 240, 50],
        [0, 310, 160, 25],
        [1120, 310, 160, 25],
      ].map(([x, y, w, h]) => {
        let changed = 0;
        for (let j = y; j < y + h; j++)
          for (let i = x; i < x + w; i++) {
            const k = (j * 1280 + i) * 4;
            if (
              Math.max(
                ...[0, 1, 2].map((c) => Math.abs(ref[k + c] - actual[k + c])),
              ) > 3
            )
              changed++;
          }
        return { x, y, w, h, changedFraction: changed / (w * h) };
      });
    },
    [
      foregroundReference.toString("base64"),
      foregroundActual.toString("base64"),
    ],
  );
  results.push({ foreground });
  assert.ok(
    foreground.every((x) => x.changedFraction < 0.01),
    "water overwrote above-water rock/bank regions " +
      JSON.stringify(foreground),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${outputDirectory}/results.json`,
    JSON.stringify({ results, errors }, null, 2),
  );
} finally {
  await browser.close();
}
