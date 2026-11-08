# Menus, audio and the confirmed damage ending

The native screenshots and JSON use installed Chrome on NVIDIA Lovelace hardware with WebGPU; the second JSON uses Playwright Chromium/SwiftShader WebGL2. Software results do not prove native GPU functionality. Viewports: home/settings 960×720, mobile/ending 390×844. This is menu/gameplay evidence, not a performance benchmark or artistic approval.

Run `npm run verify`, `npm run test:browser` and `LEAF_OPTICS_NATIVE=1 npm run test:optics`. The browser runner includes tests/menu-browser.mjs; the native optics suite also includes it. Existing optics checks remain. Tests interact with actual menus, normal RAF and real Rapier cuts, not a fake health hook. DEV manual stepping is used only for reproducible damage.

Observed largest-piece fractions over five engine cuts: 52.1181%, 47.8820%, 32.9645%, 29.2546%, 22.8634%. The last opens the exact approved ending, freezes simulation and offers both recovery choices. Restart restores 51 particles, one fragment and area fraction 1. Unit coverage checks that exactly 25% continues, below 25% ends, and copied tear vertices do not inflate area.

The menu check covers home/pause/resume, settings, graphics resizing, native keyboard select, controller A/B/Start/D-pad, guide, credits/deployed license requests, mute and completed effect voices, both damage recovery routes and viewport bounds. Native Back navigation separately verified actual BFcache restoration after audio unlock (bfcache-native.log).

low-tree-before.log records the reproduced review finding: the supporting tree's rendered instance exists at High and disappears at Low. The regression checks actual instance transforms; after the fix both qualities preserve it. Density reduction elsewhere and fog culling remain.

Sound is original procedural noise/tone synthesis, not a musical score. Final sound levels, menu art, physical controller feel and the broader journey remain for acceptance/further work. Settings are session-only. Full local suite results and exact-head CI/review/deployment must be checked in the PR and durable WORK_HANDOFF.md; these screenshots alone are not readiness evidence.
