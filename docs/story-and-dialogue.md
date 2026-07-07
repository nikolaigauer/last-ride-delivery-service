# Last Ride Delivery Service — Story & Dialogue

## Tone Reference

**Kaurismäki inspiration:**
- Deadpan delivery, working-class fatigue
- Dry absurdist humor, economy of words
- Melancholy underneath
- **Presentation rule:** all dialogue and verdicts appear as silent-film intertitles —
  plain white on black, hard cut in and out. Dispatch never says a number.
  No exclamation marks unless someone is actually on fire.

## Characters

### The Driver
*Name: TBD*

- Silent protagonist. On the phone we only ever see the dispatcher's side.
- Interior monologue appears as floating text on long stretches (MonologueSystem).

### Dispatch
- Gives job briefings via phone booth. Never apologizes, never explains twice.
- Delivers bad news like weather: "They sound similar, I know."

---

## Chapter 1 — The Wrong Church (implemented)

**Opening call (phone booth, x≈800):**
> Pickup at the county hospital, east of here. They'll have him ready.
>
> Delivery's the church out past the canyon. Long road. Don't lose him again.
>
> Try not to make it two funerals.

*Note: the destination church is deliberately unnamed — the gag below doesn't work
if dispatch said "St. Margaret's" up front.*

**Drop at St. Mary's** — delivery verdict plays as prose (see Church.getDeliveryMessage
tiers), then: *"A phone is ringing, further east."*

**The callback (deliveryBooth):**
> Yeah... about that drop.
>
> That was St. Mary's, wasn't it. Family's at St. Margaret's. Different church.
> They sound similar, I know.
>
> Grab the casket. Head east. Don't make a thing of it.

## Chapter 2 — East of Nowhere (implemented)

Long, deliberately monotonous flat stretch. Interior monologue along the way:

> Some days the road just keeps going.
>
> Some days it's the wrong church, right corpse. Other days it's the right church, wrong corpse.
>
> Should've been a baker, or a butcher.
>
> Always something. Always something between you and where you're supposed to be.
>
> St. Margaret's. Better be the right one this time.

Plank ravine puzzle mid-route. Delivery at the real St. Margaret's.

**Closing call:**
> Yeah, that's the one. Good work.
>
> Go home. Wash the hearse. There'll be another call.
>
> There's always another call.

---

## Delivery verdict tiers (Church.getDeliveryMessage)

| Condition | Verdict |
|---|---|
| ≥90 | Not a scratch on him. Nobody says thank you in this business. Still. |
| ≥70 | He arrived more or less as he left. That's all anyone can ask. |
| ≥50 | There were remarks about the casket. Nothing in writing. |
| ≥30 | The family was... understanding about the condition. |
| <30 | We're getting calls about you. Do better. |

---

## The Dream Sequence — "the daymare" (chapter 2, IMPLEMENTED)

Mid-way through the long flat stretch, at cruising speed (fires once,
x 8700–11000, corpse aboard — see `js/DreamSequence.js`):

The frame darkens. The back door swings open by itself. A figure climbs out
and crawls, slowly, along the roof of the moving hearse toward the cab —
pausing once to lift its head. Held just past comfortable. Then a hard cut
to first-person: the road, the wheel, his hands — eyes appear in the
rearview mirror — and the body slams upside-down onto the windshield,
glass cracking, white flash—

Sideview. The hood is up. Steam. The engine is dead. The hearse has
overheated. That was all it ever was.

> Need to sleep more.

Design intent: a controlled surreal/horror note over the deadpan — and the
nightmare resolves into the game's most mundane mechanic (the overheat),
which retroactively makes it both funnier and sadder. Also quietly teaches
that chapter 2+ can no longer be predicted. Preview from console:
`game.dreamSequence.start(true)`.

## Chapter 3 — The Family Plot (IMPLEMENTED)

The widow moved the service: collect the SAME corpse back from St. Margaret's,
rebury at Hillcrest. Dispatch: *"Try not to lose him. Again."* At Dead Man's
Gap — already bridged; the road was never the problem — a scripted cascade
fires the game's own systems: door pops on the washboard, coffin ejects, lid
opens, and the body bounces down the road into the one hole in the county.
*"Of course." / "Can't bury an empty box."* A dead deer waits up the road
(`space — take the deer`). Load it in: *"God forgive me."* Delivery verdict:
**"Closed casket. The family was moved. Nobody looked."** Closing call:
*"Whatever happened out there, I don't want to know. … Burn the gloves."*

Monologue jinx before the disaster: *"Smooth so far."*

## Chapter 4 — The Open Casket (IMPLEMENTED)

New client: a professor. Family wants an open casket — *"the whole man, top
to bottom."* Dispatch says **mind the trees**; there is a sign; there is a
tree. The branch jolts the hearse hard (real physics — the car goes briefly
airborne): the door pops, the coffin ejects, the lid goes, the corpse
ragdolls onto the road, and the head separates in the tumble and rolls —
and rolls, past the wreck — into a storm drain. *"That's not ideal."*
The player must reassemble the situation by hand: body back in box, box back
in hearse, and a head from somewhere. A roadside stand sells melons of
dignified proportions (`space — take the melon` → *"Close enough."*).
Open-casket delivery requires the corpse whole or something head-shaped along
for the ride. Verdict: **"Open casket. The widow said he finally looked at
peace. Rounder than she remembered. At peace."** The melon rolls onto the
lawn during the drop; nobody says a word about it. Final call:
*"Stop telling me how you do this. I mean it."* → THE END.

---

## REVISED ARC (July 2026 restructure — implemented)

- **Ch.3**: corpse lost INTO THE RIVER (uphill door-pop, coffin slides back
  down the hill, body drifts downstream) → deer strike → roadkill substituted
  → delivered at Hillcrest, closed casket, plain bier. *"Nobody looked."*
- **Ch.4 — "The Second Funeral"**: a fisherman finds him ten miles downriver.
  Dispatch: *"The one from Hillcrest. Don't ask how I know."* Open casket at
  St. Anthony's — the whole man. His box waits on a cart at the crest of the
  bluff; approach it and it departs east downhill. The tumble severs the head
  (no more tree); the head rolls to a storm drain; the melon completes him.

## Future scenarios (user-approved concepts, unbuilt)

- **Delivery front-desk ritual**: mirror the hospital pickup at destinations —
  park (sign), walk to entrance, brief staff dialogue modal, come out with
  their cart, transfer the casket, wheel it to the designated door.
- **THE WRONG COFFIN SNATCH** (episode-1 upgrade): when the driver returns to
  St. Mary's to retrieve the mis-delivered casket, the funeral is ALREADY IN
  MOTION — and he snatches *a* coffin. Any coffin. Wrong body. Awkward
  interaction dialogue as he wheels it out mid-service.
- **Weight-based jump**: a gap that can only be jumped with an EMPTY hearse —
  unload casket/corpse, jump, then manually drag them across/around. Ideally
  it's the CORPSE that gets dragged.
- **Weight & desecration effort**: corpse/casket weight should cost the player
  real effort (slow carry, stamina, drag physics) — the work of the forbidden
  should be felt more as the game goes on.

## Brainstorm notes

- Driver name candidates: keep him unnamed as long as possible; dispatch can call
  him "you" forever. If a name is ever needed it should be aggressively plain.
- Possible chapter 3 hook is already planted: "There's always another call."
