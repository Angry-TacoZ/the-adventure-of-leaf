# Appalachian canopy — November 4, 2026

Native Chrome/WebGPU and bundled Chromium/SwiftShader WebGL2 compositor captures at 1280 × 720, calm, initial gameplay camera. The new trees occupy the existing sloping shore and participate in planar water reflection. These are first-pass yellow-birch trees, not a finished mixed Appalachian forest. Crown density, bark and placement need James's visual acceptance. There is no new collision/navigation mechanic.

The SeedThree subset is pinned and MIT-attributed in src/vendor/seedthree. Our parameters and leaf geometry are separate from its generator. Bronze bark reference: [US Forest Service yellow birch](https://research.fs.usda.gov/silvics/yellow-birch). Geometry, procedural bark, instancing and wind code are application-owned.

Tests cover deterministic and finite geometry, rooted trunk coordinates, allocation-stable quality changes, downstream instance culling and exact restoration, actual wind-dependent pixel changes in an isolated scene, and owned-geometry disposal to the renderer's empty-scene baseline. The gameplay test also verifies that disabling environment wind disables tree sway. Full existing controls, camera, Rapier and optics verification remains required alongside the feature tests.

[Native gameplay](native.png) · [WebGL2 gameplay](webgl2.png)
