import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() => {
  window.mockPad = {
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      value: 0,
      pressed: false,
      touched: false,
    })),
  };
  Object.defineProperty(navigator, "getGamepads", {
    value: () => [window.mockPad, null, null, null],
  });
});
await page.goto(
  `${process.env.LEAF_BASE_URL || "http://127.0.0.1:5173"}/?testMode=manual`,
);
await page.waitForFunction(() => window.render_game_to_text);
const read = async () =>
  JSON.parse(await page.evaluate(() => window.render_game_to_text()));
let s = await read();
assert.equal(s.gamepad, true);
await page.evaluate(() => window.advanceTime(2000));
let n = await read();
assert.ok(n.z < s.z - 1);
assert.ok(Math.abs(n.y) < 0.2);
await page.evaluate(() => {
  window.mockPad.axes[0] = 1;
  window.mockPad.buttons[7].value = 1;
  window.advanceTime(2000);
});
let w = await read();
assert.ok(w.x > n.x + 0.2 && w.intensity > 0.9);
await page.evaluate(() => {
  window.mockPad.axes[0] = 0;
  window.mockPad.buttons[7].value = 0;
  window.mockPad.buttons[6].value = 1;
  window.advanceTime(1000);
});
let l = await read();
assert.ok(l.intensity < w.intensity - 0.4);
await page.evaluate(() => {
  window.mockPad.buttons[6].value = 0;
  window.advanceTime(1000);
});
let neutral = await read();
assert.ok(neutral.intensity < l.intensity);
await page.screenshot({ path: "output/web-game/controller.png" });
await page.keyboard.press("r");
await page.keyboard.down("d");
await page.keyboard.down("e");
await page.evaluate(() => window.advanceTime(2000));
await page.keyboard.up("d");
await page.keyboard.up("e");
const keyboard = await read();
assert.ok(keyboard.x > 0.2 && keyboard.intensity > 0.9);
await page.getByRole("button", { name: "River tuning · development" }).click();
await page.getByText("Water / current").waitFor({ state: "visible" });
await page.getByText("Save local preset").click();
assert.ok(await page.evaluate(() => !!localStorage.getItem("leaf-tuning")));
// Quality changes must still resize the drawing buffer after removing per-frame resets.
const quality = page.getByRole("textbox", { name: "quality", exact: true });
await quality.fill("0.5");
await quality.press("Enter");
await page.waitForFunction(
  () => document.querySelector("canvas").width === 640,
);
await quality.fill("1");
await quality.press("Enter");
await page.waitForFunction(
  () => document.querySelector("canvas").width === 1280,
);
assert.deepEqual(errors, []);
const fallback = await browser.newPage();
await fallback.addInitScript(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
  Object.defineProperty(navigator, "getGamepads", { value: () => [] });
});
await fallback.goto(process.env.LEAF_BASE_URL || "http://127.0.0.1:5173/");
await fallback.getByRole("alert").waitFor();
assert.match(
  await fallback.getByRole("alert").textContent(),
  /WebGL is unavailable/,
);
await fallback.close();
console.log(
  JSON.stringify(
    { initial: s, downstream: n, wind: w, lower: l, neutral, keyboard, errors },
    null,
    2,
  ),
);
await browser.close();
