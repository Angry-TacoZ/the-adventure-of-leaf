# Decisions
- 2026-10-29: James selected Three.js, TypeScript, Vite, browser-first Windows development and a short river slice.
- 2026-10-29: Use a small independently authored shared analytic water/current model and WebGL renderer for first validation; revisit fidelity after observing the interaction. See WATER_TECH_EVALUATION.md.
- Scene layout, colors and tuning in the prototype are temporary engineering choices, not approved final art direction.

- 2026-10-29: James chose five persistent wind levels: calm plus four increasing strengths. Each right/left trigger press changes one level; this supersedes the earlier neutral-trigger automatic return to natural intensity. Neutral stick still removes directed wind.

PR #3 working increment: replace legacy WebGLRenderer/Reflector/Refractor/ShaderMaterial with WebGPURenderer and a single TSL water material. Keep CPU deformation for agreement with physics; native GPU displacement is deferred until measured and compared. Use a screen-color capture so submerged opaque leaf geometry remains available; refine depth handling before artistic acceptance.
