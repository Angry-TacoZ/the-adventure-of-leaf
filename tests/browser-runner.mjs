import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
await mkdir("output/web-game", { recursive: true });
async function run(args, env = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    c.on("error", reject);
    c.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Exit ${code}: ${args}`)),
    );
  });
}
async function suite(mode, script) {
  const port = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      ...(mode === "preview" ? ["preview"] : []),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    { stdio: "inherit" },
  );
  const exited = new Promise((resolve) => server.once("exit", resolve));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null || server.signalCode !== null)
        throw Error("Server exited before ready");
      try {
        if ((await fetch(base)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) throw Error("Server failed to start");
    await run([script], { LEAF_BASE_URL: base });
  } finally {
    server.kill();
    await exited;
  }
}
if (process.argv.includes("--optics")) {
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/whitewater-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/water-entry-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/journey-render-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/journey-physics-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/keyboard-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/storm-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/menu-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/bfcache-native-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/forest-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/opening-browser.mjs");
  if (process.env.LEAF_OPTICS_NATIVE === "1")
    await suite("dev", "tests/atmosphere-browser.mjs");
  await suite("dev", "tests/depth-copy-check.mjs");
  await suite("dev", "tests/refraction-contact-browser.mjs");
  await suite("dev", "tests/optics-verification.mjs");
} else {
  // One canonical list preserves default coverage while CI partitions the work.
  const suites = [
    ["graphics", "dev", "tests/whitewater-browser.mjs"],
    ["graphics", "dev", "tests/water-entry-browser.mjs"],
    ["physics", "dev", "tests/journey-physics-browser.mjs"],
    ["graphics", "dev", "tests/journey-render-browser.mjs"],
    ["interaction", "dev", "tests/keyboard-browser.mjs"],
    ["interaction", "dev", "tests/storm-browser.mjs"],
    ["interaction", "dev", "tests/menu-browser.mjs"],
    ["interaction", "dev", "tests/lifecycle-browser.mjs"],
    ["physics", "dev", "tests/leaf-view-browser.mjs"],
    ["graphics", "dev", "tests/understory-browser.mjs"],
    ["graphics", "dev", "tests/forest-browser.mjs"],
    ["graphics", "dev", "tests/opening-browser.mjs"],
    ["graphics", "dev", "tests/atmosphere-browser.mjs"],
    ["physics", "dev", "tests/rapier-prototype-browser.mjs"],
    ["physics", "dev", "tests/rapier-gameplay-browser.mjs"],
    ["physics", "dev", "tests/rapier-damage-browser.mjs"],
    ["physics", "dev", "tests/browser-check.mjs"],
    ["interaction", "preview", "tests/realtime-browser.mjs"],
  ];
  const group = process.argv.find(a => a.startsWith("--group="))?.slice(8);
  if (group && !suites.some(([name]) => name === group)) throw Error(`Unknown browser group: ${group}`);
  const selected = suites.filter(([name]) => !group || group === name);
  if (process.argv.includes("--list")) console.log(JSON.stringify(selected));
  else for (const [, mode, script] of selected) await suite(mode, script);
}
