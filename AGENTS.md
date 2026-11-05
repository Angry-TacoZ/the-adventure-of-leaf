# Project guidance
James is creative director. Implement approved gameplay and artistic decisions in docs/GAME_DESIGN.md; ask before introducing mechanics or major artistic choices. Temporary prototype choices must be labeled.

Follow Understand → Inspect → Plan → Implement → Verify → Report. Inspect callers, related systems and configuration; favor small changes and existing code. Verify actual gameplay and rendered visuals, not just builds. Report untested behavior and performance limits. Never copy After Rain source/assets. Track third-party licenses and AI use. Keep Git traceability; use focused branches and PRs after initialization.

Read SOUL.md, RULES.md, DUTIES.md, docs/ARCHITECTURE.md and relevant skills and workflows when applicable. GitAgent files supplement, not replace, these instructions.

## Code Review Rules

- Gameplay leaf motion and deformation must come from the Rapier owner on the existing fixed-step clock. Flag competing position/velocity solvers or cosmetic deformation presented as physical damage. Isolated labeled development probes may use their own scene.
- Physics snapshots belong to the simulation. Display code must copy them into owned buffers; topology changes must replace or dispose stale mesh resources and absent fragment IDs must be removed.
- Preserve approved wind controls, water optics and the requested mountain-to-ocean journey. Draft increments may explicitly defer requirements, but do not treat passing unit/build checks or an isolated prototype as completion of gameplay, visual or journey acceptance.
