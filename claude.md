# Last Ride Delivery Service

A dark comedy noir game inspired by Aki Kaurismäki films: a solitary undertaker
delivers corpses through physics-based disasters. The humor is anticipatory —
the player sees exactly what's about to go wrong, and it does, with dignity.

> **📋 Project memory:** `PROJECT_MEMORY.json` holds collaboration dynamics and
> artistic direction. **📖 Story:** `docs/story-and-dialogue.md` holds all
> dialogue, verdict tiers, and planned scenes (dream sequence, roadkill swap).

> **🛠 Skills (use them):** `.claude/skills/` defines the project's standing
> expertise — `/dialogue` (voice rules for all player-facing text),
> `/chapter-design` (comedy formula + chapter implementation pattern),
> `/art-direction` (visual constitution + review checklist),
> `/playtest` (browser harness, world geography, regression checklist).
> Invoke the matching skill BEFORE writing dialogue, designing content,
> changing visuals, or verifying gameplay.

**Genre:** 2D physics dark comedy · **Engine:** Vanilla JS + Canvas + Matter.js
**Art:** Black & white ink line art, procedural where possible
**Presentation rule:** All dialogue/verdicts are silent-film intertitles —
plain white-on-black cards (`#mission-overlay`), hard cut in/out. Dispatch
never says a number; damage reads as prose and diegetic cues (door sprite,
steam, tilt). In-world prompts all go through `Utils.drawPrompt()` (black chip,
white letterspaced caps). No Arial, no neon, no distressed fonts.

---

## What exists (July 2026): a four-chapter playable demo

### Chapter 1 — "The Wrong Church" (world: 25,000px)
1. Start in hearse; ringing phone booth (x≈800) gives the dispatch briefing
   (church deliberately unnamed — sets up the gag)
2. Hospital pickup (x=2500): interact with door, park in loading area, cargo
   spawns; load corpse → coffin → hearse
3. Long drive east; counterweight drawbridge puzzle (~x=15000): unload coffin
   onto the scale platform to lower the bridge, drive across, retrieve coffin
4. Deliver at St. Mary's (x=22000) — the *wrong* church
5. Callback phone (x=23000): dispatch reveals St. Margaret's; reload coffin,
   drive east past x=23300 → fade to chapter 2

### Chapter 2 — "East of Nowhere" (terrain regenerated, 18,000px)
1. Deliberately monotonous flat stretch with interior monologue snippets
2. Plank ravine (x=8000): carry a plank, lay it over the gap, cross carefully
3. Deliver at the real St. Margaret's (x=15500); closing phone (x=17000)

### Chapter 3 — "The Family Plot" (16,000px) · Chapter 4 — "The Open Casket" (15,500px)
Ch.3: re-collect the same corpse from St. Margaret's (x=1650), scripted loss
at Dead Man's Gap (x=6800, pre-bridged; loss triggers x=6250), deer at 8600,
graveyard delivery at 13500 (closed casket), closing phone 15200. Ch.4: new
corpse at 1500, branch gag at 6500 (head → drain at 7150), melon at 9000,
open-casket delivery at St. Anthony's 13000, final phone 14500. Scripted
beats live in `ChapterManager._updateChapter3Events/_updateChapter4Events`;
per-chapter props (tree, drain, melon stand) in `ChapterManager.drawProps`.
Substitute cargo is `Roadkill` (kind: 'deer'|'melon'); `Church.openCasket`
gates head-completeness. Dream sequence fires once in ch.2.

**Biers (Bier.js):** coffins are collected from and delivered onto wheeled
carts — never auto-ejected. Delivery = casket set on the destination
church's `bier` (watcher: `Game._checkBierDeliveries`), stationary, in
zone, adequately filled. The Hillcrest bier is a `runaway`: first loading
launches it downhill (cap 2.7 vs player walk 3); chase → grab (space) →
haul back → release at the gate → chocked. **Bridge (ch.1)** is a weight
scale: hearse or coffin on the platform lowers it (slow), removing weight
snaps it up (fast); hearse weight on the deck holds it; a 120px dead gap
between scale and deck zones makes the coffin mandatory. **Scripted
events** (ch.3 loss + deer-strike POV, ch.4 branch cascade) live in
`ChapterManager._updateChapter3Events/_updateChapter4Events` +
`drawEventOverlay/drawProps`.

Coffin/corpse/hearse damage persists across chapters. Death (falling off
screen) → fade → space to respawn at `game.checkpointX`.

---

## Architecture

```
Matter.js Engine (Physics.js wrapper, gravity y=1.0)
  - Static: terrain rectangles (one per segment) + boundary walls
  - Composite: hearse chassis + 2 wheels + spring-axle constraints
  - Dynamic: coffin (when free on ground)
        ↓ impulses via coffin.velocityX/Y
Corpse.js — Verlet ragdoll, 24 joints (reads Terrain.getGroundYAt; do NOT
port to Matter — it works and its floppiness is the comedy)
```

Per-frame property mapping (Matter → game state): `hearse.x/y/velocity/
tiltAngle/isAirborne` from chassis; `coffin.x/y/velocityX/Y` from its body.

**ChapterManager.js** is the progression system: chapters are code-defined
(`makeChapter1/2`), swapped behind a fade; each `apply()` re-activates
buildings, regenerates terrain, teleports the hearse, sets monologue +
checkpoint. There is no data-driven level system (LevelEditor/LevelManager
were removed July 2026).

### Files
```
index.html            entry point; #mission-overlay intertitle lives here
css/styles.css        intertitle + page styling (Georgia serif, no webfonts)
js/Game.js            orchestration, interactions, briefing cards, debug panel
js/Physics.js         Matter.js wrapper
js/Hearse.js          Matter composite; bump/overheat/door logic + tuning consts
js/Coffin.js          Matter body when free; lid/bump memory
js/Corpse.js          Verlet ragdoll + detachable head
js/Roadkill.js        substitute cargo: deer (ch.3) / melon (ch.4)
js/DreamSequence.js   ch.2 daymare (roof crawl → POV smash → overheat)
js/Player.js          walk cycle, enter/exit hearse
js/Terrain.js         procedural terrain + regenerate() for chapter swaps
js/ChapterManager.js  chapters, fades, chapter-2 terrain builder
js/Bridge.js          ch.1 counterweight drawbridge
js/Plank.js           ch.2 plank + PlankRavine
js/Church.js          delivery zones + prose verdicts (getDeliveryMessage)
js/Hospital.js        pickup flow
js/PhoneBooth.js      dispatch briefings
js/MonologueSystem.js floating interior monologue
js/AudioEngine.js     procedural engine/impact/music (starts on user gesture)
js/CorpseEditor.js    dev tool (?dev=1, key C)
```

## Physics tuning (Hearse.js constructor — the knobs that matter)

- `bumpThreshold: 14` bumps → back door opens permanently
- Impact scoring: `impactSpeed > 5` (below is suspension chatter),
  damage multiplier `impactSpeed/8` clamped 0.5–2, 36-frame cooldown;
  coffin takes transmitted damage when multiplier > 1.25
- Tuning intent: flat cruising stays free; hills taken at speed should be
  visibly clumsy — the comedy of errors lives in this margin
- Overheat: `heat += (|v|−7)² × 0.0015` per frame → redline ~45s, moderate
  driving never overheats. Passive cool 0.03/frame; standing at the hood
  (orange glow) cools 4× faster. Recovery latch at heat ≤ 40.
- Calibrate by feel, not by unit math — Matter velocities aren't px/frame.

## Interaction model (all on SPACE, priority-ordered in handleInteractions)

phone → church delivery → plank place/pickup → hospital door → corpse pickup
→ head pickup → coffin pickup/drop/load → corpse load → coffin unload →
hearse enter/exit. Proximity thresholds ~60px; hearse entry 80px.

## Dev tools

- `D` toggles debug panel (all numeric state lives there, not in player UI)
- `?dev=1` + `C` = corpse editor
- Console: `game.teleportToHospital() / teleportToCanyon() / teleportToMountains()
  / teleportToEnd() / jumpToChapter(x) / setCorpseScale(1.2)`
- Serve with any static server (e.g. `python3 -m http.server`); Matter.js
  comes from CDN

## Known issues / open questions

- **Frame-rate dependence:** the loop counts rAF frames with no fixed
  timestep, so on a 120Hz display the entire game (physics, heat, timers,
  scripted sequences) runs 2× speed. Needs a fixed-timestep accumulator in
  `gameLoop()` eventually; all tuning was calibrated at 60fps.

- Entity glow colors (green door glow, yellow phone ring, orange hood) are the
  last non-monochrome elements — open design question whether to keep color as
  a deliberate interaction language or find an ink-native affordance
- Hearse/coffin/phone PNG sprites still mixed with procedural drawing; plan is
  to replace with procedural line art ("strip, don't add")
- Opening phone booth is skippable by driving past — needs a soft gate or the
  mission never briefs
- Buildings can sit awkwardly on uneven terrain (chapter terrain flattens
  around them as a workaround)

## Near-term roadmap

1. **Title card**: intertitle-style opening ("LAST RIDE — a delivery")
2. **Procedural hearse/coffin/phone** drawings to finish the visual unification
3. **Fixed-timestep game loop** (see known issues)
4. Later: fragile one-use bridges, ferry timing, damage states, chapter 5+
   (the dream sequence, roadkill and head substitutions are all SHIPPED —
   see story doc for what each chapter contains)

## Conventions

- ES6 classes, one per file, loaded via plain `<script>` tags (no bundler)
- World coordinates everywhere; convert to screen only at draw time
- Comments state constraints, not narration; keep event logs, never per-frame logs
- Beware aggressive formatters — this repo has been mangled before; keep diffs
  minimal and intentional
