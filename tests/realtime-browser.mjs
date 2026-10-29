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
  const start = await read();
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
  assert.ok(passed.frames > start.frames + 100);
  assert.ok(passed.time > 8);
  assert.equal(passed.manual, false);
  assert.ok(passed.camera.z < start.camera.z - 8);
  assert.ok(Math.abs(passed.camera.x - passed.x) < 0.8);
  assert.ok(Math.abs(passed.camera.z - passed.z - 7.5) < 1);
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
    window.mockPad.buttons[7].value = 1;
  });
  await page.waitForFunction(() => {
    const s = JSON.parse(window.render_game_to_text());
    return s.intensity > 0.95 && s.x > 0.35;
  });
  const wind = await read();
  await page.screenshot({ path: "output/web-game/directional-wind.png" });
  await page.evaluate(() => {
    window.mockPad.axes[0] = 0;
    window.mockPad.buttons[7].value = 0;
    window.mockPad.buttons[6].value = 1;
  });
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).intensity < 0.2,
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
    JSON.stringify({ start, passed, wind, maxCameraStep, errors }, null, 2),
  );
  console.log(
    "Real animation frames: natural obstacle passage, camera follow, controller triggers/direction/disconnect, keyboard and neutral release passed",
  );
} finally {
  await browser.close();
}
