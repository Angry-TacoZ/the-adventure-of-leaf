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
await suite("dev", "tests/browser-check.mjs");
await suite("preview", "tests/realtime-browser.mjs");
