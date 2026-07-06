---
name: dialogue
description: Write or revise any player-facing text for Last Ride — dispatch calls, delivery verdicts, interior monologue, prompts, title cards. Use whenever adding/changing dialogue, mission text, or any words the player reads.
---

# Last Ride — Dialogue & Voice

You are writing for a Kaurismäki film, not a video game. Every line is an
intertitle: white text on a black card, or a floating thought. The player
reads it in silence.

## The two voices

**Dispatch** (phone calls): Bureaucratic fatalism. Never apologizes, never
explains twice, delivers bad news like weather. Talks like someone who has
made this exact call a hundred times and will make it a hundred more.
Occasionally, accidentally, almost kind.

**The Driver** (interior monologue only — he never speaks aloud): Tired,
plain, understated. Thinks in short declaratives. Regret without self-pity.

## Hard rules — violating any of these is a bug

1. **No exclamation marks.** Ever. If something is urgent, understatement
   makes it more urgent.
2. **No numbers, scores, or percentages** in player-facing text. Damage is
   prose ("There were remarks about the casket."), never "Coffin: 40/100".
3. **Economy.** If a line survives with a word removed, remove the word.
   Three short paragraphs maximum per card.
4. **No enthusiasm, no marketing voice, no "!"-energy synonyms** (amazing,
   great job, well done). The highest praise dispatch can give is
   "Yeah, that's the one."
5. **The joke is never announced.** Deadpan means the text pretends it isn't
   funny. If a line winks at the player, cut it.
6. **Bad news arrives casually.** The worse the news, the flatter the delivery.
7. **The driver is "you".** Dispatch never uses a name. Keep the driver unnamed.

## Calibration examples

BAD:  "Oops! Looks like that was the wrong church! Head to St. Margaret's!"
GOOD: "That was St. Mary's, wasn't it. Family's at St. Margaret's.
       Different church. They sound similar, I know."

BAD:  "Delivery complete — Score: 87/100. Great driving!"
GOOD: "He arrived more or less as he left. That's all anyone can ask."

BAD:  "WARNING: Engine overheating! Stop the vehicle!"
GOOD: (steam does the talking; if text is needed:) "She needs a moment."

BAD:  "I really wish I had chosen a different career path..."
GOOD: "Should've been a baker, or a butcher."

## Structural notes

- Briefings are `{ title, message, instruction }` objects. `title` is a
  short label ("Dispatch", "Delivered — St. Mary's"). `instruction` is one
  stage direction, italic, no arrow glyphs needed ("Drive east.").
- **Never name a destination that a gag depends on misidentifying.** The
  wrong-church joke works because the opening briefing only says "the church
  out past the canyon."
- Monologue snippets trigger by x-position (ChapterManager `setSnippets`).
  One thought each, ≤ 12 words ideally. They fill empty road, so they can be
  about nothing: that's the point.
- Delivery verdicts live in `Church.getDeliveryMessage(score)` — five tiers,
  prose only. Numbers stay in the console/debug panel.

## Where text lives in code

| Text | File |
|---|---|
| Opening briefing | `js/PhoneBooth.js` → `getMissionBriefing()` |
| Wrong-church call, completions, closing call | `js/Game.js` briefing objects |
| Delivery verdict tiers | `js/Church.js` → `getDeliveryMessage()` |
| Monologue snippets | `js/ChapterManager.js` chapter `apply()` |
| In-world prompt labels | call sites of `Utils.drawPrompt()` (lowercase in, rendered as caps) |

## Before you finish

Read every new line aloud in a tired voice. If any line sounds like a game,
an app, or a helpful assistant wrote it, rewrite it. Then update
`docs/story-and-dialogue.md` so the story doc stays the single source of truth.
