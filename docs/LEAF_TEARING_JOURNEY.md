# Leaf tearing journey: from silent rocks to grinding damage

Game-jam process log for the Rapier soft-body leaf. Goal: ramming rocks
should visibly tear the leaf. What follows is every failed attempt, the
reasoning that killed each theory, and the fix that finally worked —
kept because the dead ends taught more than the fix.

## The symptom

No matter how many rocks the leaf hit, it stayed intact. Tear counter at
zero, leaf whole, no damage anywhere.

## Attempt 1: soften engine thresholds (failed)

Rapier tears one soft-body element when strain passes `tearStrain` OR load
passes `tearForce` (see `@dimforge/rapier3d` `soft_body.d.ts`). The leaf
shipped with `tearStrain = 0.8`, `tearForce = 0.3`.

Change: `src/river-leaf.ts` → `tearStrain = 0.25`, `tearForce = 0.05`.
Result: played on the Pages build, rammed rocks repeatedly. Zero tears.

## Attempt 2: dramatic thresholds (failed, and that failure was the proof)

Change: `tearStrain = 0.08`, `tearForce = 0.01`.
Result: still zero tears on the live build.

This killed the threshold theory outright. At 8% stretch and a force limit
below leaf weight, a real rock hit would tear. So rock hits never loaded
the leaf at all. Stop tuning; start diagnosing.

## The mass question (answered with math, not a test)

Proposal: raise leaf mass above 0.002 kg so hits land harder.

Verdict: mass was never the blocker, and raising it would not sink the leaf:

- Gravity pulls `9.81 × m`. Custom buoyancy pushes `19.62 × m × immersion`.
- Balance sits at 0.5 immersed. Mass cancels out. Float height is unchanged.
- More mass means more momentum but the same handling, since custom drag
  and wind forces also scale with `m`.

Mass stayed at 0.002 kg. Thresholds stayed at their final values
(0.08 / 0.01) as a backstop.

## Root cause: a free cloth cannot load itself against smooth balls

- The leaf weighs 2 grams and floats free. Nothing anchors it.
- A rock contact shoves the whole leaf aside. It moves instead of stretching.
- Smooth balls (radius 0.65–1.1 m) cannot stretch a 0.89 m leaf by 8%.
  Geometry forbids the strain channel; milligram-scale contact patches
  starve the force channel.
- Proof the tear pipeline itself worked: the pinned-particle stress test
  (pin particle 0, yank the last one) tore every time in CI. The leaf
  only tears when one end is bolted down. Rocks bolt nothing down.

Ruled out along the way: dual-physics interference (the kinematic step
never runs in gameplay), upstream avoidance (none exists), tunnelling
(1/120 s step, ~1 cm per step), broken tear events (the pinned test).

## The fix: contact-driven grind damage

`src/leaf-integrity.ts` (`createGrindMeter`) + wiring in `src/river-leaf.ts`:

- Each step measures leaf-edge to nearest rock-surface gap.
- Gap under 0.15 m fills the meter; clear water drains it twice as fast,
  so taps are forgiven.
- 0.6 s of sustained grinding cuts the primary body at the rock-side
  surface point through the existing `world.cutSoftBody()` path.
- Same tear counter, same sound trigger, same diagnostics as engine tears.

Two live-playtest lessons folded into the shipped values:

- Edge, not centre: the first version measured from the leaf centre, so a
  leaf parked edge-on (centre ~0.4 m off the rock) read as "no contact."
  Gap now subtracts `LEAF_HALF = 0.45`.
- Pause freezes everything: physics only steps while unpaused, so
  parked-while-paused time counts for nothing.

## Verification

- Unit: grind meter test (fires once per budget, forgives taps, overlap
  counts) alongside the existing suite.
- Live playtest on the Pages build: leaf ground against the first rock,
  meter climbed, tear sound, visible split fragments, and the adventure
  ended once the largest piece dropped below a quarter. Screenshots kept
  with the jam notes.

## Knobs for tuning

Budget (seconds of contact per tear) and margin (metres) in one line of
`src/river-leaf.ts`. The on-screen diagnostics show live
`grind % · tears N`, so tuning takes one playtest per setting.
