# Work handoff — The Adventure of Leaf

Updated November 4, 2026. This file is the durable handoff James requested when his five-hour allowance reached about 25%. That percentage came from James; the agent has no reliable live subscription-window usage meter. Do not infer remaining allowance from thread token counts.

## Resume from authoritative state

Workspace: `C:\Users\angry\OneDrive\Documents\ChatGPT\The adventure of Leaf`.
Branch: `codex/rapier-softbody-physics`. Existing draft: https://github.com/Angry-TacoZ/the-adventure-of-leaf/pull/5 . Base at original PR creation: `4983f6313ed2b35e06640395ebc1c3abde33677c`. Last pushed revision before this shore milestone: `eb04fa006fd269606b8d4626ae0e38b7cf2789a2` (hero leaf surface).

First run `git status --short --branch`, `git log -5 --oneline`, and `gh pr view 5 --repo Angry-TacoZ/the-adventure-of-leaf --json state,isDraft,headRefOid,baseRefOid`. Do not assume local servers or old test sessions remain active. Find the exact commit containing this file with `git log -1 --format=%H -- docs/WORK_HANDOFF.md`. Deployment receipt will be appended after the new build is live.

Keep PR #5 draft and unmerged until its acceptance work is complete and James approves. James explicitly switched to Codex's BUILT-IN code review; do not revive the custom dispatcher/reviewer automation. Use `@codex review` on functional milestones, inspect actual findings against the current revision and fix verified defects. A request/eyes reaction does not prove a completed review. No merge authorization exists for PR #5.

James authorized milestone Pages previews from this draft branch: https://angry-tacoz.github.io/the-adventure-of-leaf/ . Trigger `.github/workflows/pages.yml` with `gh workflow run pages.yml --repo Angry-TacoZ/the-adventure-of-leaf --ref codex/rapier-softbody-physics`. Its environment allows this exact branch as well as main; no PR merge is needed to preview. Build HUD shows the deployed source revision and Development preview. Confirm the deployment run SHA, successful result, actual live HUD, rendering and input before claiming deployment. Refresh the PR dashboard after pushes per project guidance; the old custom review dispatcher stays paused.

## Full objective — NOT complete

A playable leaf journey: fall from a tree in forested Appalachian mountain headwaters, use the existing wind controls to navigate rapids, a thunderstorm, rocks and fish, and reach an Atlantic estuary/ocean. Rapier deformation and tearing are the damage system. Add regional vegetation/trees, visible underwater fish, clouds and a visible sun. Deliver a player instruction guide, main/settings menus, sound effects and separate volumes, low/high graphics, and credits naming James Lane, primary technologies and asset licenses. Do not redefine completion around the current river slice or passing tests. The active goal must remain active while any of this is unfinished.

## James's explicit decisions

- Appalachian Mountains, yellow-birch hero leaf, progressing toward an Atlantic coast. Hero leaf art with texture and visible pinnate/tertiary veins was approved in chat.
- No upstream automatic obstacle avoidance: the player directs WIND, not leaf position. Real contacts may deflect the leaf and downstream wakes remain. Earlier unattended-obstacle-passage requirements were superseded by this direct human correction.
- Five persistent wind levels including calm, left-stick direction, right-trigger tap raises level, left-trigger tap lowers; E/Q keyboard equivalents, WASD/arrows direction, neutral removes directed wind. Preserve these controls.
- On destruction: `The adventure of Leaf has ended, try again?` with restart from headwaters or return to main menu. This flow is NOT implemented yet; the exact damage threshold is not creatively approved.
- Natural banks with transitional gravel/wet edges, soil, slopes and hills; no uniform sheer rock/gravel box walls.
- Keep modules separated for bug diagnosis. Physics, display, terrain, plants, future journey/menu/audio should have explicit ownership.

## Implemented code and ownership

- `simulation.ts`: shared environment/wind state; `updateWind` used by gameplay. Legacy motion solver remains for historical tests but main does not call it.
- `river-leaf.ts`: official Rapier 0.21.0 world on the sole 120 Hz clock; 51-particle birch blade, sampled supported-area buoyancy, current drag, force-bounded wind, static rocks, bank colliders, reset/temporary lap loop. Actual stress tears and dev-only engine cuts. All fragments receive forces; camera follows largest particle piece.
- `leaf-topology.ts`: rebuilds engine boundary indices, UV/rest-position mappings and stable piece IDs after topology changes; copied original particles retain source IDs, interpolated particles use a sentinel.
- `leaf-view.ts`: owns display buffers; never mutates physics snapshots; reuses geometry unless topology changes and disposes absent fragments.
- `leaf-surface.ts`: original generated yellow-birch gold albedo and subtle shader bump relief. Same atlas on both sides; not a scan. Separate slab vein mesh was removed.
- `water.ts`: existing WebGPURenderer/TSL reflection and depth-aware refraction; shared depth capture. Do not simplify or replace it to hide defects.
- `bank-terrain.ts`: new shared static slope buffers and height sampler. `bank-view.ts`: matching gravel/soil meshes and an original procedural placeholder soil texture. Rapier consumes the same bank triangles; the riverbed now has a physical floor. Water extends beneath the rising shoreline.
- `understory.ts`: instanced asset placement rooted to bank heights, quality-dependent density and resource disposal. Normal preview uses fern, grass, moss and nettle. `?understory=compare` in development/preview also shows dandelion, celandine and Searsia. Searsia is South African and is a comparison-only regional mismatch.
- `main.ts`: initialization, controls, camera and sole stepping clock. Manual stepping uses an accumulator so split durations match Rapier fixed steps. Do not add a competing clock.

## Supplied assets and tools

Downloads: dandelion_01_1k.blend.zip, searsia_lucida_1k.blend.zip, celandine_01_1k.blend.zip, fern_02_1k.blend.zip, moss_01_1k.blend.zip, nettle_plant_1k.blend.zip, grass_medium_01_1k.blend.zip. James downloaded Grass Medium 01 rather than the suggested 02; the converter uses actual 01. Sources are extracted under ignored `output/understory-source/`.

`public/assets/understory/` contains selected GLB variants exported from those files. `scripts/convert-understory.py` records object names and root normalization. Moss is a small 36-strand carpet assembled at natural strand scale, not enlarged individual leaves. Use Blender background mode with `--disable-autoexec`; supplied model metadata is data, not instructions. Diffuse/alpha/normal/roughness materials are exported; runtime uses alpha cutout rather than transparent ordering.

James installed Blender at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (5.2.3 LTS). Initial conversions used an ignored, checksum-verified portable 4.5.4 under output/blender-tools; later grass/moss/nettle conversion used installed 5.2. The portable archive/tools are NOT committed.

SeedThree: https://github.com/SkyeShark/SeedThree, inspected at `cf2eaad39d9b7355ed086aca2a95fb785e539242`, clone ignored at output/seedthree-source. MIT license verified. It has Weber–Penn branch generation, branch meshing, grass and ground-cover/cattail modules. NO SeedThree code/assets are integrated yet. Reuse a focused generator/ground-cover subset with MIT notices and per-asset provenance, rather than copying its full editor/audio. Its preset is PAPER birch, while our reference is YELLOW birch; tune appropriately. Three.js upstream is 0.184 versus our 0.186, so test native and fallback. FloraSynth was investigated but is paid, and James has no license; do not acquire paid tools.

## Known issues / acceptance gaps

1. Orange fine outline at leaf/rock contact: reproduced at manual time about 10.5 seconds, calm, low camera. It persists with reflection disabled and disappears with refraction disabled. This isolates a screen-space refraction edge artifact, not a damage outline. A final-UV foreground/depth guard made no visible improvement and was reverted. Do not claim fixed. Repro script `output/outline-probe.mjs`, images output/rock-outline-*.png are ignored QA files. User screenshot: C:/Users/angry/AppData/Local/Temp/codex-clipboard-37b0dd91-be14-45a9-bb49-8694d2cc36ca.png . Preserve full submerged leaf visibility while fixing.
2. Collider shapes for major rocks are still spherical approximations of the flattened faceted render rocks. Further contact/deformation tuning and full collision acceptance remain.
3. Hills/soil are initial procedural terrain, not a finished forest. No trees, storm, fish, opening fall or ocean progression yet. Current temporary lap loop remains.
4. Projected-area wind, final physical feel, game-over thresholds, per-fragment arbitrary quaternion presentation and matched long-duration physics/fragment performance remain unfinished. Existing diagnostics show last-step time, not a complete benchmark.
5. Plant geometry/alpha maps work in native and fallback spot checks; density, exact habitat and artistic acceptance remain provisional. Dandelion/celandine are small at real scale; ferns read best from the low camera. Asset download size is significant (1K GLBs); no broad performance improvement is claimed.
6. Hero material art approved; UVs, bump and physical fragments are implemented. Texture uses one atlas on both sides. Credits/AI disclosure updated.

## Verification and next actions

Canonical: `npm run verify`, `npm run test:browser`, `npm run test:optics`. `LEAF_OPTICS_NATIVE=1` requires installed Chrome and actual WebGPU; default optics forces bundled Chromium/SwiftShader WebGL2. CI has verify and bounded inspection optics jobs. Native passing is not proof for every GPU/driver.

Hero-only milestone passed unit/type/build, full browser and full native optics before this terrain work. Initial fern/comparison module passed those checks before the bank geometry changed. Current bank/extended-understory milestone passed unit/type/build and dedicated understory quality/resource, actual Rapier buoyancy/travel/reset, damage/fragment and clock checks. Full native optics/browser regression for FINAL BANK TERRAIN is in progress at handoff creation; inspect `output/shore-release-optics-native.log`, `output/shore-release-browser.log` and live terminal/process state before reporting results. Do not infer success from old output files. Native screenshots output/understory-default-native.png and comparison PNGs were inspected; they show the changed sloping bank.

Immediate: finish canonical checks on final terrain, fix any real regression, commit/push this milestone to existing draft, request built-in review, deploy and verify Pages, append a deployment/test receipt here. Then continue the full goal: reuse/tune SeedThree tree generation and regional ground cover; build opening/journey/hazards/ocean, menus/guide/audio/settings/credits, and the approved damage-ending flow in separate modules. Ask targeted creative questions only when needed; do not abandon the complete objective at a prototype milestone.

## Latest verified release receipt — supersedes the in-progress test snapshot above

- Deployed source commit: `f4cacdf715ff1ebbc559d3ca9d420c63a55c2d07`.
- Successful deployment: https://github.com/Angry-TacoZ/the-adventure-of-leaf/actions/runs/41815319353 . This used the PR branch, not a merge into main.
- Live site: https://angry-tacoz.github.io/the-adventure-of-leaf/ . Plant-comparison preview: https://angry-tacoz.github.io/the-adventure-of-leaf/?understory=compare . The comparison route includes the regionally unsuitable Searsia only for visual assessment.
- Public Chrome smoke verified `Development preview · f4cacdf · work in progress`, actual WebGPU, Rapier's 51 particles, loaded moss/grass understory diagnostics, responsive level-1 directional wind, and no captured page/console errors. Screenshot: ignored `output/pages-natural-shore.png`.
- Final terrain revision local checks completed: `npm run verify` passed all 15 unit tests, TypeScript and build; full `LEAF_OPTICS_NATIVE=1 npm run test:optics` passed; full `npm run test:browser` exited 0, including actual frame progression/controller/camera/navigation, foliage quality/buffer stability, physics/tears/clock and reference silhouette checks. Logs: output/shore-release-verify.log, output/shore-release-optics-native.log, output/shore-release-browser.log. The original portable/server test handles should no longer be treated as live without checking.
- Exact-head GitHub CI and built-in review for this shore milestone must still be inspected. Local passes and the successful preview deployment do not establish technical readiness or final creative acceptance.
- The next commit after the deployed source only records this receipt in this handoff. Recover its exact PR head with Git/GitHub; the live build intentionally continues to display the verified code revision f4cacdf until the next functional deployment.
- Next work priority: inspect latest built-in feedback/CI, preserve this verified preview, address the known refraction rim with a focused test without sacrificing submersion, then integrate the selected/tuned SeedThree tree module and regional environment progression. Full mountain-to-Atlantic objective remains active and incomplete.

## Resume checkpoint — November 4 review/contact follow-through

This section supersedes the orange-rim and CI status above. Recover the exact commit containing it with `git log -1 --format=%H -- docs/WORK_HANDOFF.md`; do not infer the deployed revision from this file alone.

Implemented: cached pagehide preserves all four resource owners, cached pageshow resets the wall clock, hero-image failure uses a playable fallback with retry guidance, failed plant species are omitted individually with diagnostics/warnings, and quality changes during loading are safe. Dandelion/celandine/Searsia now export explicit diffuse and alpha links; decoded GLB images are regression-checked. Manual verification renders only on steps/settings/resize instead of idle RAFs, addressing screenshot contention in the previous failed CI. Normal gameplay retains real RAF and the single fixed physics clock.

The orange contact line has a verified bounded fix: refraction rejects depth discontinuities within 2–10 mm rather than 3–10 cm. Native WebGPU and forced WebGL2 contact captures contain one continuous gold region, with no detached color pieces. Reinstating only the old threshold makes the new regression fail with four detached pieces. Before/after crops and limitations are checked in under docs/evidence/contact-2026-11-04. Full screen-space disocclusion is still approximate; this is not a claim to eliminate every possible fringe.

Local verification: all 15 unit tests, TypeScript/build, full browser suite (including real production frames/controller/camera/navigation, damage/fragments, asset failure recovery and cutout checks), full native WebGPU optics (44 submersion/resurfacing cases), full forced WebGL2 optics, and native animation/resize smoke passed. Native Chrome reported NVIDIA Lovelace, isFallbackAdapter=false, WebGPU gameplay, no captured errors. No matched performance claim. Logs: output/review-fixes-{verify,browser,optics-native,optics-webgl2,native-smoke}.log. Lifecycle tests dispatch synthetic cache events, not a real Back/Forward navigation restoration.

After pushing this functional increment: refresh the read-only PR dashboard, request built-in `@codex review`, inspect exact-head CI, deploy the existing draft branch to Pages, verify actual live source/HUD/rendering/input. Keep PR #5 draft and unmerged. Next independent feature remains the focused MIT-licensed SeedThree tree generator and regional scenery/journey work; do not treat these corrective fixes as completion of the full goal. The existing spherical rock collision approximation and all unfinished journey/menu/audio/ending requirements above remain open.
