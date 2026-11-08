import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/yellow-birch-hero-albedo.png", (route) => route.abort());
  await page.goto(`${process.env.LEAF_BASE_URL}/?testMode=manual&forceWebGL`);
  await page.waitForFunction(() => window.advanceTime);
  assert.match(await page.locator("#error").textContent(), /keep playing/i);
  const [before, after] = await page.evaluate(() => {
    window.advanceTime(1000);
    const before = JSON.parse(window.render_game_to_text());
    window.advanceTime(1000);
    return [before, JSON.parse(window.render_game_to_text())];
  });
  assert.ok(after.z < before.z, "fallback must allow downstream motion");
  assert.deepEqual(errors, []);
  console.log("Missing leaf texture: fallback and downstream motion passed");
} finally {
  await browser.close();
}
