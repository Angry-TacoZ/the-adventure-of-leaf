import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const base = process.env.LEAF_BASE_URL || "http://127.0.0.1:5173";
await mkdir("output/web-game", { recursive: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined });
    window.bufferWrites = 0;
    for (const name of ["width", "height"]) {
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLCanvasElement.prototype,
        name,
      );
      Object.defineProperty(HTMLCanvasElement.prototype, name, {
        ...descriptor,
        set(value) {
          window.bufferWrites++;
          descriptor.set.call(this, value);
        },
      });
    }
    window.mockPad = {
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [window.mockPad],
    });
  });
  await page.goto(base);
  await page.waitForFunction(() => window.render_game_to_text);
  const read = () =>
    page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(
    await page.evaluate(() => typeof window.advanceTime),
    "undefined",
  );
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          let count = 0;
          function frame() {
            if (++count === 12) resolve();
            else requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        }),
    );
  await settle();
  await page.locator("#quality").selectOption("0.5");
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).waterOptics.size === 160,
  );
  assert.equal(await page.locator("canvas").evaluate((c) => c.width), 640);
  await page.locator("#quality").selectOption("1");
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).waterOptics.size === 640,
  );
  await settle();
  const writes = await page.evaluate(() => window.bufferWrites);
  await settle();
  assert.equal(
    await page.evaluate(() => window.bufferWrites),
    writes,
    "steady frames reset drawing buffer",
  );
  await page.setViewportSize({ width: 1100, height: 700 });
  await settle();
  assert.deepEqual(
    await page.locator("canvas").evaluate((c) => [c.width, c.height]),
    [1100, 700],
  );
  const resized = await page.evaluate(() => window.bufferWrites);
  assert.ok(resized > writes);
  await settle();
  assert.equal(
    await page.evaluate(() => window.bufferWrites),
    resized,
    "resize continued every frame",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await settle();
  const start = await read();
  assert.equal(start.rendererEngine, "WebGPURenderer");
  assert.equal(start.renderer, "WebGL2");
  await page.evaluate(() => {
    window.cameraTrack = [];
    function observe() {
      const s = JSON.parse(window.render_game_to_text());
      window.cameraTrack.push({ x: s.camera.x, y: s.camera.y, z: s.camera.z });
      if (s.z >= -13) requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  });
  // Observe the real requestAnimationFrame loop, without calling advanceTime.
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).z < -13,
    {},
    { timeout: 60000 },
  );
  const passed = await read();
  assert.ok(passed.frames > start.frames + 10);
  assert.ok(passed.time > start.time + 1);
  assert.ok(passed.z < start.z - 3);
  assert.ok(passed.time > 8);
  assert.ok(Math.abs(passed.x) < 2.5, "natural current drifted too near bank");
  assert.equal(passed.manual, false);
  assert.ok(passed.waterOptics.captures > start.waterOptics.captures);
  assert.equal(
    await page.evaluate(() => typeof window.setWaterOptics),
    "undefined",
  );
  assert.ok(passed.camera.z < start.camera.z - 2);
  assert.ok(Math.abs(passed.camera.x - passed.x) < 0.8);
  assert.ok(Math.abs(passed.camera.z - passed.z - 0.65) < 1);
  const track = await page.evaluate(() => window.cameraTrack);
  let maxCameraStep = 0;
  for (let i = 1; i < track.length; i++)
    maxCameraStep = Math.max(
      maxCameraStep,
      Math.hypot(
        track[i].x - track[i - 1].x,
        track[i].y - track[i - 1].y,
        track[i].z - track[i - 1].z,
      ),
    );
  assert.ok(maxCameraStep < 0.5, `Camera discontinuity ${maxCameraStep}`);
  await page.screenshot({ path: "output/web-game/obstacle-passed.png" });
  await page.keyboard.press("r");
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).time < 1,
  );
  await page.evaluate(() => {
    window.mockPad.axes[0] = 1;
  });
  for (let i = 1; i <= 4; i++) {
    await page.evaluate(() => {
      window.mockPad.buttons[7].value = 1;
    });
    await page.waitForFunction(
      (level) => JSON.parse(window.render_game_to_text()).windLevel === level,
      i,
    );
    await page.evaluate(() => {
      window.mockPad.buttons[7].value = 0;
    });
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).raisePressed,
    );
  }
  await page.waitForFunction(() => {
    const s = JSON.parse(window.render_game_to_text());
    return s.intensity > 0.9 && s.x > 0.35;
  });
  const wind = await read();
  assert.ok(wind.windStreaks > 0);
  await page.screenshot({ path: "output/web-game/directional-wind.png" });
  await page.evaluate(() => {
    window.mockPad.axes[0] = 0;
  });
  for (let i = 3; i >= 0; i--) {
    await page.evaluate(() => {
      window.mockPad.buttons[6].value = 1;
    });
    await page.waitForFunction(
      (level) => JSON.parse(window.render_game_to_text()).windLevel === level,
      i,
    );
    await page.evaluate(() => {
      window.mockPad.buttons[6].value = 0;
    });
    await page.waitForFunction(
      () => !JSON.parse(window.render_game_to_text()).lowerPressed,
    );
  }
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).intensity < 0.2,
  );
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).windStreaks === 0,
  );
  await page.evaluate(() => {
    window.mockPad.connected = false;
  });
  await page.waitForFunction(
    () => !JSON.parse(window.render_game_to_text()).gamepad,
  );
  await page.keyboard.down("a");
  await page.keyboard.down("e");
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).windX < -0.8,
  );
  await page.keyboard.up("a");
  await page.keyboard.up("e");
  await page.waitForFunction(
    () => Math.abs(JSON.parse(window.render_game_to_text()).windX) < 0.1,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "output/web-game/realtime.json",
    JSON.stringify(
      {
        start,
        passed,
        wind,
        maxCameraStep,
        bufferWrites: { steady: writes, afterResize: resized },
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Real animation frames: natural obstacle passage, camera follow, controller triggers/direction/disconnect, keyboard and neutral release passed",
  );
} finally {
  await browser.close();
}
