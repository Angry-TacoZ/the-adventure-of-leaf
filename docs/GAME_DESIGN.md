# Approved game design
A leaf falls from a mountain tree and journeys downstream through mountain headwaters, rapids, a lake, and a river mouth to the ocean. Natural motion, atmosphere, environmental animation and player influence carry the experience. This prototype covers only a short river section.

The player controls wind, not the leaf as a vehicle. The leaf follows the natural current without input. Wind affects both leaf motion and water agitation, allowing a peaceful or more chaotic journey without reversing the downhill current unrealistically. Left stick sets wind direction; each right or left trigger press selects one of five persistent wind levels (calm plus four increasing strengths); releasing the stick removes directed wind. Intensity transitions smoothly between selected levels. Include deadzones, smoothing, response curves and keyboard alternatives. Leaf floats, retains momentum, responds to water, wind and obstacles, and pitches, rolls and rotates believably.

Use a damped third-person follow camera just above and behind the leaf, with adjustable distance, height, angle and smoothing; keep obstacles visible. Final cinematic behavior requires James's approval. Water aims for convincing currents, varied speed, displacement, reflection/refraction, turbulence, foam, wakes and smooth wind response, not scientific fluid simulation.

References: [water](https://madebyevan.com/webgl-water/), [Three.js port](https://jeantimex.github.io/threejs-water/), [SeedOcean](https://reed-soul.github.io/SeedOcean/), [floating flowers](https://ripple.carsonye.com/), [After Rain](https://hilimor.github.io/after-rain/). These are quality benchmarks, not assets to copy. A future simple visual placement editor and procedural ecosystem are foundations for later, not this slice.

## Approved regional direction (November 4, 2026)

The journey begins in an Appalachian mountain forest and follows the river to an Atlantic estuary/ocean ending. The playable leaf is based on yellow birch: pointed oval blade, fine serrations and a gold autumn palette. Higher-elevation yellow birch occurrence is documented by the US Forest Service: https://research.fs.usda.gov/feis/species-reviews/betall . The rest of the foliage and shore plants should follow that regional progression; it is not a Rocky Mountain or tropical setting.

James removed automatic upstream obstacle avoidance: the player directs wind to navigate rocks. Physical contacts can still deflect the leaf, and downstream wake turbulence can remain. Prior tests requiring unattended passage through every rock are superseded by this explicit gameplay decision.

James authorizes milestone development previews on GitHub Pages while PRs remain drafts. Previews show a revision label and are not merge/readiness claims. Main remains protected by the normal PR workflow; deployments may use the explicitly allowed development branch.

## Confirmed damage ending (November 4, 2026)

End the adventure when the largest remaining leaf fragment is below 25% of the original leaf. Measure retained material area rather than duplicated particle count. Show: "The adventure of Leaf has ended, try again?" Offer restart from the headwaters or return to the main menu.
