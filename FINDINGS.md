# Findings

The long version. Everything below came out of comparing four published sources
against 305 quests read off the in-game screen, and most of it is stuff no source
currently reflects.

If you just want to use the data, [api/README.md](api/README.md) is enough. This
file is the receipts.

English is not my first language. AI was used to translate text from Hungarian to
English, and to summarise it and make the overall text easier to read. See the
note at the end of the [README](README.md#a-note-on-the-writing).

---

## Patch 1.1.0 broke more than it looks like it did

1.1.0 landed on 2026-08-03. It replaced prerequisite-chain unlocking with trader
loyalty, renamed about 91 quests, and rewrote Kappa. tarkov.dev has applied none
of the renames. The wiki has applied nearly all of them.

### Renames run in both directions

**20 numbered lines are confirmed renamed** from the game: Beyond the Red Meat,
Cargo X, Colleagues, Developer's Secrets, Easy Job, Farming, Friend From the
West, Glory to CPSU, Gunsmith, House Arrest, Lend-Lease, Operation Aquarius, Pets
Won't Need It, Sanitary Standards, Signal, Spa Tour, Test Drive, The Bunker, The
Cult, Vitamins.

The usual pattern is that a line head keeps the base name and later parts get
standalone names: Operation Aquarius - Part 2 became *Blood in the Water*,
Colleagues - Part 2 became *Tarkov-Style Diplomacy*, Vitamins - Part 2 became
*Supplements*, Beyond the Red Meat - Part 2 became *The Secret Recipe*. A
"- Part N" in a source name is a strong hint the quest has been renamed.

But the base name doesn't always go to Part 1. `Farming - Part 3` is the game's
*Farming*, while Part 1 became *Playing the Market* and Part 4 became
*Semiconductor Crisis*. Confirm by content, never by the part number.

Whole lines dissolve too, not just line heads. Five parts of `Spa Tour` are
confirmed renamed to titles sharing nothing with each other or with the original:
Part 1 to *One-Way Ticket*, Part 3 to *Fuel Shortage*, Part 4 to *I Need More
Power*, Part 5 to *Master Key*, Part 7 to *Chemical Experiments*. Several were
cut down as well (8 objectives to 1, for Chemical Experiments), and Part 1 also
changed weapon and map. The wiki has all five. tarkov.dev and SPT have none.

### The Gunsmith line split in two

Parts 1 to 12 and 15 became weapon names (MP-133 through AS VAL). That's 13
renames, the largest single set here.

Parts 13, 14, 16 to 21 and 25 became a **new numbered line**, *Gunsmith Master*,
with 13 and 14 swapped: Part 14 became Master 1 and Part 13 became Master 2.

And `Gunsmith - Old Friend's Request` became `Gunsmith Master - Part 12`. That's
a named quest turning numbered, the exact opposite of the 13 numbered-to-named
renames in the same original line.

Every mapping was verified word for word against the source objective. Worth
noting that a line-scoped content check can't catch a split like this, because
the game's name sits in one line and the source's in another, so they never get
compared.

### Lines were renumbered, which is worse than renaming

The Punisher is a three-cycle: the game's Part 1 is tarkov.dev's Part 3, its Part
2 is Part 1, its Part 3 is Part 2. Part 4 kept its number but changed weapon,
from a 12ga shotgun to an SVDS or TKPD.

The Tarkov Shooter lost tarkov.dev's Part 5 entirely (night kills on Customs, now
gone) and shifted 6 and 7 down a place. The wiki has already applied both
renumberings, which is how they were confirmed.

Because the names still match perfectly, nothing looks wrong. Matching by name
silently pairs the wrong records and then produces three confident "tarkov.dev
has the wrong map" findings that are pure artefact.

### 1.1.0 merged multi-part quests, and no source shows it

Confirmed by objective content rather than by counts:

- **Easy Job** is Part 1 plus the whole of Part 2.
- **The Bunker** is Part 1's first two objectives plus Part 2's five hermetic
  doors, with both parts' "survive and extract" dropped.
- **Glory to CPSU** is Part 2, with Part 1's objective demoted to optional.
- **Pets Won't Need It** is Part 1's first two plus Part 2's three pharmacies.

tarkov.dev still publishes every part separately and both halves keep their own
ids, so a merged quest looks like two live quests. The wiki agrees on Easy Job
and has caught up on the others' pages.

Independent corroboration: all four absorbed halves are tagged
`{{Historical content}}` on the wiki, arrived at from a completely different
direction.

**The merges break the prerequisite graph.** tarkov.dev gates the live quest
*Beneath The Streets* behind *Pets Won't Need It - Part 2*, a half that no longer
exists on its own. Anything walking `taskRequirements` treats that quest as
permanently locked.

### Quests were rewritten smaller, and larger

Smaller: Reconnaissance went from three specific water-treatment roofs to one
"any" roof (4 objectives down to 2). Special Comms went from five stashes to
three. Both sources still describe the old versions.

Larger, and this is the interesting direction: *Supervisor* went from 2
objectives to 6, three of them stashes at named Interchange spots (the BIZARRO
fitting rooms, Register #9, Register #7-8). Nobody publishes a position for any
of them, so nothing downstream can place a pin.

### The quantities and the maps in an objective are wrong more often than the count

The count is what everyone checks, because it's the difference you can see
without reading. Comparing the *wording* against the game screen on 268 quests
turns up a second layer, on quests where every source agrees about how many steps
there are:

- ***Hot Delivery*.** The wiki asks for **2** ComTac II headsets, 2 helmets and
  2 body armors. The game asks for one of each — 1.1.0 halved it, and the quest
  text in game says so outright ("Leave one set consisting of...").
- ***Job for a Patriot*.** The wiki sends you to Lighthouse, Customs or Reserve.
  The game says Streets of Tarkov, Shoreline or Ground Zero. **No overlap.**
- ***Easy-Breezy*.** Wiki: 50 kills on Factory. Game: 30, on Reserve or
  Lighthouse.
- ***Getting Some Air*.** Wiki: Shoreline, Interchange or Woods. Game: Shoreline,
  Lighthouse or Reserve.
- ***Hell on Earth - Part 2*.** Three hooded men on the wiki, two in the game.
- ***No Swiping*** names no map at all on the wiki ("in the base area"); the game
  says the smuggler bases on Shoreline or Interchange.
- ***Pyramid Scheme*** and ***Beneath The Streets*** list the right steps in the
  wrong ORDER, and the wiki misses that one of Beneath The Streets' is optional.

None of these would be caught by counting objectives, and a tracker that shows
the wiki's text sends the player to the wrong map with the wrong shopping list.

---

## 29 quests no longer exist

The wiki banners a removed quest's page with `{{Historical content}}` and keeps
the page. 33 pages carry it. Cross-referenced against the in-game records, 29 are
quests tarkov.dev still publishes that were never seen by a profile whose list
for that trader was captured in full.

Therapist loses six on its own: An Apple a Day Keeps the Doctor Away, Athlete,
Closer to the People, Private Clinic, Sanitary Standards - Part 2, Dangerous
Road. The full list is in [observed/OPEN.md](observed/OPEN.md).

Seven more are Icebreaker event-map quests. They're real, they're just invisible
outside the event.

Three fields in the collected sources answer questions that look open until you
read them: this banner, the overlay's objective corrections, and `failConditions`.

---

## The published prerequisite chain isn't what unlocks quests

Four quests are offered at a loyalty level **below** the quest tarkov.dev says
they require:

| quest | offered at | published prerequisite | which is offered at |
|---|---|---|---|
| Shaking Up the Teller | Prapor LL1 | Ice Cream Cones | LL2 |
| Oil Run | Prapor LL1 | Delivery From the Past | LL2 |
| Power of Persuasion | Prapor LL1 | The Tarkov Import | **LL3** |
| Easy-Breezy | Skier LL3 | Getting Some Air | LL4 |

You can't have finished a prerequisite that isn't offered until a level above the
quest it supposedly unlocks. So the published chain can't be the gate, which is
exactly what 1.1.0 changed. `check_observed.js` detects and tabulates this
automatically.

### And the loyalty gates that replaced it are barely published

tarkov.dev publishes **five** trader-loyalty requirements in the entire dataset.
Three are testable against the observations, and **all three are wrong**:

- Prapor's *Shaking Up the Teller*: published LL2, offered at **LL1**.
- Jaeger's *Hunter*, which the game now calls *All This Filth...*: published LL4
  by tarkov.dev **and** the wiki, offered at **LL1**.
- Mechanic's *Setting Priorities*: published Mechanic LL3, offered at **LL4**.
  The only one that UNDERSTATES, so a tool following it offers the quest a level
  early.

That last line is a correction. *Setting Priorities* was written up here as the
one tarkov.dev gate that was right, and it was not: the quest carries **two**
gates, Mechanic LL3 and Peacekeeper LL4, and the observed LL4 had been compared
against the Peacekeeper row instead of the Mechanic one. Matching the wrong row
of the right quest is the same class of mistake as matching the wrong quest, and
when a quest has several requirements it is worth naming which one you checked.

The remaining two are the faction variants of Ragman's `Textile - Part 1` at
Ragman LL4, which this profile can't reach.

**Reading the gates off the wiki instead works, mostly.** 65 quests carry one in
`api/quests.json` against tarkov.dev's 5, and checked against every observation
that shows a loyalty tab: **45 right, 1 wrong**. The failure is Peacekeeper's
*One Less Loose End*, where the wiki says "Must be Loyalty Level 2" and the card
sits in the LL1 tab.

For comparison: 62 wiki pages state a loyalty level, the overlay has 0, SPT has 4.

---

## Quests move trader, and it looks exactly like deletion

Three have moved into Skier alone: *Polikhim Hobo* from Prapor,
*Classified Technologies* and *From Hand to Hand* (published as
`Lend-Lease - Part 2`) from Peacekeeper. *Metal Birds* went the other way, Skier
to Peacekeeper.

So "published for a trader whose list I hold in full, but absent from that list"
is a question, not proof anything was removed. Collecting another trader resolves
it one quest at a time.

Separately: tarkov.dev's **PvE** record for *Against the Conscience - Part 1* says
Ref where the game says Fence. Its PvP twin has it right. A cross-mode difference
isn't evidence of a difference in the game, it can just as easily be one mode's
record being bad.

---

## Maps

**Bullshit is the one both sources get wrong.** tarkov.dev and the wiki both
publish it on Customs: stash an SV-98, a watch and a False flash drive in the
dorm's 3rd-floor stairwell. The game's version is on **Lighthouse**, at the
chalet tennis court, with an **AXMC** and a **Military** flash drive. Map, two of
three items, the drop spot and the structure all changed. Every other map
disagreement had at least one source right.

**The Huntsman Path - Administrator is the one where all three disagree.** The
game says Lighthouse, tarkov.dev says Streets of Tarkov, the wiki says Reserve.
All three agree it involves a signal flare at a railway location.

Two more where no source is right: **Easy-Breezy** (game: Reserve or Lighthouse,
every source: Factory) and **Job for a Patriot** (game: Streets of Tarkov, Ground
Zero, Shoreline; tarkov.dev: Lighthouse, Customs, Reserve).

**One-Way Ticket** was renamed, rearmed and relocated all at once. tarkov.dev
publishes it as `Spa Tour - Part 1`: Scav headshots with a 12ga shotgun on
Shoreline. The game asks for headshots with a Steyr AUG on Factory. The wiki has
caught up on all three.

**Decontamination Service** reads *The Lab* on the card against tarkov.dev's
Interchange.

---

## Quests the game has and nobody publishes

Five, checked by name **and** by content:

- Therapist's *Fall Ailment* and *The Tarkov Butcher*
- Peacekeeper's *Hiking*, *Secret Message* and *Demonstration Model*

*Secret Message* sets a trap for content matching. The only quest in any source
with a 12ga-shotgun headshot objective is tarkov.dev's stale description of
`Spa Tour - Part 1`, which superficially resembles it. It isn't the same quest:
that id's wiki page is *One-Way Ticket*, whose current content is an AUG on
Factory, and the game lists One-Way Ticket separately in the same tab with
exactly that. So a stale description of one quest happens to look like a
different, newer quest. Matching on content alone merges them, and only the
wiki's page mapping tells them apart.

---

## Mutually exclusive quests

Skier's *Chemical - Part 4*, Therapist's *Out of Curiosity* and Prapor's
*Big Customer* carry identical objectives, and each one's `failConditions` fails
it the moment either of the other two completes. SPT encodes the same under
`conditions.Fail`.

This is closed from both ends on the observed profile: Chemical - Part 4 is
completed, which is exactly why the other two are failed. A tool reading only
`taskRequirements` sees two ordinary incomplete quests and will nag forever.

A second pair, visible from both sides: Ref's *Decisions, Decisions* asks the
player to bring him compromising information about himself, and its objective is
word for word the second objective of Fence's *Between Two Fires*. Taking Fence's
side fails Ref's quest.

### And four quests exist only because something failed

The other end of the same mechanism. A requirement row carries a `status`, and on
four of the 631 edges that status is `["failed"]` — not "do this first" but
**"this quest does not exist unless you failed that one"**. Completing the
prerequisite doesn't open it. Nothing does.

| quest | trader | appears once you have failed |
|---|---|---|
| Hot Wheels - Let's Try Again | BTR Driver | Hot Wheels |
| Ironclad Proof | Prapor | Big Customer |
| Aid Stations | Therapist | Out of Curiosity |
| Loyalty Buyout | Skier | Chemical - Part 4 |

Three of those are the three-way choice above, seen from the losing side: the
trader whose version you failed offers you a way to make it up to them. Which
also means the *winning* trader has nothing to make amends for — take Skier's
arm and Loyalty Buyout never appears, which is what the observed profile shows.

The reason this is worth stating separately rather than leaving in the `status`
array: it reads as an ordinary prerequisite to anything that doesn't check, so
every one of these gets listed for every player, and three of the four are quests
most players will never be offered. `onlyAfterFailure` says it outright.

---

## "Either of these" is not a shape the data has

tarkov.dev's `taskRequirements` is a flat list, and a flat list can only mean
AND. BSG's own schema is no better: SPT's `conditions.AvailableForStart` is also
flat. So where the game branches, tarkov.dev keeps **one arm and drops the rest**.

*Battery Change* opens after Prapor's *Stick in the Wheel* or Ragman's
*Stabilize Business*. tarkov.dev publishes the first. A tracker built on it locks
the quest for everyone who took the other.

The wiki writes the choice out, in the infobox, as `|previous =[[A]]<br/>or<br/>[[B]]`.
Eleven quests carry one, and it is published as `requiresAnyOf`.

### What the game does instead is publish the quest several times

Chasing that turned up the actual mechanism, and it is not an OR at all.
*Make Amends* is **three separate quest ids**, same name, identical objectives,
one prerequisite each — one per arm. *Battery Change* is two. You are offered
exactly one, and anything listing quests by id lists one quest three times.

That is what the wiki's "or" is describing from the outside.

Recorded as `sameQuestAs`, and only where the wiki's own "or" names exactly the
arms the ids split along — two independent sources agreeing. Same name and the
same objectives is not enough on its own: *The Tarkov Shooter - Part 5* is two
ids with identical objectives too, and that is tarkov.dev's stale numbering
against the wiki's renumbering, a different thing entirely.

---

## The overlay does more than it looks like it does

Measured: **13 task entries**, correcting objectives on 11 and carrying zone
geometry for 2 (4 objectives, 8 vertices) against tarkov.dev's 602 zone outlines.
A targeted correction layer, not a second dataset.

It looked silent for a long time here, and that was a reading error rather than a
fact about it. The grader was only asking it for names, and names are almost the
only thing it doesn't carry. Graded on the maps it names, it's 1 right and 1
wrong. Its Easy-Breezy and Pathfinder entries are themselves stale.

It also carries whole sections nothing here reads yet: `prestige` (levels 1 to 5
with story requirements), `storyChapters`, `editions`, and two added tasks.

---

## Traps worth knowing if you build something similar

**Never write a failed fetch as though it were an answer.** An empty file is
indistinguishable from "this exists and is empty", and once it's on disk it gets
believed forever. Non-200, an empty body, and the one that actually bites,
**MediaWiki's `error` object arriving with HTTP 200**, are all failures. A run
that collected nothing throws rather than writing an index that says zero.

**Don't follow a wiki move chain to its end.** The move log records every page
move, so a chain can hop from one page's move onto a different page's. The quest
`Ambulance` was renamed to `First Aid`; separately, the *skill* page `First Aid`
was moved to `First Aid (skill)` to make room. Chasing to the end took the quest
all the way to the skill page and cached `{{Infobox skill}}` as a quest's wiki
data. Fetch every hop and take the nearest one that exists.

**A quest can share its name with a map or a skill**, and the wiki hands back
whichever page owns the title. Three impostors got cached as quest pages:
`Reserve` (the map), `Immunity` (a skill) and `First Aid (skill)`. That's worse
than a missing page, because it makes the wiki look stale or wrong about a quest
it was never asked about. "Immunity, last edited 2026-05-18" reads as a neglected
quest page when it's a perfectly current skill page. Reject any page with no
`{{Infobox quest}}`, and delete the copy an earlier run left on disk, because
every reader finds pages by filename.

**Looking a quest up by the name tarkov.dev publishes finds 405 of 510.** 1.1.0
renamed about 91 quests and editors are deleting the redirects. `redirects=1`
follows the ones still alive; for the rest, query the wiki's own history. The
move log first, since it states old to new explicitly and reaches back furthest,
then recent changes, where a blanked page's comment still reads
`content was: "#REDIRECT [[New Name]]"`. Follow chains ("Spa Tour. Part 1" to
"Spa Tour - Part 1" to "One-Way Ticket"). That recovers 91 more pages. The 4
remaining misses are all "Neuanfang", which is tarkov.dev serving a German name
for the quest everyone else calls "New Beginning".

**Build the wiki index from the union of all three modes.** Titles taken from the
regular list alone leave every PvE-only id with no page, which reads as the wiki
not covering those quests. Strip the zone tag before lookup so both ids land on
the one page the wiki has.

**The wiki's sub-bullets are content.** Optional objectives are written as
second-level bullets (`** (''Optional'') …`), so a line filter of `/^\*[^*]/`
drops every one of them. That doesn't look like a broken reader, it looks like
the wiki being short of objectives. It produced 16 false objective-count
conflicts here. Match `/^\*+/` and strip the leading stars.

**Match map names case-insensitively.** The wiki writes "on reserve" in lowercase
and the game itself writes "Streets of tarkov". A case-sensitive scan finds no
map, grades the source silent, and under-reports it.

**Naming no map is silence, not error.** The wiki writes No Swiping's objective
as "Eliminate any 10 enemies in the base area". It makes no claim about a map, so
it can't be wrong about which one. Grade `wrong` only when a source names a
different map.

**The quest card's location header isn't a map claim.** It prints "Any location"
for multi-map quests and "Transition" for transit ones. Comparing either against
a map name scores five agreeing quests as errors. The maps the game actually
names are in the objective text.

**Loyalty level 1 is the baseline every trader starts at.** A quest available at
LL1 has no loyalty gate, so a source publishing none is right, not silent.
Grading absence as a miss turned 10 correct answers into errors on the first run
of the scorecard.

**A partial name match must never pick a winner on its own.** "Glory to CPSU" is
a substring of both "Glory to CPSU - Part 1" and "- Part 2". Taking the first hit
chose Part 1 and then reported the wiki as wrong about a name it had right. An
observation that doesn't resolve to exactly one quest is unresolved, and the fix
is an explicit id on the record, not a cleverer guess. Related: several quest ids
can share one wiki page, so a wiki title isn't a unique key.

**One matcher means one matcher.** `observed_lib.js` exists so the grader and
both viewers resolve a name the same way. The grader once had a near-miss
fallback the library didn't, so a quest every source misnames was graded in the
report and dropped as "unmatched" by the viewers. Matching rules belong in the
library, not in one consumer.

**Trust a similarity detector's flag, verify its suggestion.** On The Tarkov
Shooter the shuffle detector correctly spotted that the line no longer lines up,
then named the wrong counterpart: it proposed source Part 8 for the game's Part 6
(53% word overlap against 36%) when the answer is Part 7. The distinctive word
*suppressed* is worth less to a Jaccard score than the filler *with* and *a* that
Part 8 happens to share. A similarity score is good at noticing that something is
off and bad at saying what it should have been.

**Scope the check to a single line.** Scoring an observation against every quest
of the trader gives "Debut is really Shootout Picnic", and rare-word weighting
gives "both are really Test Drive - Part 2". Prapor's kill quests share almost all their vocabulary. Renumbering and
merging happen inside a line by definition, so the candidates are the other parts
of that line and nothing else.

**An explicit id ends the argument.** Once a record carries a hand-set quest id
read off its objective text, re-flagging it as suspect only suppresses grading
that now works. Worse, one suspect part poisons its whole line, so a single
unpinned part undoes every pin beside it.

**Rule out a partial capture by order, not by count.** *Revision - Reserve* shows
8 objectives where both sources say 12, on a scrolled card, which is the exact
shape of a truncated screenshot. It isn't one. The game interleaves
locate-and-mark per vehicle while the sources group all locates then all marks,
and the game's list contains no LAV III line at all. A truncated capture would
show the source's first eight lines in the source's order.

**A stale description can impersonate a different quest.** Covered above under
*Secret Message*, but it generalises: content matching alone will merge a stale
record of one quest with a genuinely new one.

**Box widths have to be measured, not estimated.** `view/tree.html` lays out in
the browser with `getComputedTextLength()` for exactly this reason. A
character-count guess fits "Debut" and clips "Gunsmith - AS VAL".

---

## Odds and ends

- A **green triangle** in the bottom-right of a quest card marks a scrolled page,
  not a truncated objective list. Settled against the wiki: *Pyramid Scheme*
  shows 11 objectives with the triangle, and the wiki independently says 11.
- A **locked** quest shows a task unlock requirements panel instead of
  objectives. That's the game's own statement of what gates it and the most
  valuable thing worth capturing, but the list scrolls.
- Seasonal is a strict subset of the other modes. It carries no Arena crossover
  quests at all, which is why Ref's tree collapses from 20 boxes to 1 when you
  switch to it.
- 607 prerequisite edges in tarkov.dev, 683 of the same kind in SPT. Both are the
  pre-1.1.0 tree.
- Nobody has coordinates for BattlePass documents, and no source carries an item
  record at all.
