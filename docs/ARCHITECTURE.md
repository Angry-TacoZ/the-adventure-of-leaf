# Architecture

`src/simulation.ts` owns the deterministic fixed-step current, analytic surface, wind response, leaf movement and obstacle collision. `src/main.ts` samples that same surface for the Three.js water grid and leaf pose, maps browser keyboard and standard Gamepad API inputs, and follows the leaf with a damped camera. The surface is an approximation, not a fluid simulation. Rendering currently updates grid vertices and normals on the CPU; profile this before adding detail. Wind intensity changes wave amplitude and force; the effective smoothed wind velocity is integrated into windOffsetX/Z each simulation step. These accumulated displacements advect two ripple components on the shared surface without rephasing them when wind changes late in a session. The local current field splits upstream around each obstacle and includes bounded downstream eddies. The natural downstream target is clamped to avoid reverse flow.

The development-only lil-gui panel saves a local preset; the production build excludes it. The browser exposes read-only text diagnostics. A stepping hook exists only in Vite development mode with `?testMode=manual`; production gameplay always uses requestAnimationFrame and a fixed-step accumulator. `?profile=1` collects bounded CPU timing samples. Procedural banks and simple rock/leaf geometry are placeholders, with no scene editor or procedural ecosystem yet.

Desktop packaging is deferred until interaction is validated. Compare Electron and Tauri against jam time, licenses, platform testing and size before choosing; test the actual target executable and GPU backend.

See PERFORMANCE.md for measured water costs and GITAGENT_VALIDATION.md for actual loader validation.

The drawing buffer is resized on viewport events or actual pixel-ratio changes; steady render frames do not call the pixel-ratio setter. Obstacle deflection has been narrowed and reduced so the default zero-wind path clears the rocks without approaching the bank as closely.

Water optics (PR #3 work in progress): gameplay now uses the asynchronously initialized Three.js WebGPURenderer. Its initialized backend supplies diagnostics; the renderer prefers WebGPU and automatically falls back to WebGL2. `?forceWebGL` forces that backend in development only. All Three.js scene classes come from three/webgpu. A TSL MeshBasicNodeMaterial mixes a ReflectorNode planar reflection with viewport scene-color sampling, modulated by Fresnel. The water is transparent in render ordering but outputs opaque composited color, with depth testing and no depth writes. Opaque leaf geometry is present in the scene-color capture, including submerged parts. There is no artificial clearance lift or leaf exclusion. Refraction currently uses a bounded normal-based screen offset; depth rejection, depth-based attenuation and waterline edge artifacts still need work before acceptance. Reflection capture scales with drawing-buffer dimensions and quality. Diagnostics report actual capture width/height. The CPU water grid and fixed 120 Hz physics remain shared.

Development manual mode exposes isolated above/partial/full-submersion pose overrides and a raised test camera; neither is exposed in production. The test changes rendered pose only, not simulation state.

A bounded speed-dependent ripple around the leaf is included in the shared surface sampler, so it contributes to the rendered wave geometry and leaf alignment. It is a local approximation rather than a persistent wake.

Refraction samples clamp at viewport edges. Offscreen objects cannot be recovered from a scene-color capture; edge behavior remains an unfinished migration limitation.

The extended river spans z=20 to z=-110; the leaf returns to the starting position at z=-109.7 for continuous slice testing, preserving wind settings and snapping the camera to avoid a long sweep. Water and bed share this extent and preserve texture/mesh spacing. Temporary wind indicators are tapered, wavy ribbon meshes: count, length, curvature and animation rate respond to the existing directed wind strength. They do not apply force or introduce a new control.

Wind uses five persistent selectable levels; trigger edge detection with hysteresis gives one change per press, and intensity transitions smoothly to the selected level. Neutral stick means no directed wind; restart returns to calm.
