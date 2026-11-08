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
  // Inspect the committed export, not just the runtime alphaTest setting.
  const cards = await page.evaluate(async () => {
    const result = [];
    for (const name of ["dandelion_01", "celandine_01", "searsia_lucida"]) {
      const buffer = await (await fetch(`/assets/understory/${name}.glb`)).arrayBuffer();
      const view = new DataView(buffer);
      const jsonLength = view.getUint32(12, true);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
      const binStart = 20 + jsonLength + 8;
      for (const material of json.materials.filter((m) => m.alphaMode === "BLEND" || m.alphaMode === "MASK")) {
        const image = json.images[json.textures[material.pbrMetallicRoughness.baseColorTexture.index].source];
        const chunk = json.bufferViews[image.bufferView];
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(buffer, binStart + (chunk.byteOffset || 0), chunk.byteLength)], { type: image.mimeType }));
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0); bitmap.close();
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let transparent = 0, colored = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 100) transparent++;
          if (pixels[i + 3] > 200 && Math.max(pixels[i], pixels[i+1], pixels[i+2]) - Math.min(pixels[i], pixels[i+1], pixels[i+2]) > 20) colored++;
        }
        result.push({ name, transparent, colored });
      }
    }
    return result;
  });
  for (const name of ["dandelion_01", "celandine_01", "searsia_lucida"]) {
    const materials = cards.filter((m) => m.name === name);
    assert.ok(materials.length > 0, `${name}: no cutout material exported`);
    for (const m of materials) {
      assert.ok(m.transparent > 100, `${name}: opaque foliage card`);
      assert.ok(m.colored > 100, `${name}: mask used as color`);
    }
  }
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
