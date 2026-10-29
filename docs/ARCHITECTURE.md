# Architecture

`src/simulation.ts` owns the deterministic fixed-step current, analytic surface, wind response, leaf movement and obstacle collision. `src/main.ts` samples that same surface for the Three.js water grid and leaf pose, maps browser keyboard and standard Gamepad API inputs, and follows the leaf with a damped camera. The surface is an approximation, not a fluid simulation. Rendering currently updates grid vertices and normals on the CPU; profile this before adding detail. Wind intensity changes wave amplitude and force; the smoothed wind vector advects two ripple components on the shared surface. The local current field splits upstream around the obstacle and includes bounded downstream eddies. The natural downstream target is clamped to avoid reverse flow.

The development-only lil-gui panel saves a local preset; the production build excludes it. The browser exposes read-only text diagnostics. A stepping hook exists only in Vite development mode with `?testMode=manual`; production gameplay always uses requestAnimationFrame and a fixed-step accumulator. `?profile=1` collects bounded CPU timing samples. Procedural banks and simple rock/leaf geometry are placeholders, with no scene editor or procedural ecosystem yet.

Desktop packaging is deferred until interaction is validated. Compare Electron and Tauri against jam time, licenses, platform testing and size before choosing; test the actual target executable and GPU backend.

See PERFORMANCE.md for measured water costs and GITAGENT_VALIDATION.md for actual loader validation.
