# Playable journey progress

The active objective is a leaf falling from a tree in Appalachian mountain headwaters and traveling through rapids, thunderstorm, rocks and fish to an Atlantic estuary and ocean. The leaf is based on yellow birch. Shore vegetation and forest assets must match that regional progression. Menus, player instructions, adjustable sound volumes, low/high graphics and James Lane/technology/license credits are required. These requirements remain open until their actual playable behavior is verified.

James's decisions:
- Navigation is player-directed wind; remove upstream obstacle avoidance forces. Contact may physically deflect the blade and downstream wake turbulence remains.
- Game over: "The adventure of Leaf has ended, try again?" with restart from headwaters or return to main menu (design requirement; no ending code exists on this branch — see Remaining).
- Publish labeled milestone previews to Pages from the draft branch, retaining normal PR and built-in Codex review checkpoints.

Implemented in the current physics milestone:
- Gameplay uses a 51-particle Rapier blade on the existing 120 Hz clock, with sampled supported-area buoyancy, current drag and wind forces.
- Rendered geometry and central vein follow particle positions. Independent display buffers, topology revisions, per-piece IDs, normals and disposal are handled by leaf-view.ts; leaf-topology.ts rebuilds particle/UV mappings from engine rest positions and boundary triangles after tears.
- Rock damage is a gameplay rule presented through the physical cut path, not engine-computed damage: sustained rock contact fills a grind meter that splits the engine body via world.cutSoftBody, and automatic tear events are counted. Lenient material strain/force thresholds (0.08/0.01) remain only as a backstop. A development-only cut hook splits the engine body into independent fragments, each receiving environmental forces.
- Reset removes all fragments and recreates the leaf. The temporary lap loop remains for slice testing.
- The initial birch blade has a pointed oval profile and small serrations. This is a procedural prototype, not final art.

Verification: unit/type/build, leaf-view ownership/replacement/disposal, actual Rapier buoyancy/travel/reset, gentle stability, material stress damage, controlled split into two independently moving bodies, upstream-wind force bound and fixed-clock partitioning passed locally. The complete browser suite passed with wind-directed obstacle navigation; its historical automatic-navigation expectations were updated to James's new requirement. Shared reference silhouette comparison replaced the old fixed-color submersion mask. Full native WebGPU optics passed. The current change still needs exact-revision CI and built-in review.

Remaining: opening tree fall; complete Appalachian-to-Atlantic environments; vegetation/trees, fish, clouds and sun; storm and rapids hazards; damage ending and menus; audio and volume settings; guide and credits; further impact/self-contact/collider-shape tuning; matched physics/fragment performance and long-duration resource checks; final visual/physical-feel acceptance. Existing spherical rock colliders and bank boxes remain approximations. Wind force distribution does not yet use projected surface area. No full-demo completion is claimed.
Natural shoreline and understory milestone: box walls are replaced by shared rendered/physical terrain triangles rising from submerged gravel through irregular shores into soil slopes and initial hills. Plants follow the shared height sampler. The supplied ferns, Grass Medium 01, moss and nettle form the normal preview; dandelion, celandine and Searsia remain available in the comparison preview. This is not final vegetation placement or a completed Appalachian forest. Detailed durable state, reproductions and remaining requirements are in WORK_HANDOFF.md.
