# Distant-fragment stability — unresolved

Measured November 5, 2026 against gameplay source5ce991a and official @dimforge/rapier3d0.21.0. The primary leaf is kept near the physics origin; widely separated secondary fragments are not. This is a reproduced limitation, not completed acceptance.

Run a local Vite server, then `node scripts/probe-fragment-stability.mjs` (installed Chrome). The diagnostic writes output/fragment-stability-probe.json and does not alter gameplay. It cuts a real engine body, translates the smaller piece as a fixture and compares flat supported-water behavior. The input field is0.15m/s, at120Hz for20seconds. The isolated-world case is an experiment with simplified flat-water forces, not a production collision/transfer implementation.

| Fixture | Final downstream velocity |
|---|---:|
| Nearby fragment | about0.154m/s |
| Fragment200m away | about1.45m/s |
| Fragment500m away | about3.49m/s |
|500m fragment restored into a local-coordinate world | about0.157m/s |

An independent zero-gravity/no-applied-force test with the same mesh stays still at the origin. At z=-500 its center moves to about-1847m after20seconds. This reproduces coordinate-dependent drift outside the gameplay force model. It does not identify a specific upstream solver line. Increasing solver iterations did not resolve the bias; the separate probe data are retained beside this report.

A snapshot/local-world experiment preserves the engine body and avoids the drift in the simplified case. Integrating that approach still requires verified collision-space management, stable fragment identity/sourceUVs, contact continuity, reset/disposal and resource/performance bounds. No debris is culled, no velocity is clamped, and no replacement solver is shipped. Those shortcuts would hide the defect or change the approved physical behavior.

The installed official JS package has no f64 drop-in package in the npm query performed on this date. Rust f64 crates exist in the [official Rapier source/documentation](https://github.com/dimforge/rapier); that does not establish a compatible JavaScript artifact. No toolchain, fork or dependency was installed. No upstream message was sent.

The public preview remains a development build. Near-leaf deformation, independent cuts and route checks pass, but arbitrary distant debris behavior is not accepted as correct.
