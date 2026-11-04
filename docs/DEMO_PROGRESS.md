# Playable journey progress

The active objective is a leaf falling from a tree in Appalachian mountain headwaters and traveling through rapids, thunderstorm, rocks and fish to an Atlantic estuary and ocean. The leaf is based on yellow birch. Shore vegetation and forest assets must match that regional progression. Menus, player instructions, adjustable sound volumes, low/high graphics and James Lane/technology/license credits are required. These requirements remain open until their actual playable behavior is verified.

James's decisions:
- Navigation is player-directed wind; remove upstream obstacle avoidance forces. Contact may physically deflect the blade and downstream wake turbulence remains.
- Game over: "The adventure of Leaf has ended, try again?" with restart from headwaters or return to main menu.
- Publish labeled milestone previews to Pages from the draft branch, retaining normal PR and built-in Codex review checkpoints.

Implemented in the current physics milestone:
- Gameplay uses a 51-particle Rapier blade on the existing 120 Hz clock, with sampled supported-area buoyancy, current drag and wind forces.
- Rendered geometry and central vein follow particle positions. Independent display buffers, topology revisions, per-piece IDs, normals and disposal are handled by leaf-view.ts; leaf-topology.ts rebuilds particle/UV mappings from engine rest positions and boundary triangles after tears.
- Actual material strain/force thresholds enable physical damage; automatic tear events are counted. A development-only cut hook splits the engine body into independent fragments, each receiving environmental forces.
- Reset removes all fragments and recreates the leaf. The temporary lap loop remains for slice testing.
- The initial birch blade has a pointed oval profile and small serrations. This is a procedural prototype, not final art.

Verification: unit/type/build, leaf-view ownership/replacement/disposal, actual Rapier buoyancy/travel/reset, gentle stability, material stress damage, controlled split into two independently moving bodies, upstream-wind force bound and fixed-clock partitioning passed locally. The complete browser suite passed with wind-directed obstacle navigation; its historical automatic-navigation expectations were updated to James's new requirement. Shared reference silhouette comparison replaced the old fixed-color submersion mask. Full native WebGPU optics passed. The current change still needs exact-revision CI and built-in review.

Remaining: opening tree fall; complete Appalachian-to-Atlantic environments; vegetation/trees, fish, clouds and sun; storm and rapids hazards; damage ending and menus; audio and volume settings; guide and credits; further impact/self-contact/collider-shape tuning; matched physics/fragment performance and long-duration resource checks; final visual/physical-feel acceptance. Existing spherical rock colliders and bank boxes remain approximations. Wind force distribution does not yet use projected surface area. No full-demo completion is claimed.

Hero-art milestone: James approved the new yellow-birch surface art. The blade uses a high-resolution original albedo atlas with central, lateral and tertiary veins, tissue detail and subdued natural color variation. A shared material module supplies diffuse color and subtle bump relief; the old separate slab-like central vein mesh was removed. UVs continue to come from physics rest coordinates after topology changes so fragments retain their source regions. The material adds texture sampling without adding physics particles; removing the separate vein reduces mesh count. A matched performance comparison has not yet been run. This is still a stylized golden leaf using the same atlas on both faces, not a full botanical scan. Scene integration of SeedThree tree and ground-cover modules remains upcoming; its code and license were inspected but not copied into the game in this milestone.
