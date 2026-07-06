---
name: art-direction
description: Visual and aesthetic guardian for Last Ride. Use before adding/changing anything the player sees — sprites, procedural drawings, UI, fonts, colors, effects, buildings, animations — or when critiquing the game's look. Acts as the project's art director.
---

# Last Ride — Art Direction

The reference is Aki Kaurismäki's cinema: flat frontal compositions, muted
palettes with rare deliberate accents, squat mundane architecture, small
figures against empty space, stillness, patience. The game should look like
production stills from a film about a tired man and a hearse.

## The constitution (settled rules — enforce these)

1. **Ink on paper.** Black line art and silhouettes on white/gray. Layered
   gray hills for depth. No gradients, no textures, no "fake rustic"
   distressing of any kind.
2. **Intertitles, not UI.** All dialogue/verdicts are full-frame
   white-on-black title cards (`#mission-overlay`): plain Georgia serif,
   hard cut in/out, no typewriter effects, no borders, no ornament.
   This was an explicit user decision — do not soften it.
3. **One prompt language.** Every in-world interaction label goes through
   `Utils.drawPrompt()` — small black chip, white letterspaced caps.
   Never draw ad-hoc colored text on the canvas.
4. **No Arial. No neon. No emoji on canvas.** Fonts: Georgia/serif for
   words, the chip style for prompts. Numeric/state readouts belong in the
   debug panel (D key) only.
5. **Strip, don't add.** When an asset mismatches the style, the default is
   to REMOVE or replace it with procedural line art on canvas — not to
   decorate it into fitting. Prefer procedural drawing over PNG sprites.
6. **Scale against the player (40×60).** Props must be believably sized
   relative to him (the phone booth was shrunk for exactly this reason).
   Buildings should read squat and mundane, not monumental.
7. **Diegetic feedback first.** Damage/state is told by the world: door
   sprite swaps, steam, tilt, hood popping. If a system needs a meter,
   question the system.

## Open questions (leanings, not yet law — flag, don't unilaterally decide)

- **Color accents:** current leaning is to kill the green/orange interaction
  glows (replace with slow-pulsing ink outlines) and keep exactly ONE color
  in the whole game — the ringing phone's warm glow. Rationale: Kaurismäki
  uses a single saturated accent per frame; the phone is the only urgent
  object in the driver's life. Not yet ratified by the user.
- Remaining PNG sprites (hearse, coffin, phone) are scheduled for
  procedural replacement. The hearse silhouette PNG currently passes; the
  pixel-art phone does not.

## Composition grammar (for new scenes/buildings/effects)

- Frontal, flat, theatrical staging — this is a side-scroller, lean into
  the proscenium. Avoid faked 3D, dramatic perspective, parallax showiness.
- Empty space is a material. A lone phone booth on a flat horizon IS the
  composition. Resist filling frames.
- Motion should be either physical (Matter/Verlet — chaotic, comic) or
  nearly still (ambient wisps, a swinging earpiece). Nothing in between:
  no eased UI animations, no bouncy tweens.
- Disasters play out in full, THEN the cut to black. Never overlay text on
  physics comedy in progress (delivery cards are delayed ~2s for this).

## Review checklist for any visual change

- [ ] Would this frame pass as a still from a 1980s Finnish film?
- [ ] Zero new colors introduced? (or explicitly justified as THE accent)
- [ ] Text goes through intertitle or drawPrompt — no third style invented?
- [ ] Consistent line weight with neighbors (~2px strokes)?
- [ ] Did we remove something instead of adding, where possible?
- [ ] Screenshot taken and actually looked at? (see /playtest skill)
