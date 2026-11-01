import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const label = process.env.LEAF_CAPTURE_LABEL || "before";
const output = `output/optics-ab/${label}`;
await mkdir(output, { recursive: true });
for (const backend of ["software", "hardware"]) {
  const browser = await chromium.launch(
    backend === "hardware"
      ? { headless: true, channel: "chrome" }
      : {
          headless: true,
          args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        },
  );
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
      `http://127.0.0.1:5186/?testMode=manual${backend === "software" ? "&forceWebGL" : ""}`,
    );
    await page.waitForFunction(() => window.advanceTime);
    await page.addStyleTag({ content: "#hud,.lil-gui{visibility:hidden}" });
    await page.evaluate(() => window.advanceTime(3000));
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() =>
      JSON.parse(window.render_game_to_text()),
    );
    if (backend === "hardware" && state.renderer !== "WebGPU")
      throw Error("native WebGPU unavailable");
    for (const [name, offset, pitch] of [
      ["above", 0.14, 0],
      ["partial", 0, 0.35],
      ["submerged", -0.21, 0],
    ]) {
      await page.evaluate(
        ([offset, pitch]) => {
          window.setLeafSubmersion(offset, pitch);
          window.advanceTime(0);
        },
        [offset, pitch],
      );
      await page.screenshot({ path: `${output}/${backend}-${name}.png` });
    }
    if (errors.length) throw Error(JSON.stringify(errors));
    console.log(backend, state.renderer, errors);
    await page.close();
  } finally {
    await browser.close();
  }
}
