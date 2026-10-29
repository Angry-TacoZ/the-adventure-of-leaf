# Architecture

`src/simulation.ts` owns the deterministic fixed-step current, analytic surface, wind response, leaf movement and obstacle collision. `src/main.ts` samples that same surface for the Three.js water grid and leaf pose, maps browser keyboard and standard Gamepad API inputs, and follows the leaf with a damped camera. The surface is an approximation, not a fluid simulation. Rendering currently updates grid vertices and normals on the CPU; profile this before adding detail. Wind intensity changes wave amplitude and force; the effective smoothed wind velocity is integrated into windOffsetX/Z each simulation step. These accumulated displacements advect two ripple components on the shared surface without rephasing them when wind changes late in a session. The local current field splits upstream around the obstacle and includes bounded downstream eddies. The natural downstream target is clamped to avoid reverse flow.

The development-only lil-gui panel saves a local preset; the production build excludes it. The browser exposes read-only text diagnostics. A stepping hook exists only in Vite development mode with `?testMode=manual`; production gameplay always uses requestAnimationFrame and a fixed-step accumulator. `?profile=1` collects bounded CPU timing samples. Procedural banks and simple rock/leaf geometry are placeholders, with no scene editor or procedural ecosystem yet.

Desktop packaging is deferred until interaction is validated. Compare Electron and Tauri against jam time, licenses, platform testing and size before choosing; test the actual target executable and GPU backend.

See PERFORMANCE.md for measured water costs and GITAGENT_VALIDATION.md for actual loader validation.

The drawing buffer is resized on viewport events or actual pixel-ratio changes; steady render frames do not call the pixel-ratio setter. Obstacle deflection has been narrowed and reduced so the default zero-wind path clears the rock without approaching the bank as closely.

Water optics: src/water.ts owns Three.js planar capture helpers and a Fresnel/Snell shader. The water geometry now stays in local XY and is rotated as a mesh, so the capture helpers use the correct upward plane normal. Vertex height is local Z, sampling world (x,-localY). The leaf remains in world coordinates. Capture resolution changes only when quality changes. The manual-only test controls disable each optical contribution for stable canvas comparisons; production exposes neither the controls nor manual stepping.

A bounded speed-dependent ripple around the leaf is included in the shared surface sampler, so it contributes to the rendered wave geometry and leaf alignment. It is a local approximation rather than a persistent wake.

At the screen capture edge, refraction smoothly falls back to the undistorted scene capture instead of a flat color, avoiding a visible strip; samples outside the captured view remain approximate.

The extended river spans z=20 to z=-110; the leaf stops at z=-109.7, near its visible end. Water and bed share this extent and preserve texture/mesh spacing. Temporary wind indicators are tapered, wavy ribbon meshes: count, length, curvature and animation rate respond to the existing directed wind strength. They do not apply force or introduce a new control.

Wind uses five persistent selectable levels; trigger edge detection with hysteresis gives one change per press, and intensity transitions smoothly to the selected level. Neutral stick means no directed wind; restart returns to calm.
