# Player guide — development build

You guide a yellow-birch leaf with wind as it falls from an Appalachian tree into the headwaters. The leaf follows the river current. Use gentle wind to choose a clear route between rocks and swimming fish; stronger wind creates a more turbulent ride.

This build covers the opening and the existing river reach. Rapids, thunderstorm, the Atlantic ending, main/settings menus, audio and the final damage-ending screen are still being built. The temporary river-testing loop returns to the headwaters near the end of the reach.

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Direct wind | WASD or arrow keys | Left stick |
| Increase one wind level | Tap E | Tap right trigger |
| Decrease one wind level | Tap Q | Tap left trigger |
| Stop directed wind | Release direction keys | Centre the stick |
| Restart at the tree | R | Keyboard R for now |
| Fullscreen | F | Keyboard F for now |

There are five persistent levels: calm plus four increasing strengths. Each trigger/key press changes one level; holding it does not keep increasing it. The selected level stays set when you release the stick, but a centred stick applies no directed wind. Keyboard W/up points downstream; S/down opposes the current without unrealistically reversing the downhill river.

Start with one or two levels for small corrections. Aim for open water before reaching a rock and release direction early so the leaf's momentum can settle. The current does not automatically steer around upstream obstacles. Rocks and fish can physically deflect the leaf. Large impacts and strain can tear it; separated pieces continue moving, and the camera follows the largest piece.

Graphics quality is available at the bottom right of the public preview. Low quality reduces drawing resolution, water reflection resolution, tree density/leaf detail and cloud density. It does not slow the simulation clock. Hardware-accelerated WebGPU is preferred; WebGL2 is the fallback. Software rendering can be substantially slower.

If a controller does not respond, use a browser-recognized standard controller and press a button to activate it. Keyboard controls remain available. A physical-controller acceptance pass is still required; automated checks use the standard Gamepad API mapping.

James Lane is creative director. Technology and asset acknowledgements are in ASSET_CREDITS.md; an in-game credits screen is planned.
