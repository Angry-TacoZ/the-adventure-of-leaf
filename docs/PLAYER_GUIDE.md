# Player guide — development build

You guide a yellow-birch leaf with wind as it falls from an Appalachian tree into the headwaters. The leaf follows the river current. Use gentle wind to choose a clear route between rocks and swimming fish; stronger wind creates a more turbulent ride.

Choose Begin journey to start the physical fall from the tree. The current clear-weather route leads through mountain headwaters, descending rapids, a mountain lake, lower river, estuary and Atlantic Ocean. A location/progress label tracks the journey. Thunderstorm presentation and final scenery are still being built. After time in the ocean, the continuous-testing loop returns to the headwaters so you can try another run; the transition is abrupt.

| Action | Keyboard | Standard gamepad |
|---|---|---|
| Direct wind | WASD or arrow keys | Left stick |
| Increase one wind level | Tap E | Tap right trigger |
| Decrease one wind level | Tap Q | Tap left trigger |
| Stop directed wind | Release direction keys | Centre the stick |
| Pause / resume | Esc / Resume journey | Menu/Start / B |
| Restart at the tree | R, or pause menu | Pause menu |
| Fullscreen | F | Keyboard F for now |

There are five persistent levels: calm plus four increasing strengths. Each trigger/key press changes one level; holding it does not keep increasing it. The selected level stays set when you release the stick, but a centred stick applies no directed wind. Keyboard W/up points downstream; S/down opposes the current without unrealistically reversing the downhill river.

Start with one or two levels for small corrections. Aim for open water before reaching a rock and release direction early so the leaf's momentum can settle. The current does not automatically steer around upstream obstacles. Rocks and headwater fish can physically deflect the leaf. Rapids carry the leaf faster through narrower gaps and higher crests; the lake slows and widens the route. Large impacts and strain can tear it; separated pieces continue moving, and the camera follows the largest material piece.

The adventure ends when the largest piece is below 25% of the original leaf's material area. Exactly 25% can continue. The ending offers Restart from the headwaters or Main menu. Restart restores the entire leaf and calm wind.

Settings offers graphics quality and separate master, water, wind and effects volumes. Low quality reduces drawing resolution, water reflection resolution, tree density/leaf detail and cloud density. It does not slow the simulation clock. Menus pause gameplay and ambient sound. Sound begins after a browser-approved interaction; Play test sound can unlock it. Settings currently last for the current page session. Hardware-accelerated WebGPU is preferred; WebGL2 is the fallback. Software rendering can be substantially slower.

If a controller does not respond, use a browser-recognized standard controller and press a button to activate it. Keyboard controls remain available. A physical-controller acceptance pass is still required; automated checks use the standard Gamepad API mapping.

Menus support pointer, keyboard focus/Enter and standard-controller stick/D-pad with A to select and B to return. James Lane is creative director. The Credits menu includes technologies, license links and AI disclosure; detailed acknowledgements are in ASSET_CREDITS.md. Sounds are provisional procedural effects; no musical score is included.
