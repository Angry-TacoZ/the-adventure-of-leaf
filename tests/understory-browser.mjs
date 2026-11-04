import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.LEAF_BASE_URL;
  await page.goto(`${base}/?testMode=manual&forceWebGL`);
  await page.waitForFunction(() => window.advanceTime);
  const read = () =>
    page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const initial = await read();
  assert.deepEqual(initial.understory.species, [
    "fern_02",
    "grass_medium_01",
    "moss_01",
    "nettle_plant",
  ]);
  assert.ok(initial.understory.instances >= 250);
  const resources = initial.resources;
  for (const quality of ["0.5", "1", "0.5", "1"]) {
    await page.locator("#quality").evaluate((e, q) => {
      e.value = q;
      e.dispatchEvent(new Event("change"));
    }, quality);
    await page.evaluate(() => window.advanceTime(0));
    assert.equal(
      (await read()).understory.instances,
      quality === "1"
        ? initial.understory.instances
        : initial.understory.instances / 2,
    );
  }
  assert.equal(
    (await read()).resources.geometries,
    resources.geometries,
    "quality reallocated vegetation geometry",
  );
  await page.goto(`${base}/?testMode=manual&forceWebGL&understory=compare`);
  await page.waitForFunction(() => window.advanceTime);
  assert.equal((await read()).understory.species.length, 7);
  assert.equal((await read()).renderer, "WebGL2");
  await page.screenshot({ path: "output/understory-compare-webgl2.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Understory assets, WebGL2 comparison and allocation-stable quality changes passed",
  );
} finally {
  await browser.close();
}
