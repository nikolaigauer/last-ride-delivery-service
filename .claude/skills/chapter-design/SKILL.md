---
name: chapter-design
description: Design or implement a new chapter, level, puzzle, or challenge for Last Ride. Use when adding gameplay content — terrain, obstacles, mission beats, mechanics — or when evaluating whether a proposed challenge idea fits the game.
---

# Last Ride — Chapter & Challenge Design

## The comedy formula (this is the game's engine — protect it)

Comedy here is **anticipatory**: the player must SEE the disaster coming,
form a careful plan, and then watch physics ruin it with dignity.

1. **Telegraph.** The hazard is visible from a distance (the gap gets a
   marker, the bridge visibly tilts, the mechanism is legible).
2. **Plan.** The player does something deliberate and careful (place the
   plank, position the counterweight, slow down).
3. **Reality.** Physics intervenes — not randomly, but as a consequence of
   the player's own ambition or impatience.
4. **Verdict.** The disaster plays out fully ON SCREEN, then hard cut to a
   deadpan intertitle. Never interrupt a tumbling coffin with UI.

Anti-patterns: invisible triggers, random failures, punishment for driving
normally (tuning bug, not comedy), obstacles that are only *hard* without
being *legible*. A challenge that can't produce a story ("and THEN the
coffin slid into the ravine") is filler.

## Pacing anatomy — what a chapter is

Each chapter so far follows this rhythm, and it works:

    phone call → journey (with one quiet/monotonous stretch) →
    one physical puzzle → delivery → phone call (twist or sign-off)

- **One new mechanic per chapter, maximum.** Chapter 1: counterweight
  bridge. Chapter 2: planks. Reuse old mechanics freely.
- **The quiet stretch is load-bearing.** Empty road + monologue is where
  the noir lives. Do not fill every screen with content.
- **Damage persists across chapters** (coffin bumps, hearse health). New
  chapters inherit the player's accumulated shame — use it.
- Surreal beats (dream sequence) belong in quiet stretches, broken by real
  physics events (a terrain bump wakes the driver).

## Implementation pattern

Chapters are code-defined in `js/ChapterManager.js`:

```js
makeChapterN() {
    return {
        id: 'slug',
        name: 'Title',
        apply: (game) => {
            game.terrain.regenerate(buildChapterNTerrain, WORLD_WIDTH);
            // deactivate previous chapter's buildings; activate/position new ones
            // teleport hearse + player to spawn; reset camera
            // game.monologue.setSnippets([...]);   (see /dialogue skill)
            // game.checkpointX = <respawn before the puzzle>;
        },
        shouldAdvance: (game) => /* condition, or false for last chapter */,
    };
}
```

- Terrain builders return `{x, horizonY, groundY}` points every 80px.
  Canvas Y is DOWN: positive variation = pit. **Flatten terrain under every
  building and phone** (`variation = 0` within a radius) or they float.
- Checkpoint goes ~1500px BEFORE the chapter's puzzle so death retries the
  puzzle, not the drive.
- Buildings/entities follow the active/lazy pattern: `active` flag,
  constructed lazily on first `apply()`, updates/draws are no-ops when
  inactive. Destroy Matter bodies before respawning them (`plank.destroy()`).

## Physics & tuning discipline

- Tuning knobs live in `js/Hearse.js` constructor and are documented in
  `claude.md`. Calibrate by feel via playtest (see /playtest skill), never
  by unit math — Matter velocities aren't px/frame.
- Golden rule from a real regression: **normal driving must never trigger
  the failure systems.** Bumps, overheat, door-pop exist to punish
  recklessness and ambition, not throttle-holding on gentle hills.
- The corpse is a Verlet ragdoll (`js/Corpse.js`) — do NOT port it to
  Matter. Its floppiness is the comedy. Coffin↔corpse impulses bridge via
  `coffin.velocityX/Y`.
- Beware comment/code drift: this repo once had a comment claiming a
  threshold was 6 while the code said 3. When tuning, change code AND
  comment AND the claude.md table.

## Scope discipline

Build ONE challenge and make it legible before adding the next. When
evaluating an idea, ask: (1) can the player see it coming? (2) does failure
produce a story? (3) does it fit noir-mundane (a hearse wouldn't have a
winch — rejected for exactly this reason)? Two of three = park it in
`docs/story-and-dialogue.md` brainstorm notes instead.
