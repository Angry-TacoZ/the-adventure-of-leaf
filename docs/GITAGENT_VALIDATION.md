# GitAgent and Codex validation

Validated using the actual published @open-gitagent/gitagent 2.2.0 implementation (installed separately with --ignore-scripts). No model requests were made. `scripts/validate-gitagent.mjs` copies the real manifest, identity, rules, duties, skills, workflows and memory into a temporary directory so the loader's state writes cannot stage project files.

Reproduce: `npm install --ignore-scripts --no-save --prefix <temporary-folder> @open-gitagent/gitagent@2.2.0`, set LEAF_GITAGENT_LIB to that folder's node_modules/@open-gitagent/gitagent/dist/exports.js, then run `node scripts/validate-gitagent.mjs`.

The official discoverSkills and discoverWorkflows APIs find all five skills and six Markdown workflows. loadAgent parses spec_version 0.1.0 and the actual tools/runtime fields, incorporates SOUL.md, RULES.md and DUTIES.md, and points to memory/MEMORY.md through the memory tool. It does not inline the memory file. The validator checks these results rather than merely checking file existence.

model.preferred is intentionally empty and fallback is empty. Calling loadAgent without a model rejects with 'No model configured'; supplying an explicit registry model override loads successfully. This is configurable infrastructure, not an agent ready to make requests without setup. Supply your chosen current provider:model using the CLI --model option and authenticate separately. The validation-only model is not saved in agent.yaml and does not imply a recommended production model. No API key or paid model call is required for validation.

Codex reads root AGENTS.md directly. Its essential creative-authority, inspection, verification and licensing rules are inline, with explicit references to the GitAgent documents. Those references resolve, and they were read in this correction pass. Codex does not need the GitAgent runtime or a model setting in agent.yaml. File/reference validation cannot prove that every future agent will follow instructions.

Official implementation: https://github.com/open-gitagent/gitagent/blob/main/src/loader.ts and https://github.com/open-gitagent/gitagent/blob/main/src/workflows.ts . This validates loader compatibility, not compliance with a nonexistent separate formal schema validator.
