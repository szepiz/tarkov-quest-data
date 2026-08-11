# observed/

This is the one folder in the repo that holds first-party data.

`raw/` is a verbatim cache of other people's work and stays that way. Everything
here was read off the in-game quest screen and written down, with the profile and
the date it was seen under.

That provenance is the whole point. A quest's name, trader, location line and
objective text as the game itself prints them isn't one more opinion to weigh
against tarkov.dev and the wiki. It's the thing they're both trying to describe.
Where a source disagrees with a record in here, the source is wrong.

## What's in it

**305 records across all eleven traders**, captured from 2026-08-10 onward, on
game version 1.1.0, from a **PvE, USEC** profile.

| trader | records | | trader | records |
|---|---|---|---|---|
| Mechanic | 57 | | Ref | 19 |
| Prapor | 45 | | Fence | 5 |
| Skier | 39 | | BTR Driver | 1 |
| Therapist | 39 | | Lightkeeper | 0 |
| Jaeger | 37 | | | |
| Peacekeeper | 32 | | | |
| Ragman | 31 | | | |

Statuses: 193 completed, 107 active, 4 failed, 1 locked.

The faction was never written down at capture time and never had to be asked
for, because the collection settles it. Four quests are faction-exclusive with no
counterpart id. `Road Closed` is active on this profile and the wiki says it's
"only obtainable by USEC PMCs", while both BEAR-only quests (`Green Corridor` and
`Our Own Land`) are absent from a Prapor list that was captured in full.

That matters because eight further quests, Ragman's Drip-Out and Textile lines,
are published once per faction under one name, identical in every field except
the id. Anything keyed by id was picking one of those at a coin flip.

## What this is not

**It's every quest the profile could SEE, which isn't every quest that exists.**
A quest gated behind an unfinished quest, or behind a loyalty level not yet
reached, never appears on screen at all, so no trader here is complete in the
absolute sense. The `allVisibleCaptured` flag only says that every tab the trader
shows was captured. It's `false` for four traders, each with the reason recorded
on the document. Peacekeeper joined them once its LL4 tab opened: the trader was
captured while LL4 was unreached, so the tab it now shows has not been read.

Two more limits, so nobody over-reads it:

- **It's one player's sample, not a survey.** Absence from this folder means
  nothing on its own.
- **An observation is dated.** BSG changes quests. Every record carries
  `observedAt` and the game version, so a later contradiction can be read as a
  patch rather than as an error.

## The shape of a record

Required: `name`, `location`, `status`, `objectives` (verbatim, including the
`(Optional)` prefix and any `[PVE ZONE]` tag), and `objectivesComplete`.

Filed under **either** `availableAtLoyalty` (1 to 4) **or** `category`
(`essential`), never both. `status` is `completed`, `active`, `failed` or
`locked`.

The optional fields each exist because a real record needed one:

| field | when it's used |
|---|---|
| `questId` | the name alone is ambiguous. Setting it also stands the shuffle detector down for that record, since the pin is the answer it was looking for |
| `questIdReason` | why that id and not the other. Printed straight into OPEN.md |
| `objectivesHidden` | steps the game hasn't revealed yet, named where known |
| `unknownToEverySource` | no source has this quest, checked by name *and* by content |
| `merged` / `lineShattered` | 1.1.0 restructured the line this belongs to |
| `itemChanged` | a rename that also changed content, which is the dangerous kind |
| `mutuallyExclusive` | failed by design, because another quest completed |
| `openQuestion` | something the collection can't settle |
| `verbatimNote` | the game's own typo or inconsistency, kept as printed |
| `startingEquipment`, `unlockRequirements` | as shown on the card |

## Run the grader

```sh
node fetch/check_observed.js
```

It grades every collected source against these records and writes two files:

- **`REPORT.md`**, per quest, what each source gets wrong, plus the scorecard.
- **`OPEN.md`**, the register of everything still unresolved. It's **generated,
  never hand-maintained**: a list of open questions that has to be remembered
  goes stale silently, and stale reads as settled.

## What it found

Against these 305 records: the **wiki is 700 of 733 (95%)**, tarkov.dev is
**895 of 1023 (87%)**, SPT is 460 of 548 (84%), and the overlay is 2 of 3. The
overlay is a correction layer of 13 tasks and says nothing about almost
everything, which is by design.

tarkov.dev's weakest field by a distance is **names**. 1.1.0 renamed or
restructured more than twenty numbered lines and tarkov.dev has applied none of
them. It also still publishes **29 quests that no longer exist**, each of which
has a wiki page banner saying so.

Two rules had to be worked out before those numbers meant anything, because both
had been inflating the error counts:

- **An unfinished quest shows fewer objectives than it has.** The game reveals a
  step once the step it depends on is done. Only a `completed` record's objective
  count gets graded.

  That is a rule about the **count**, and it was over-applied for a while: the
  published `objectiveText` threw away an unfinished record's wording too, which
  is a different thing entirely. A step the game DID show is printed exactly.
  What actually matters is whether the record is short — if it shows at least as
  many steps as the next source lists, nothing is hidden and the game's words
  win. That is now how `build_api.js` reads it, and it moved 75 quests.
- **A part number isn't an identity.** 1.1.0 reshuffled The Punisher and The
  Tarkov Shooter, so the game's Part 1 carries another part's objectives. Those
  records are pinned with an explicit `questId` read off the objective text.

Everything still open is in [OPEN.md](OPEN.md). The longer write-up of what all
this turned up is in [../FINDINGS.md](../FINDINGS.md).
