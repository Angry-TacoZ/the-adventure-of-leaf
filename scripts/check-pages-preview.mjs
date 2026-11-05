import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const revision = process.argv[2];
if (!revision) throw Error("Supply the expected deployed commit SHA");
await mkdir("output", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("https://angry-tacoz.github.io/the-adventure-of-leaf/");
  await page.waitForFunction(() => window.render_game_to_text, null, { timeout: 60000 });
  const label = await page.locator("#hud span").textContent();
  assert.ok(label.includes(revision.slice(0, 7)) && label.includes("Development preview"), label);
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const start = await page.getByRole("button", { name: "Begin journey", exact: true }).count();
  if (start) {
    await page.screenshot({ path: "output/pages-preview-home.png" });
    await page.getByRole("button", { name: "Begin journey", exact: true }).click();
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).opening.phase === "afloat", null, { timeout: 60000 });
  const before = await read();
  assert.equal(before.physics.engine, "Rapier"); assert.ok(before.forest.totalTrees >= 48);
  assert.ok(before.understory.species.includes("moss_01"));
  assert.equal(await page.evaluate(() => typeof window.advanceTime), "undefined");
  await page.keyboard.down("d"); await page.keyboard.press("e");
  await page.waitForFunction((x) => {
    const s = JSON.parse(window.render_game_to_text());
    return s.windLevel === 1 && s.x > x + 0.15;
  }, before.x, { timeout: 20000 });
  await page.keyboard.up("d");
  const after = await read();
  await page.screenshot({ path: "output/pages-preview-gameplay.png" });
  if (start) {
    await page.keyboard.press("Escape");
    assert.equal((await read()).menu, "pause");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("slider", { name: "master volume", exact: true }).fill("0");
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.levels.master === 0);
  }
  assert.deepEqual(errors, []);
  const result = { label, backend: after.renderer, before: { x: before.x, z: before.z },
    after: { x: after.x, z: after.z, windLevel: after.windLevel }, menus: !!start, errors };
  await writeFile("output/pages-preview.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
