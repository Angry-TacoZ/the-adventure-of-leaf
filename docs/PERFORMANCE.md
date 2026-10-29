# CPU water profile — 2026-10-29

Run `npm run dev`, then `npm run profile`. This launches headless Chromium, explicitly selects SwiftShader, and measures live animation frames at DPR 1 and quality 1. The 17,111-vertex water mesh updates heights and recalculates normals each rendered frame. Each viewport runs approximately ten seconds; the first 30 captured frames are discarded. There is no artificial stepping. Timings use performance.now(); render is CPU submission time, not GPU completion. These are single-run measurements, not a hardware frame-rate promise.

Host: Windows, Intel Core i9-13900KF; Chromium 156.0.8078.4. Renderer: ANGLE Vulkan SwiftShader (software). No physical GPU benchmark was available. Vite development server, default parameters and natural drift, no player wind. Other desktop processes and timer quantization can affect results.

All timings below are mean / p95 milliseconds.

| Viewport | Samples | Frame interval | Height deformation | Normal calculation | Render submission |
|---|---:|---:|---:|---:|---:|
| 1280×720 | 386 | 24.74 / 33.40 | 3.01 / 3.70 | 2.51 / 3.20 | 0.46 / 0.70 |
| 1920×1080 | 190 | 50.00 / 99.90 | 2.87 / 3.70 | 2.24 / 3.10 | 0.52 / 0.80 |

The CPU water work costs about 5.1–5.5 ms per rendered frame on this host, roughly one third of a 16.67 ms budget. This justifies a follow-up GPU displacement experiment before increasing mesh detail. Keep the CPU sampler for leaf physics, implement equivalent shader equations, verify height/normal parity, and compare under the same hardware and resolution. GPU displacement is a recommendation, not part of this correction pass. Lowering pixel ratio does not reduce CPU mesh work. The much larger 1080p frame interval under software rendering is not evidence that CPU deformation alone causes that slowdown. Re-measure with the actual GPU before choosing a performance target.

The simulation uses fixed 1/120-second steps, with a 100 ms real-frame catch-up cap. Under severe stalls it deliberately drops elapsed wall time; simulation time then runs slower than real time.
