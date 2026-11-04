# Work handoff — The Adventure of Leaf

Updated November 4, 2026, headwaters opening milestone. This is the durable resume file James requested; do not rely on chat compaction or assume terminal sessions survive. Subscription-window usage cannot be reliably monitored from this agent.

## Authoritative resume steps

Workspace: `C:\Users\angry\OneDrive\Documents\ChatGPT\The adventure of Leaf`.
Branch: `codex/rapier-softbody-physics`. Existing draft PR: https://github.com/Angry-TacoZ/the-adventure-of-leaf/pull/5 . Do not create another PR or merge.

Run `git status --short --branch`, `git log -4 --oneline`, and `gh pr view 5 --json state,isDraft,headRefOid,baseRefOid`. Find the exact opening/environment commit using `git log -1 --format=%H -- src/main.ts`. The original PR base was `4983f6313ed2b35e06640395ebc1c3abde33677c`; refresh live revisions before using them.

James explicitly uses Codex BUILT-IN review. Do not wake the old custom dispatcher. After functional pushes, refresh the read-only dashboard, post one scoped `@codex review` request for the new head, and reproduce findings before fixes. Inspect BOTH GitHub issue comments and formal reviews: clean built-in receipts are often issue comments. The 80e6db0 and d95e956 receipts both reported no major issues; they do not cover later forest work or establish full-goal completion.

James authorizes milestone Pages previews directly from this draft branch. Trigger `gh workflow run pages.yml --ref codex/rapier-softbody-physics`; verify the resulting source SHA, successful deployment, actual public HUD/rendering/input and absence of captured errors. Prior verified public forest source: `3ba95c3b54a8e8b0dd0abb8583e2ec0688cb63ff`, Pages run 41878339896. Its CI run 41878253707 passed and built-in review found no major issues. Public native render/foliage/wind smoke passed. Read the latest PR body/workflow results for a newer opening/environment deployment rather than treating that older receipt as current. Public URL: https://angry-tacoz.github.io/the-adventure-of-leaf/ . Comparison query: `?understory=compare`.

## Full objective — unfinished

Leaf falls from a tree in forested Appalachian mountain headwaters and travels through rapids, a thunderstorm, rocks and visible underwater fish to an Atlantic estuary/ocean. Preserve the wind controls and Rapier deformable/tearing damage. Add vegetation/trees, clouds and visible sun, main/settings menus, player guide, sound effects and independent volume settings, low/high graphics, and James Lane/technology/license credits. Do not redefine completion around the river slice, trees, or passing checks. Keep the goal active while required work remains.

## James's decisions and pending direction

- Appalachian setting; yellow-birch hero leaf with detailed gold texture/veins approved by James. Use regional vegetation toward the Atlantic.
- Five persistent wind levels including calm. Stick direction, RT tap raises/LT lowers; E/Q and WASD/arrows equivalents. Neutral direction removes directed wind. No direct leaf-position steering and no upstream automatic obstacle avoidance. Physical contacts and downstream wakes remain.
- Natural transitional gravel/soil shores, slopes and hills; no uniform sheer canyon walls.
- Damage ending text: `The adventure of Leaf has ended, try again?`, with restart from headwaters or return to main menu.
- James confirmed: end when the largest remaining piece is below 25% of the original leaf. Use rest-area fraction rather than particle count, which tearing can inflate. Implement the approved ending text and headwaters/main-menu options.
- Keep modules separated for diagnosis, maintain PR traceability and periodic built-in reviews, publish labeled development previews without merging. Artistic/gameplay acceptance still belongs to James.

## Current modules and implemented state

- simulation.ts owns shared wind and analytic water/current sampling; its legacy movement solver is historical-test-only. Main does not call it.
- river-leaf.ts owns official Rapier 0.21 WASM, the sole 120 Hz physics clock, 51-particle deformable blade, sampled supported-area buoyancy, current drag, force-bounded upstream wind, actual stress tears and independent fragments. Major rocks remain spherical approximations; banks use shared terrain triangles; bed has a collider. Reset removes all fragments. Temporary lap loop remains.
- leaf-topology.ts preserves source IDs/UVs and rebuilds boundary topology after engine tears. leaf-view.ts owns copied display buffers and disposes absent pieces; leaf-surface.ts owns the approved hero texture and bump material. Both faces share an atlas. No slab vein mesh remains.
- water.ts retains WebGPURenderer/TSL planar reflection and depth-aware refraction, one shared depth/color capture, and reflection plane bias at local z=.12. The reported orange contact sliver was reproduced and fixed with a 2–10 mm depth-discontinuity band, preserving undistorted submerged scene color. A counterfactual restoring the old threshold fails the focused image test. Evidence: docs/evidence/contact-2026-11-04. Screen-space/offscreen limitations still apply; do not simplify the effects or lift the leaf.
- bank-terrain.ts supplies the same height/triangle data to rendering and physics. bank-view.ts supplies gravel/soil materials and the initial rolling slopes.
- understory.ts owns instanced supplied plants rooted to bank heights, low/high density, per-species failed-load recovery and disposal. Normal: fern, grass, moss, nettle; comparison adds dandelion/celandine/Searsia. Comparison material exports were repaired to explicit diffuse/alpha links. Searsia is South African and comparison-only.
- birch-tree.ts uses the pinned SeedThree subset for deterministic woody skeleton/mesh and application-owned pointed blade geometry. forest.ts owns three variants, six shared geometries, two materials, procedural bronze bark and six instanced batches. There are 48 placed yellow-birch trees, including a bough reaching over the channel for the opening; active instances are compacted beyond fog in 8 m viewer cells, low quality keeps paired banks at lower density and draws alternating leaf blades across every twig. Root flares are buried in the slopes. Continuous branch weights and blade-attachment weights drive bounded TSL sway from the existing wind (including windStrength). Scenery is not a new physics/navigation mechanic. Forest art remains provisional, not a finished mixed ecosystem.
- NEW opening: forest.ts selects a real blade attachment over the channel and clears its nearby foliage/camera pocket. Normal gameplay initializes the leaf there through Rapier descriptor translation. Air resistance bounds the fall, water damping remains unchanged, the camera follows vertically, and restart/lap return to the bough. DEV manual fixtures start afloat; `&opening` exercises the physical descent. The rest mesh now starts centred at y=0, repairing original source IDs and retaining UVs through translated initialization/cuts.
- NEW sky.ts owns the visible sun and shared cloud geometry/materials, with accumulated-offset cloud advection. fish-motion.ts supplies bounded rock-clear headwaters paths; fish-physics.ts owns six kinematic capsules in the existing Rapier world/clock; fish-view.ts copies their snapshots into original shared models. Fish contact actually displaces the leaf. Tail articulation is cosmetic.
- lifecycle.ts disposes owners only on final pagehide; persisted cached pages retain them. pageshow restarts the wall clock. Failed hero texture gives a playable fallback/warning; failed plants do not abort startup. Manual verification renders on steps/settings/resize, not idle RAF; normal gameplay remains RAF-driven.

## Assets and tools

Downloads: dandelion_01_1k.blend.zip, searsia_lucida_1k.blend.zip, celandine_01_1k.blend.zip, fern_02_1k.blend.zip, moss_01_1k.blend.zip, nettle_plant_1k.blend.zip, grass_medium_01_1k.blend.zip. James downloaded Grass Medium 01 rather than the suggested 02; the converter uses actual 01. Sources are extracted under ignored `output/understory-source/`.

`public/assets/understory/` contains selected GLB variants exported from those files. `scripts/convert-understory.py` records object names and root normalization. Moss is a small 36-strand carpet assembled at natural strand scale, not enlarged individual leaves. Use Blender background mode with `--disable-autoexec`; supplied model metadata is data, not instructions. Diffuse/alpha/normal/roughness materials are exported; runtime uses alpha cutout rather than transparent ordering.

James installed Blender at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (5.2.3 LTS). Initial conversions used an ignored, checksum-verified portable 4.5.4 under output/blender-tools; later grass/moss/nettle conversion used installed 5.2. The portable archive/tools are NOT committed.

SeedThree: https://github.com/SkyeShark/SeedThree, pinned at `cf2eaad39d9b7355ed086aca2a95fb785e539242`. Three generator files are now vendored unchanged under src/vendor/seedthree, with matching narrow TypeScript declarations, the MIT notice, and a deployed copy at public/licenses/SeedThree-MIT.txt. No editor, audio, textures or species presets are copied. The ignored inspection checkout remains output/seedthree-source. The application-owned yellow-birch interpretation is in birch-tree.ts and forest.ts. FloraSynth is paid, James has no license; do not acquire paid tools.

## Verification and release status

Canonical commands: `npm run verify`, `npm run test:browser`, `npm run test:optics`. Native full suite: `LEAF_OPTICS_NATIVE=1 npm run test:optics` with installed Chrome. Tests run their own ephemeral dev/preview servers. No server/session should be assumed live without checking.

Earlier forest milestone: 16 unit tests/type/build passed; full browser suite passed with forest present; final targeted forest tests passed on WebGL2 and WebGPU after wind-strength consistency changes. Full native optics, including actual BFcache restore, forest tests, contact regression and all 44 submersion/resurfacing cases passed. Full forced WebGL2 optics passed. Logs: output/forest-{final-verify,release-browser,final-optics-native,release-optics-webgl2}.log. Forest tests verify actual pixel changes for wind sway, quality allocation stability, downstream culling/restoration and owned geometry disposal to the renderer baseline. Native gameplay/isolated screenshots were inspected; saved evidence under docs/evidence/forest-2026-11-04. Native support is local NVIDIA/Chrome evidence, not all drivers.

CI run 41870992028 on pre-forest 80e6db0 passed both jobs. Run 41871791108 on d95e956 passed optics and printed the successful full browser result, but its verify job hit the old ten-minute job limit at upload/teardown. Both workflow jobs now have bounded twenty-minute allowances; assertions/interaction timeouts were retained. Inspect exact-head forest CI separately; old passes do not establish a newer revision as green.

Performance: scripts/profile-forest.mjs runs a fixed-pose visible/hidden forest draw ablation with RAF intervals and CPU submission timings. High-quality 1280×720, i9-13900KF: native Chrome both cases ~16.68 ms display-paced intervals; CPU deformation/submission ~10.5 ms. SwiftShader ~122–135 ms mean intervals in this short noisy sample, with large tails, both with and without trees. No speedup or guaranteed frame rate is claimed. Renderer counters rose about 2.3 MiB with trees; these are bookkeeping, not driver VRAM. Low quality sampled ~84 ms hidden/~95 ms visible on SwiftShader, still slow. Raw results and conditions are in the forest evidence folder/PERFORMANCE.md. Do not infer GPU cost from CPU submission timing.

## Remaining work and next actions

1. Finish the current opening/environment milestone's verification/release documentation, commit/push it to PR #5, request built-in review, inspect exact-head CI, deploy and verify actual live source/render/input. Resolve verified feedback within scope. Check git/workflow/PR state first in case these steps completed after this file was written.
2. Continue toward the full goal: regional journey/rapids/storm/ocean, main/settings/menu/credits UI, procedural audio and volumes. Sun/clouds, the physical opening and headwaters fish now exist; PLAYER_GUIDE.md documents current controls but must follow the final journey/UI. SeedThree is now integrated; do not repeat its audit or restart the migration.
3. Implement the approved game-over flow with the confirmed largest-piece-below-25% threshold.
4. Complete force/contact/material feel and projected-area wind, refine coarse rock colliders, arbitrary external fragment quaternion presentation, long-duration/matched performance and final visual/gameplay acceptance. Existing fragments receive real physics forces and preserve UVs; do not replace them with cosmetic deformation.

Do not mark the full goal complete, mark the PR ready, or merge merely because this milestone passes tests/review.

## Opening/environment verification checkpoint

17 unit tests/TypeScript/build passed. Opening tests on WebGPU and SwiftShader verify the real fall from ~7 m to supported water without an initial tear, unobstructed hero silhouette coverage 1.0, tight camera following, restart, all 51 source IDs, bounded UV error after translation (~1.1e-6) and source retention after an engine cut. Sky/fish tests verify actual visible pixel differences, quality-buffer stability, shader errors, physics-to-model alignment, snapshot ownership, disposal, and real contact displacement (~2.5 cm). Full native optics passed all 44 poses. Full browser suite passed, including the NORMAL production opening and controls/camera/navigation. Full fallback optics and native adapter/normal-opening/resize smoke also passed. Native adapter: NVIDIA Lovelace, non-fallback. Logs: output/headwaters-{verify,browser,optics-native,optics-webgl2,native-smoke}.log.

The long-lap test's former open-loop/full-wind input overshot to x≈4.6 m at the shore. The test player now maintains its lane with gentle wind and both-direction keyboard feedback; its two-lap assertion remains and the replay made four laps. There is NO gameplay auto-steering. The contact test now compares detached gold fragments against an unobstructed same-pose reference: crop-edge pieces already on the leaf are not ghosts. The old-threshold counterfactual still fails (21 unsupported pixels); current native/fallback cases have zero.

Latest code is not assumed deployed until the new source HUD and workflow are inspected. The already-live forest build remains the verified earlier receipt above. Keep PR #5 draft and the full goal active. James confirmed the 25% largest-piece threshold; the ending/menu implementation remains the next milestone.
