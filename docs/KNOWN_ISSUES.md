# Known issues

- This is an early, temporary scene: water, banks and leaf fall well short of the visual references. Water has no real reflection, refraction, dynamic wake, and no convincing obstacle turbulence (the rock has a simple ripple and static foam ring). Wind changes wave amplitude but does not orient waves to wind direction. No artistic acceptance is claimed.
- The rock can stop the naturally drifting leaf until wind moves it around; the river ends at a boundary and R restarts. There is no complete journey, opening fall, sound, progression or final player UI.
- Collision is a simple circular approximation. Alignment uses surface slopes; it is not a full buoyancy model. Camera jitter and obstacle visibility need real playtesting.
- Browser tests use a simulated standard gamepad; a physical controller, disconnect behavior during play, and non-standard devices remain unverified. A WebGL2 failure shows an error; there is no alternative renderer. WebGPU is not attempted.
- Performance and graphics quality have not been measured on representative hardware. The CPU-updated water mesh may be costly. The Vite build reports a large JavaScript chunk. The quality control changes rendering pixel ratio; it does not change simulation complexity.
- No Windows or Mac executable is packaged or tested. The jam requires one. AI disclosure and all dependency/asset licenses need final review before submission.
