# Architecture

`src/simulation.ts` owns shared river/current/surface sampling and wind state. Gameplay motion and deformation come from `river-leaf.ts`, which owns the Rapier world on the sole 120 Hz fixed clock. `leaf-view.ts` copies physics snapshots into display buffers and rebuilds fragment geometry on topology changes. `main.ts` collects input, follows the largest leaf fragment and deforms the CPU water grid using the same surface sampler. This analytic water surface is not a fluid simulation. Integrated wind offsets advect ripples without rephasing when wind changes. Upstream automatic obstacle steering was removed at James's direction; downstream wake perturbations remain.

The development-only lil-gui panel saves a local preset; the production build excludes it. The browser exposes read-only text diagnostics. A stepping hook exists only in Vite development mode with `?testMode=manual`; production gameplay always uses requestAnimationFrame and a fixed-step accumulator. `?profile=1` collects bounded CPU timing samples. Procedural banks and simple rock/leaf geometry are placeholders, with no scene editor or procedural ecosystem yet.

Desktop packaging is deferred until interaction is validated. Compare Electron and Tauri against jam time, licenses, platform testing and size before choosing; test the actual target executable and GPU backend.

See PERFORMANCE.md for measured water costs and GITAGENT_VALIDATION.md for actual loader validation.

The drawing buffer is resized on viewport events or actual pixel-ratio changes; steady render frames do not call the pixel-ratio setter. Physical rock contacts may deflect or stop the leaf; steering around them is the player's responsibility.

Water optics (merged in PR #3): gameplay now uses the asynchronously initialized Three.js WebGPURenderer. Its initialized backend supplies diagnostics; the renderer prefers WebGPU and automatically falls back to WebGL2. `?forceWebGL` forces that backend in development only. All Three.js scene classes come from three/webgpu. A TSL MeshBasicNodeMaterial mixes a ReflectorNode planar reflection with viewport scene-color sampling, modulated by Fresnel. The water is transparent in render ordering but outputs opaque composited color, with depth testing and no depth writes. Opaque leaf geometry is present in the scene-color capture, including submerged parts. There is no artificial clearance lift or leaf exclusion. Refraction currently uses a bounded normal-based screen offset; waterline edge artifacts still need work before acceptance. Reflection capture scales with drawing-buffer dimensions and quality. Diagnostics report actual capture width/height. The CPU water grid and fixed 120 Hz physics remain shared.

Development manual mode exposes isolated above/partial/full-submersion pose overrides and a raised test camera; neither is exposed in production. The test changes rendered pose only, not simulation state.

A bounded speed-dependent ripple around the leaf is included in the shared surface sampler, so it contributes to the rendered wave geometry and leaf alignment. It is a local approximation rather than a persistent wake.

Refraction samples clamp at viewport edges. Offscreen objects cannot be recovered from a scene-color capture; edge behavior remains an unfinished migration limitation.

The extended river spans z=20 to z=-110; the leaf returns to the starting position at z=-109.7 for continuous slice testing, preserving wind settings and snapping the camera to avoid a long sweep. Water and bed share this extent and preserve texture/mesh spacing. Temporary wind indicators are tapered, wavy ribbon meshes: count, length, curvature and animation rate respond to the existing directed wind strength. They do not apply force or introduce a new control.

Wind uses five persistent selectable levels; trigger edge detection with hysteresis gives one change per press, and intensity transitions smoothly to the selected level. Neutral stick means no directed wind; restart returns to calm.

Depth-refraction increment: scene depth estimates the optical travel for a projected Snell ray. Bounded UV displacement, viewportSafeUV foreground rejection, a depth-discontinuity continuity weight and viewport-edge fading select the scene-color sample. Beer-Lambert transmission uses a tunable RGB absorption coefficient. This remains a one-step screen-space approximation, not ray tracing. `physics-boundary.ts` adapts shared sampling and supplies renderer-independent pose/fragment data types. Main consumes its slopes and pose with the same 120 Hz clock. Fragment buffer upload now lives in leaf-view.ts; see RAPIER_INTEGRATION_PLAN.md for remaining integration acceptance.

Verification-only hooks in development manual mode can hide water for an unobstructed leaf reference and select inspection, gameplay or edge test camera framing. Gameplay test framing explicitly resets both camera position and aim even at zero elapsed time. Read-only resource diagnostics report Three.js counters; they do not expose driver-level memory allocations. None of these setters is exposed by the production build.

## Module boundaries for diagnosis

- `simulation.ts`: shared wind state and river sampling; the legacy solver remains only for historical unit coverage. Gameplay uses `updateWind` and the Rapier owner.
- `river-leaf.ts`: Rapier world, forces, static contacts, reset and physical positions. No Three.js or DOM dependencies.
- `physics-boundary.ts`: typed data exchanged between simulation and presentation.
- `leaf-view.ts`: display buffers, normals, material and mesh lifecycle. It copies the supplied positions and never writes into physics data. Current gameplay frames use world coordinates; arbitrary per-fragment quaternion poses are not consumed yet.
- `water.ts`: water optical materials and captures.
- `main.ts`: initialization, sole fixed-step clock, input collection and camera orchestration. Further environment, journey, menu and audio work should have its own module as each feature is implemented, rather than accumulating behavior here.

Review checkpoints: push functional milestones to the draft PR, request built-in Codex review, check returned findings against the current revision, and compare the milestone against `DEMO_PROGRESS.md` and the original human objective. Review feedback complements runtime, visual and acceptance checks. A clean review of an increment does not establish completion of deferred requirements.


Resource and failure lifecycle: owners survive `pagehide` when `persisted` is true; final navigation disposes them once. Cached restoration restarts the wall clock to avoid simulating the absent interval. A failed hero texture uses a plain material with retry guidance; failed plant species are reported and omitted while successful species remain playable. Manual verification mode renders on explicit steps, settings and resize, leaving the normal RAF gameplay loop unchanged. Leaf/rock refraction uses a 2–10 mm depth-discontinuity rejection band to suppress detached color slivers; it retains an undistorted scene-color fallback rather than discarding the submerged leaf.
