import { compareDiagnosticLeaf } from "./leaf-diagnostic.mjs";
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
  await page.evaluate(() => { window.advanceTime(3000); window.setVerificationLeafDiagnostic(true); });
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
      const metrics = await compareDiagnosticLeaf(page, reference, actual);
      results.push({ view, offset, ...metrics });
      console.log(results.at(-1));
      if (
        metrics.reference > 500 &&
        (metrics.coverage <= 0.85 ||
          metrics.area <= 0.65 ||
          metrics.area >= 1.4)
      )
        {
          await writeFile(`${outputDirectory}/failed.png`, actual);
          await writeFile(`${outputDirectory}/failed-reference.png`, reference);
        }
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
