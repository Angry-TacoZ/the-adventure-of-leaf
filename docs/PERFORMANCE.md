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

## Drawing-buffer correction follow-up — 2026-10-29

The installed Three.js r186 implementation calls setSize from setPixelRatio even when the ratio is unchanged. The application now compares getPixelRatio before calling the setter; viewport resize still updates size, and development quality changes still update the buffer. Browser tests intercept the native canvas width/height setters and verify no writes during steady real animation frames, correct resize dimensions, and stable dimensions afterward. Development tests also exercise quality changes from 1 to 0.5 and back.

Repeated the same single-run SwiftShader profile immediately before and after this correction (raw results in evidence/profile-before-buffer.json and evidence/profile-after-buffer.json). This pass also changes phase integration and obstacle tuning, so it does not isolate the timing effect of the resize guard alone.

| Viewport | Before mean / p95 ms | After mean / p95 ms |
|---|---:|---:|
| 1280×720 | 22.86 / 33.40 | 23.28 / 33.40 |
| 1920×1080 | 41.41 / 83.20 | 41.66 / 83.30 |

These runs show no material frame-time improvement; do not claim an FPS gain. The verified benefit is removal of repeated drawing-buffer writes. Software rendering still limits these results, and they do not measure an RTX 4090. CPU height deformation plus normals remains about 4.6–4.9 ms per frame in the follow-up. The earlier GPU-displacement recommendation remains a follow-up experiment, not a proven hardware performance fix.

## Reflection/refraction pass

Same host/Chromium/SwiftShader, DPR 1, quality 1, with two 512-square captures plus the main scene. Run against the prototype server using LEAF_BASE_URL=http://127.0.0.1:5186 and npm run profile. Raw results: evidence/profile-optics.json. Single-run mean / p95 frame intervals were 61.04 / 116.70 ms at 1280×720 (154 samples), and 94.95 / 166.70 ms at 1920×1080 (99 samples). CPU deformation/normals averaged 2.56/2.05 ms and 2.88/2.19 ms respectively. CPU render submission now includes both capture passes and averaged 1.33/1.59 ms. These do not measure GPU completion or physical RTX performance. This pass materially increases software-rendering cost; no 60 FPS claim is supported. Quality now reduces capture dimensions as well as main pixel ratio. Profile a physical GPU before accepting the default capture resolution.

## Extended river and wind indicators

A single SwiftShader run after extending the river, before the final brush-stroke tuning, measured mean frame intervals 90.16 ms at 1280×720 and 125.21 ms at 1920×1080. CPU deformation plus normals averaged about 10.14 ms and 9.92 ms respectively. The mesh has twice as many lengthwise subdivisions to preserve wave spacing. Raw data: evidence/profile-long-river.json. These software-only figures are not RTX or other physical GPU measurements, and the final ribbon version has not been profiled separately.

## PR #3 first gameplay-renderer increment

Single local Chromium/ANGLE SwiftShader run, initialized backend WebGL2 through WebGPURenderer, DPR 1 and quality 1. Raw results: evidence/profile-webgpu-fallback.json. This is software rendering, not an RTX or native WebGPU measurement.

| Viewport | Samples | Mean / p95 frame interval ms | Mean CPU deformation / normals ms | Mean CPU render submission ms | Reflection target |
|---|---:|---:|---:|---:|---|
| 1280×720 | 57 | 145.02 / 250.00 | 5.92 / 4.10 | 1.19 | 640×360 |
| 1920×1080 | 28 | 114.88 / 500.00 | 6.06 / 4.51 | 1.25 | 960×540 |

The short sample and large scheduling variation do not support a resolution scaling or performance-improvement claim. Earlier legacy measurements above are historical and were not repeated under matched conditions for this increment. GPU completion timings, native WebGPU, memory growth and resource-leak testing remain unfinished. The new pipeline uses one planar reflection pass and a viewport-color copy rather than the legacy reflection and refraction scene passes. Reflection resolution now follows buffer size; it is not held at the old 512-square size. CPU geometry is retained to keep the physics and visual surface synchronized.

Hardware procedure: use a WebGPU-enabled browser on HTTPS or localhost, run normal gameplay without forceWebGL, and verify text diagnostics report rendererEngine=WebGPURenderer and renderer=WebGPU. Record browser/GPU/driver and the profile output before comparing to fallback. In development, ?forceWebGL forces the fallback; production ignores that query. A fallback pass is not WebGPU validation.

## Matched verification follow-up — 2026-10-31

Archived main f69dc7d and the migration were served separately with the same dependency tree. Each run used DPR 1, quality 1, 180 animation frames and the final 120 timing samples. Scenes were run sequentially; the reflection target differs by pipeline (main 512×512; migration 640×360 at 720p and 960×540 at 1080p). These are matched scene/settings comparisons, not isolated shader microbenchmarks.

| Environment / pipeline | 720p mean / p95 ms | 1080p mean / p95 ms |
|---|---:|---:|
| Chromium 156.0.8078.4 / SwiftShader / main WebGLRenderer | 79.16 / 100.10 | 120.97 / 216.70 |
| Same software environment / migration WebGL2 backend | 149.58 / 283.20 | 276.10 / 516.60 |
| Chrome 156.0.8078.47 / RTX 4090 WebGL2 / main | 16.68 / 16.80 | 16.68 / 16.80 |
| Same Chrome/host / non-fallback NVIDIA Lovelace WebGPU / migration | 16.68 / 16.80 | 16.68 / 16.80 |

The software path regressed materially. The hardware results are display-paced and establish no throughput improvement. Native migration CPU deformation/normals averaged 4.12/5.38 ms at 720p and 4.06/5.36 ms at 1080p; main averaged 4.07/3.11 and 4.05/3.07 ms. Render submission averaged 1.00/0.96 ms for migration versus 0.87/0.89 ms for main. Do not attribute single-run differences to a specific cause without further profiling.

A separate instrumented native WebGPU run at 1440×900 collected 30 renderer timestamp-query samples: mean 0.065536 ms and p95 0.131072 ms. Readings are quantized and include zeros. They are renderer-reported GPU render timestamps, not CPU frame intervals or a guarantee of end-to-end GPU latency. Timestamp tracking is development-only and opt-in with profileGPU; the matched comparison did not enable it.

Both migration backends were checked through 12 alternating resize/quality changes and a subsequent 60-second rendering soak. The final repeated-size snapshots and post-soak tracked counters matched: 88 geometries, 15 programs, 2 render targets, 14 textures. Raw counters and byte estimates are saved beside the timings. Stable engine counters over this bounded test do not prove absence of long-duration or driver-level leaks. Browser/page closure handles the test contexts. No claim of disposal correctness for a future route/scene replacement is made.

Raw evidence: evidence/verification-2026-10-31/matched-software.json, matched-hardware.json and chrome-webgpu.json. Run scripts/compare-renderers.mjs with LEAF_BASELINE_URL and LEAF_BASE_URL pointing to separate dev servers. LEAF_PROFILE_NATIVE=1 selects installed Chrome with normal hardware selection; the default uses bundled Chromium/SwiftShader.

## Final performance pass — 2026-11-01

The comparison used DPR 1, quality 1, 1280×720 and 1920×1080, the same scene, and a 512×512 reflection target in both pipelines. A development-only benchmark overrides the migration reflector target to match main; normal gameplay retains its quality-dependent resolution. Chrome was launched with frame-rate and GPU-vsync limits disabled. Each case records 60 frame intervals after 30 warmup frames; the small samples and substantial scheduling outliers make individual averages unstable. Ablations individually omit reflection, depth, color capture, water, or CPU surface updates only in development benchmarks; they are not gameplay modes and their costs are not additive.

| Environment and pipeline | 720p mean frame interval | 1080p mean frame interval |
|---|---:|---:|
| SwiftShader, main WebGL2, before | 17.13 ms | 115.12 ms |
| SwiftShader, migration, before | 108.26 ms | 207.31 ms |
| SwiftShader, migration, after depth-copy change | 39.44 ms | 215.24 ms |
| RTX 4090, main WebGL2 | 8.8 ms | 8.6 ms |
| RTX 4090, migration WebGL2 fallback, before | 8.5 ms | 8.5 ms |
| RTX 4090, migration WebGL2 fallback, after | 8.51 ms | 8.57 ms |
| RTX 4090, migration native WebGPU, before | 12.5 ms | 12.1 ms |
| RTX 4090, migration native WebGPU, after | 11.45 ms | 12.33 ms |

The software timings are highly variable: for example, a 720p main mean exceeded its p95 because of extreme outliers. They do not establish the size of an improvement from the depth-copy change. The matched hardware fallback was close to main on this one GPU, suggesting the large software regression is especially pronounced in SwiftShader; other hardware and drivers remain untested. The unpaced WebGPU run was slower than main in this sample. CPU water deformation and normals dominated these frame intervals: the no-surface benchmark averaged roughly 0.8–0.9 ms on hardware, while normal water updates averaged approximately 7 ms on main and 10–11 ms with native WebGPU. This is an ablation, not a production optimization or proof of a single cause.

The water pass previously triggered four depth framebuffer copies and one color copy per frame. Sharing the depth texture reduces this to one depth and one color copy, verified on both backends without removing the depth rejection or optics. At the tested camera and leaf poses the six before/after images had no pixels differing by more than 3/255 in any color channel. Reflection, depth and color ablations were individually recorded; their noisy frame intervals do not support assigning the software slowdown to one effect. The remaining software regression warrants future profiling.

A separate RTX 4090 WebGL2 `EXT_disjoint_timer_query_webgl2` baseline measured mean/p95 GPU elapsed times of 0.709/1.193 ms at 720p and 0.769/1.373 ms at 1080p. Native WebGPU renderer timestamp samples after the change measured 0.048/0.131 ms and 0.050/0.131 ms respectively, quantized in 0.065536 ms increments with zeros. These APIs cover different scopes and cannot establish a relative GPU speedup. No performance improvement is claimed from these non-equivalent GPU timers. Full samples, per-pass ablations, and test conditions are in evidence/performance-final-pass. The benchmark's reflector-resolution override uses a Three.js internal API and may require maintenance after a Three.js upgrade.
