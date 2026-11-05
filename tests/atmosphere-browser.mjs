import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("output/web-game", { recursive: true });
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? { headless: true, channel: "chrome" }
  : { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual${native ? "" : "&forceWebGL"}`);
  await page.waitForFunction(() => window.advanceTime);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const initial = await read(); assert.equal(initial.renderer, native ? "WebGPU" : "WebGL2");
  assert.equal(initial.sky.engine, "Eanpa-Sky"); assert.equal(initial.sky.cacheSize, native ? 256 : 128); assert.equal(initial.fish.count, 6);
  async function difference(a, b, yStart = 0) {
    return page.evaluate(async ([a, b, yStart]) => {
      async function pixels(encoded) {
        const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width };
      }
      const first = await pixels(a), second = await pixels(b); let changed = 0;
      for (let i = yStart * first.width * 4; i < first.data.length; i += 4)
        if ([0, 1, 2].some((c) => Math.abs(first.data[i + c] - second.data[i + c]) > 3)) changed++;
      return changed;
    }, [a.toString("base64"), b.toString("base64"), yStart]);
  }
  const sky = await page.screenshot({ clip: { x: 320, y: 0, width: 800, height: 240 } });
  await page.evaluate(() => { window.setVerificationSkyVisible(false); window.advanceTime(0); });
  const noSky = await page.screenshot({ clip: { x: 320, y: 0, width: 800, height: 240 } });
  const skyPixels = await difference(sky, noSky); assert.ok(skyPixels > 1500, "sun/clouds are not visible in the sky");
  await page.evaluate(() => { window.setVerificationSkyVisible(true); window.advanceTime(0); });
  const fish = await page.screenshot({ path: `output/web-game/sky-fish-${native ? "native" : "webgl2"}.png` });
  await page.evaluate(() => { window.setVerificationFishVisible(false); window.advanceTime(0); });
  const noFish = await page.screenshot();
  const fishPixels = await difference(fish, noFish, 260); assert.ok(fishPixels > 100, "fish do not reach the visible water capture");
  await page.evaluate(() => { window.setVerificationFishVisible(true); window.advanceTime(0); });
  for (const quality of ["0.5", "1"]) {
    await page.locator("#quality").evaluate((control, value) => { control.value = value; control.dispatchEvent(new Event("change")); }, quality);
    assert.equal((await read()).sky.cacheSize, quality === "1" ? (native ? 256 : 128) : (native ? 128 : 64));
    assert.equal((await read()).sky.refreshSeconds, quality === "1" ? .25 : .75);
  }
  assert.equal((await read()).resources.geometries, initial.resources.geometries);
  for (const x of [-100, 100]) {
    await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&journeyZ=-530&journeyX=${x}${native ? "" : "&forceWebGL"}`);
    await page.waitForFunction(() => window.advanceTime);
    await page.evaluate(() => window.advanceTime(16));
    const oceanSky = await page.screenshot();
    await page.evaluate(() => { window.setVerificationSkyVisible(false); window.advanceTime(0); });
    const bareOcean = await page.screenshot();
    const coverage = await page.evaluate(async ([a, b]) => {
      const decode = async (data) => { const i = new Image(); i.src = `data:image/png;base64,${data}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const ctx = c.getContext("2d"); ctx.drawImage(i, 0, 0); return ctx.getImageData(0, 0, c.width, 200).data; };
      const [first, second] = await Promise.all([decode(a), decode(b)]); let changed = 0;
      for (let i = 0; i < first.length; i += 4) if (Math.abs(first[i]-second[i])+Math.abs(first[i+1]-second[i+1])+Math.abs(first[i+2]-second[i+2]) > 20) changed++;
      return changed / (first.length / 4);
    }, [oceanSky.toString("base64"), bareOcean.toString("base64")]);
    assert.ok(coverage > .8, `sky does not enclose lateral ocean camera at${x}: ${coverage}`);
  }

  const physics = await page.evaluate(async () => {
    const { createRiverLeaf } = await import("/src/river-leaf.ts");
    const { createFishView } = await import("/src/fish-view.ts");
    const { initial, defaults, updateWind } = await import("/src/simulation.ts");
    const { sampleFish } = await import("/src/fish-motion.ts");
    const leaf = await createRiverLeaf(), view = createFishView();
    let result;
    try {
      const state = initial(); const before = leaf.readFishFrame(); let targets;
      for (let i = 0; i < 120; i++) {
        updateWind(state, defaults, { x: 0, z: 0, raise: 0, lower: 0 }, 1 / 120);
        targets = before.map((f) => sampleFish(f.id, state, defaults).position);
        leaf.step(state, defaults);
      }
      const frame = leaf.readFishFrame(), copy = JSON.stringify(frame);
      view.update(frame, state.time);
      const aligned = frame.every((f) => view.group.children[f.id].position.distanceTo(f.position) < 1e-8);
      const maxPositionError = Math.max(...frame.map((f) => {
        const expected = targets[f.id];
        return Math.hypot(f.position.x - expected.x, f.position.y - expected.y, f.position.z - expected.z);
      }));
      const geometries = new Set(), materials = new Set();
      view.group.traverse((o) => { if (o.isMesh) { geometries.add(o.geometry); materials.add(o.material); } });
      let disposed = 0; for (const g of geometries) g.addEventListener("dispose", () => disposed++);
      view.dispose();
      result = { moved: frame[0].position.x !== before[0].position.x, aligned,
        unmodified: JSON.stringify(frame) === copy, maxPositionError, geometries: geometries.size, disposed };
    } finally { leaf.dispose(); }
    const contacts = [];
    for (const enabled of [false, true]) {
      const world = await createRiverLeaf();
      try {
        const pose = world.readFishFrame()[0].position;
        world.reset({ ...pose, y: pose.y + 0.04 });
        let colliders = 0;
        world.world.colliders.forEach((c) => { if (c.parent()?.isKinematic()) { c.setEnabled(enabled); colliders++; } });
        const state = { ...initial(), ...pose, y: pose.y + 0.04 };
        for (let i = 0; i < 10; i++) world.step(state, defaults);
        contacts.push({ enabled, colliders, y: state.y });
      } finally { world.dispose(); }
    }
    return { ...result, contacts };
  });
  assert.ok(physics.moved && physics.aligned && physics.unmodified);
  assert.ok(physics.maxPositionError < 1e-5, JSON.stringify(physics)); assert.equal(physics.disposed, physics.geometries);
  assert.equal(physics.contacts[0].colliders, 6);
  assert.ok(physics.contacts[1].y > physics.contacts[0].y + 0.01, "Rapier fish contacts did not displace the leaf");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ backend: initial.renderer, skyPixels, fishPixels, physics }));
} finally { await browser.close(); }
