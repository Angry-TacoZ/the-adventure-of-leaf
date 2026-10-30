import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
// Install @open-gitagent/gitagent@2.2.0 separately with --ignore-scripts;
// pass its dist/exports.js path, keeping its runtime out of the game dependency tree.
const lib = process.env.LEAF_GITAGENT_LIB;
if (!lib)
  throw Error("Set LEAF_GITAGENT_LIB to the official 2.2.0 dist/exports.js");
const api = await import(pathToFileURL(lib));
const temp = await mkdtemp(join(tmpdir(), "leaf-agent-"));
try {
  for (const path of [
    "agent.yaml",
    "SOUL.md",
    "RULES.md",
    "DUTIES.md",
    "AGENTS.md",
    "skills",
    "workflows",
    "memory",
  ])
    await cp(path, join(temp, path), { recursive: true });
  const skills = await api.discoverSkills(temp),
    workflows = await api.discoverWorkflows(temp);
  assert.equal(skills.length, 5);
  assert.equal(workflows.length, 6);
  await assert.rejects(() => api.loadAgent(temp), /No model configured/);
  // Registry-only model resolution: loadAgent does not invoke the model or spend API tokens.
  const agent = await api.loadAgent(temp, "openai:gpt-4o-mini");
  assert.equal(agent.manifest.spec_version, "0.1.0");
  assert.equal(agent.manifest.model.preferred, "");
  assert.ok(agent.manifest.tools.includes("memory"));
  for (const path of ["SOUL.md", "RULES.md", "DUTIES.md"])
    assert.ok(
      agent.systemPrompt.includes((await readFile(path, "utf8")).trim()),
    );
  assert.ok(agent.systemPrompt.includes("memory/MEMORY.md"));
  const codex = await readFile("AGENTS.md", "utf8");
  for (const f of ["SOUL.md", "RULES.md", "DUTIES.md", "docs/ARCHITECTURE.md"])
    assert.ok(codex.includes(f));
  console.log(
    JSON.stringify(
      {
        officialVersion: "2.2.0",
        manifest: agent.manifest,
        skills: skills.map((s) => s.name),
        workflows: workflows.map((w) => w.name),
        codexRootGuidance: "references resolve; essential rules inline",
        model:
          "empty default rejects as expected; explicit registry override loads; no API request",
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
