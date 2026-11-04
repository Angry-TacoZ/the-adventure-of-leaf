# Playable journey progress

James's full objective remains active: tree fall in forested mountain headwaters, wind-controlled journey through rapids, thunderstorm, rocks and fish to the ocean, Rapier deformation and damage, vegetation/trees/fish/clouds/sun, player guide, settings with sound volumes and low/high graphics, credits and licenses.

Damage ending approved by James: show "The adventure of Leaf has ended, try again?" with restart from headwaters or return to main menu.

Current increment: normal gameplay now samples wind state separately from the old solver and steps a Rapier soft-body world at 120 Hz. Per-particle supported-area buoyancy, current drag and wind forces drive a 27-particle blade. Static rock/bank colliders, coherent reset/lap recreation, physics diagnostics, dynamic geometry and a following vein are implemented. Collider shapes and force values remain initial engineering tuning. Fragment topology and tearing are still outstanding.

Verification: unit/type/build and a dedicated browser check of actual Rapier gameplay downstream travel, buoyancy and reset passed. Native gameplay screenshot inspected. The full browser suite currently reports missing submerged silhouette, although the screenshot visibly contains the leaf: its strict blue-channel threshold excludes the refracted leaf's changed color. This needs a stronger reference-based check, not a false success claim. Full camera/controller/loop/optics regression is not yet verified on this increment. No final physical-feel or visual acceptance is claimed.
