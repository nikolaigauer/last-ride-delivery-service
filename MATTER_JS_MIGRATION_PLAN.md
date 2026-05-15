# Matter.js Migration Plan

**Owner of next session:** Sonnet
**Date authored:** 2026-05-14 (Opus planning session)
**Goal:** Replace the hand-written hearse + terrain physics with Matter.js while preserving the custom Verlet ragdoll (Corpse.js) and all existing gameplay touchpoints.

---

## Why this migration

The hearse physics in `js/Hearse.js` is a hand-rolled rigid-body simulation:
- Manual ground-Y sampling at front/rear wheel positions
- A hand-coded airborne state machine with thresholds at `Hearse.js` ~line 197
- A "stability correction" that nudges velocity to escape bad poses (~line 247)
- Tilt smoothing via lerp

Known failure modes in the user's own notes (`PROJECT_MEMORY.json` → `active_issues`):
- Hearse occasionally locks into 90-degree bounce loops
- Buildings sit awkwardly on uneven terrain (different problem, same root: hand-rolled physics)

A 2D physics engine fixes all of this with proper rigid-body dynamics, suspension constraints, and continuous collision. **Matter.js** is the right tool because it's MIT-licensed, no build step required (drops in as a `<script>`), and well-documented with a canonical "car" example. Drop-in URL: `https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js`.

We are NOT replacing Corpse.js. The Verlet ragdoll is the most distinctive piece of tech in the project and works well. We bridge it at the boundaries.

---

## Critical invariants (do not break)

1. **Corpse.js stays a custom Verlet system.** It has 18 anatomical points with distance constraints and a dismemberment system. Matter.js bodies do not replace these — instead, when the corpse is ejected from the coffin, the coffin's Matter body velocity is read and applied to the corpse's reference point.
2. **All current interactions keep their player-facing semantics:**
   - Spacebar enters/exits hearse, picks up/drops coffin & corpse, loads into hearse, completes delivery
   - Bumps damage health; bumps open the hearse door at threshold; bumps open coffin lid at threshold
   - The episodic structure (one persistent corpse across missions) is being planned separately — don't bake assumptions about single vs multi-mission into the physics layer
3. **The river barge, bridge weight puzzle, and hospital/church mechanics keep their game logic.** They get new Matter bodies but the interaction contracts (e.g. `canCompleteDelivery`, `checkHearseInLoadingArea`) remain.
4. **Asset usage:** keep rendering the hearse from `assets/hearse.png` / `open-door-hearse.png` by drawing the sprite *aligned to the Matter body's position and angle*. Do not switch to vector hearse.
5. **Audio engine** (`AudioEngine.js`) hooks into hearse velocity and airborne state. Keep those reads working — they'll just read from `Matter.Body.getVelocity(body).x` and a derived `isAirborne` flag.

---

## Architecture after migration

```
┌─────────────────────────────────────────────────────────────┐
│ Matter.js Engine (new)                                      │
│   - World: gravity y=1.0                                    │
│   - Static body: terrain (built from Terrain.landscapePoints)│
│   - Composite: hearse (chassis + 2 wheels + 2 springs)      │
│   - Dynamic body: coffin (when on ground / ejected)         │
│   - Dynamic bodies: barge, bridge segments                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (positions, velocities, collision events)
┌─────────────────────────────────────────────────────────────┐
│ Game.js (orchestrator) — mostly unchanged                   │
│   - update(): step Matter engine + run game-state logic     │
│   - render(): read Matter body transforms, draw sprites     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ (impulses, position seeding)
┌─────────────────────────────────────────────────────────────┐
│ Corpse.js — UNCHANGED Verlet ragdoll                        │
│   - Receives impulses on ejection                           │
│   - Receives position seeds on coffin load                  │
│   - Reads ground Y from Terrain.getGroundYAt() (unchanged)  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Foundation (1 session, ~2-3 hours)

**Goal:** Matter.js engine running alongside the existing code, drawing nothing yet but stepping every frame.

1. Add Matter.js via `<script>` in `index.html` before `js/main.js`.
2. Create `js/Physics.js`:
   ```js
   class Physics {
       constructor() {
           this.engine = Matter.Engine.create();
           this.engine.gravity.y = 1.0;
           this.world = this.engine.world;
       }
       step(dtMs = 16.67) {
           Matter.Engine.update(this.engine, dtMs);
       }
   }
   ```
3. Instantiate in `Game.js` constructor before terrain. Step it in `update()` at the top of the method (before any object updates).
4. **Test:** game still plays identically; no Matter bodies exist yet, but the engine runs.

---

## Phase 2 — Terrain as static Matter body (1 session, ~2 hours)

**Goal:** Replace `Terrain.getGroundYAt()` consumers progressively, starting with hearse.

1. In `Terrain.js`, add a `buildMatterBody(physics)` method:
   - Convert `landscapePoints` into a Matter chain of static rectangles (or a single static body via `Matter.Bodies.fromVertices`).
   - Recommended approach: **chain of static rectangles** per landscape segment, rotated to match slope. Easier to debug than vertex-list bodies. Use `isStatic: true`.
   - Tag with `collisionFilter` group so the corpse Verlet system (which doesn't use Matter) is unaffected.
2. Keep `Terrain.getGroundYAt()` as-is. Other systems (Corpse.js, player walking) still use it.
3. **Test:** no behavioral change yet — terrain body exists but nothing collides with it.

**Edge case:** The terrain has flattened patches around hospital (x=2500), church (x=22000), and river (x=13500). Make sure the Matter terrain mirrors those flat areas exactly so buildings sit cleanly.

---

## Phase 3 — Hearse as Matter composite (1-2 sessions, ~4 hours)

**Goal:** Replace `Hearse.update()` with Matter physics for movement, leaving game-state logic (door, bump counter, sprite selection) intact.

1. Build the hearse as a Matter composite (see Matter's `examples/car.js` for the canonical pattern):
   ```js
   const chassis = Matter.Bodies.rectangle(x, y, 210, 60, { density: 0.002 });
   const wheelA  = Matter.Bodies.circle(x - 70, y + 30, 20, { friction: 0.8 });
   const wheelB  = Matter.Bodies.circle(x + 70, y + 30, 20, { friction: 0.8 });
   const axelA = Matter.Constraint.create({ bodyA: chassis, pointA: {x:-70,y:30}, bodyB: wheelA, stiffness: 0.5, damping: 0.5 });
   const axelB = Matter.Constraint.create({ bodyA: chassis, pointA: {x: 70,y:30}, bodyB: wheelB, stiffness: 0.5, damping: 0.5 });
   ```
2. Driving = apply torque to wheels: `Matter.Body.applyForce(wheelA, wheelA.position, {x: 0.05, y: 0})` or use angular velocity. Tune values to match current feel (max ~12 px/frame horizontal velocity).
3. Map back to existing fields the rest of the code reads:
   - `hearse.x` ← `chassis.position.x - chassis.bounds.width/2`
   - `hearse.y` ← `chassis.position.y - chassis.bounds.height/2`
   - `hearse.velocity` ← `chassis.velocity.x`
   - `hearse.tiltAngle` ← `chassis.angle`
   - `hearse.isAirborne` ← derive from contact events (see Matter's `collisionStart`/`collisionEnd`)
4. **Replace** the new terrain-impact bump detection (just added to `Hearse.js`) with **collision-event-based** bump detection. Matter emits `collisionStart` events; use the impact velocity to scale damage.
5. **Test:** drive the hearse over hills. It should ride smoothly, lift off ramps naturally, and never get wedged.

**Specifically delete:**
- The airborne state machine (`isAirborne`, `velocityY`, `gravity`, lines ~163-210 in current Hearse.js)
- The tilt smoothing (lines ~220-250) — Matter handles this
- The "stability correction" — Matter doesn't get stuck in the same way
- The wheel-Y sampling — wheels are now Matter circles

**Keep:**
- Door state machine (`doorOpen`, `doorTimer`, `doorOpenedByBump`, bump threshold logic)
- `loadCoffin`, `unloadCoffin`, `shouldEjectCoffin`
- Sprite rendering — just read position/angle from the Matter chassis

---

## Phase 4 — Coffin as a Matter body (1 session, ~2 hours)

**Goal:** Coffin behaves as a real physical object when ejected; in-hearse it's still positionally locked to the hearse.

1. Give the coffin a Matter body when active. When `coffin.inHearse` is true, the body is removed from world (or made non-colliding) and the coffin renders at the hearse's back position.
2. When ejected (`ejectFromHearse`), add the body back to the world at the hearse's rear with appropriate velocity copied from the hearse chassis.
3. Coffin lid-bump damage continues to come from collision events.
4. **Test:** ejected coffin tumbles realistically down hills; corpse still ejects from coffin lid when bumps exceed threshold.

---

## Phase 5 — Bridge & barge (1 session, ~2 hours)

**Goal:** Replace `Bridge.js` weight scale with a Matter hinge constraint, and `RiverCrossing` barge with a kinematic Matter body.

1. **Bridge:** the see-saw is a single dynamic body with a `Matter.Constraint` pinning its center to a fixed point. Coffin weight on one side rotates it naturally. Hearse drives on when it's at the right angle.
2. **Barge:** kinematic body (manually positioned, but other bodies collide with its top). Move it left/right based on the existing switch logic.
3. **Test:** the bridge puzzle still works; the barge ferries the hearse across.

---

## Phase 6 — Corpse Verlet ↔ Matter bridge (1 session, ~1 hour)

**Goal:** Make the ragdoll receive impulses from Matter collisions without becoming a Matter body itself.

1. When `corpse.ejectFromCoffin` is called, read the coffin's Matter body linear velocity and pass it to `Corpse.ejectFromCoffin()` so all Verlet points inherit the impulse.
2. When the player drops the corpse, its current Verlet positions remain. No change needed.
3. When the corpse hits the ground, Corpse.js still does its own ground collision via `Terrain.getGroundYAt()`. No Matter interaction needed.
4. **Future-but-not-now:** detached limbs could become Matter bodies for nicer rolling. Don't do this in this migration.

---

## Phase 7 — Cleanup & verification (1 session, ~1 hour)

1. Delete dead code from `Hearse.js`: old airborne block, old direction-tracking, old `wheelOffset`/`wheelBase` if unused.
2. Verify all `teleportTo*` console commands still work — they directly set `hearse.x`, which now needs to call `Matter.Body.setPosition(chassis, ...)`.
3. Verify the level editor's hearse placement works (only matters in `?dev=1` mode).
4. Update `claude.md` to reflect the new physics architecture.
5. Profile: ensure 60fps at world position x=13500 (river) where the most bodies coexist.

---

## What NOT to do in this migration

- **Don't switch rendering engines.** Stay on raw Canvas2D. Matter has a debug renderer; use it temporarily but turn it off before commit.
- **Don't make the corpse a Matter ragdoll.** It's tempting and it's wrong — the Verlet ragdoll is the project's character. Matter ragdolls look like bowling pins. Resist.
- **Don't touch the audio engine, mission system, or level manager.**
- **Don't add Phaser, Pixi, or any framework.** Matter is the only dependency added.
- **Don't normalize the visual style.** The user already locked in Option A (ink/woodcut). Visual work is being handled separately.

---

## Reference links (verify current before use)

- Matter.js docs: https://brm.io/matter-js/docs/
- Matter.js car demo (canonical reference): https://brm.io/matter-js/demo/#car
- Source of car demo on GitHub: search the `matter-js/examples` folder for `car.js`

---

## Test scenarios after each phase

Use these to verify nothing regressed:

1. Start game → drive east → arrive at hospital → press space at door → drive into loading area → pick up coffin (with corpse already inside) → load into hearse → continue east.
2. Drive over the canyon section (50%-60% world position). Should launch off the ramp and land cleanly without getting stuck.
3. Drive over mountain peaks (60%-75%). Should be rough but never wedged at 90°.
4. Arrive at river (~x=13500). Bridge/barge crossing works.
5. Reach church (x=22000). Park in delivery area. Complete delivery. Score displayed.

If any of these break, fix that phase before proceeding.
