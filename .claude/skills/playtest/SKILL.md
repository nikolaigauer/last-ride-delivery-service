---
name: playtest
description: Run and drive Last Ride in the browser to verify changes — physics tuning, chapter flow, visuals, regressions. Use after any gameplay/visual change, or when asked to test, screenshot, or reproduce a bug in the game.
---

# Last Ride — Playtest Harness

## Setup

```bash
python3 -m http.server 8410   # run in background from repo root
```

Open `http://localhost:8410` via the Chrome browser tools (create a NEW tab;
**never reload or drive a tab the user is playing in** — check
`game.hearse.x` first: if it moved since you last touched it, it's theirs).
`?dev=1` enables the corpse editor (C). `D` toggles the debug panel.

## Driving the game from the console (javascript_tool)

Key events don't hold reliably through automation. Set the input map
directly — define once per page load:

```js
window.hold = (code, ms) => { game.input.keys[code]=true;
  setTimeout(()=>{game.input.keys[code]=false;}, ms); };
window.tap  = (code) => { game.input.keys[code]=true; }; // Space auto-clears
window.state = () => ({ ep: game.currentEpisode, chapter: game.chapterManager.currentIndex,
  px: Math.round(game.player.x), hx: Math.round(game.hearse.x),
  hv: +game.hearse.velocity.toFixed(2), inV: game.player.inVehicle,
  heat: Math.round(game.hearse.heat), bumps: game.hearse.bumpCounter,
  door: game.hearse.doorOpen, coffin: { active: game.coffin.isActive,
  inHearse: game.coffin.inHearse, bumps: game.coffin.bumpCounter } });
```

Pattern: `hold('ArrowRight', 2000)` → wait 3s → `state()` → screenshot.
`tap('Space')` for interactions (game clears the key itself).
Teleports for fast travel: `game.teleportToHospital()`, `teleportToEnd()`,
`game.jumpToChapter(x)` (camera only).

Note: while `inV: true`, arrow keys DRIVE, they don't walk — check before
assuming a "walk" happened.

## World geography

**Chapter 1** (world 25,000px): spawn ~100 · opening phone 800 ·
hospital 2500 (door 2750, load zone 3050–3350) · drawbridge ~15000 ·
St. Mary's 22000 · callback phone 23000 · chapter-2 trigger: x>23300 in
hearse with coffin, moving east.

**Chapter 2** (world 18,000px, terrain regenerated): spawn 500 ·
plank ravine 7920–8080 (plank spawns 7500) · St. Margaret's 15500 ·
closing phone 17000. Checkpoint 6300. Dream sequence auto-fires once,
x 8700–11000 at speed with cargo (`game.dreamSequence.start(true)` to force).

**Chapter 3** (16,000px): spawn 350 · phone 700 · coffin staged 1650 ·
scripted loss trigger 6250 · Dead Man's Gap 6800 (pre-bridged) · deer 8600 ·
graveyard 13500 · closing phone 15200. Checkpoint 5400.

**Chapter 4** (15,500px): spawn 350 · phone 700 · coffin staged 1500 ·
branch 6500 (head → drain 7150) · melon 8983 · St. Anthony's 13000
(openCasket) · final phone 14500. Checkpoint 5000.

Jump straight to a chapter: `game.chapterManager.applyChapter(n)` (0-based).
Note: pressing Space in the same frame as `hearse.teleportTo()` acts on the
PRE-teleport position (interactions run before the hearse maps Matter → x);
wait one frame in scripted tests.

## Regression checklist (the core loop, in order)

1. Fresh load: no console errors (`read_console_messages` with
   `onlyErrors: true`); no per-frame log spam.
2. Drive start → hospital at full throttle: heat must stay well under 100
   and bumps ≤ ~2. **If normal driving overheats or pops the door, tuning
   has regressed** — this exact bug shipped once.
3. Answer opening phone → intertitle appears whole (no typewriter), space
   dismisses.
4. Hospital: door interact → park in zone → cargo spawns AT the hospital
   (not off-screen — the old "Schrödinger's corpse" bug put ragdoll parts
   at x=-1000).
5. Load corpse→coffin→hearse; drive the bridge puzzle; deliver at
   St. Mary's — verdict card should appear ~2s AFTER the coffin ejects.
6. Callback phone → chapter 2 fade → plank puzzle → St. Margaret's →
   closing phone.
7. Death check: drive into the ch.2 ravine without a plank → fade,
   "You fell.", space respawns at checkpoint on foot.

## What to record

Log `state()` at each waypoint (heat/bumps tell the tuning story).
Screenshot: opening frame, an intertitle, a prompt chip, each puzzle, a
delivery. Judge screenshots against the /art-direction checklist — a
playtest that only checks function has done half its job.
