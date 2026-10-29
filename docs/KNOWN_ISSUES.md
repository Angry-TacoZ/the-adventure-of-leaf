# Known issues

- This is an early, temporary scene: water, banks and leaf fall well short of the visual references. Water now has planar reflection and shallow-bed refraction captures, but has no dynamic wake or convincing obstacle turbulence (the rock has a simple ripple and static foam ring). Wind-driven ripples advect with the wind vector, but this is an analytic approximation rather than a spectral wind-wave model. No artistic acceptance is claimed.
- The natural current now deflects around the rock; it is a local steering approximation rather than fluid dynamics. The river ends at a boundary and R restarts. There is no complete journey, opening fall, sound, progression or final player UI.
- Collision is a simple circular approximation. Alignment uses surface slopes; it is not a full buoyancy model. Camera jitter and obstacle visibility need real playtesting.
- Browser tests use a simulated standard gamepad; a physical controller, and non-standard physical devices remain unverified (simulated disconnect and keyboard fallback are covered). A WebGL2 failure shows an error; there is no alternative renderer. WebGPU is not attempted.
- CPU timings and software-rendered frame intervals are recorded in PERFORMANCE.md; representative physical GPU performance remains unverified. The CPU-updated water mesh may be costly. The Vite build reports a large JavaScript chunk. The quality control changes rendering pixel ratio and optical capture resolution; it does not change simulation complexity.
- No Windows or Mac executable is packaged or tested. The jam requires one. AI disclosure and all dependency/asset licenses need final review before submission.

Optics limitations: reflection/refraction clip around the mean surface plane; large crests, partly submerged objects and screen edges can show capture artifacts. Refraction assumes the riverbed is at y=-0.41, with no arbitrary submerged-mesh ray tracing. No caustics, multiple scattering, underwater camera or artistic-fidelity acceptance is claimed. Two extra scene passes add rendering cost; hardware GPU performance remains unverified.

Leaf ripples follow the leaf as a localized approximation; they do not persist as independently propagating wake history.
