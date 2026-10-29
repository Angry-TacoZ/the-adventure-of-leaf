# Architecture

`src/simulation.ts` owns the deterministic fixed-step current, analytic surface, wind response, leaf movement and obstacle collision. `src/main.ts` samples that same surface for the Three.js water grid and leaf pose, maps browser keyboard and standard Gamepad API inputs, and follows the leaf with a damped camera. The surface is an approximation, not a fluid simulation. Rendering currently updates grid vertices and normals on the CPU; profile this before adding detail. Wind intensity changes visible wave amplitude and force; direction affects leaf movement. The natural downstream target is clamped to avoid reverse flow.

The development-only lil-gui panel saves a local preset; the production build excludes it. The browser exposes small text-state and deterministic stepping hooks for automated testing. Procedural banks and simple rock/leaf geometry are placeholders, with no scene editor or procedural ecosystem yet.

Desktop packaging is deferred until interaction is validated. Compare Electron and Tauri against jam time, licenses, platform testing and size before choosing; test the actual target executable and GPU backend.
