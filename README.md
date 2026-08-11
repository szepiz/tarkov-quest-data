# tarkov-quest-data

### [Open the quest trees →](https://szepiz.github.io/tarkov-quest-data/view/tree.html)

Every trader's quest tree, drawn from this data. There's also a
[side-by-side view of what each source says](https://szepiz.github.io/tarkov-quest-data/view/index.html)
about a quest, with the disagreements highlighted. Both have a PvP / PvE /
Seasonal switch and a BEAR / USEC faction switch, and both run entirely in the
browser.

## What's here that the sources don't have

Checked against the four this is built from: tarkov.dev, the wiki,
tarkov-data-overlay and SPT. Not a claim about every Tarkov tool in existence,
just about what those four publish.

| | |
|---|---|
| **Every value dated, per field** | None of the four publishes a date on anything. tarkov.dev has none at all, the wiki's are page revisions rather than data, the other two date a whole snapshot |
| **92 BattlePass document pins** | The documents exist as items in tarkov.dev. No source has a position for any of them |
| **87 room numbers and signs** | Dorm 301, Health Resort 219, and so on. Zero overlap with anything published |
| **215 map labels** | On top of the 303 tarkov.dev already publishes, not instead of them. Switchboard, Heat Station, Desalinator, Central Discharge Collector |
| **132 corrected pin positions** | Places where a published position is wrong by enough to send you to the wrong door, plus 39 markers hidden because they aren't really there |
| **Story task locations** | The overlay has the chapters. It carries no coordinates at all, so every pin for them is placed here |
| **9 hand-placed interactables and a hazard area** | Power panels, switches, the Shoreline sniper zone |
| **305 quests read off the game screen** | Names, objectives, trader, loyalty tab and status, with the date each was seen |
| **268 quests worded as the game words them** | Not a formatting preference: the wiki asks for 2 ComTac II headsets where the game asks for one, sends *Job for a Patriot* to three maps it no longer uses, and gives *No Swiping* no map at all |
| **33 quests flagged as removed** | The wiki says so on the page; nobody publishes it as data, so tools keep listing quests BSG deleted |
| **Loyalty gates on 165 quests** | tarkov.dev publishes them for 5. **150 are read straight off the game's own loyalty tabs**, 13 out of the wiki's prose. The game also removes 15 the sources claim — *All This Filth...* is published at LL4 and offered at LL1 |
| **4 quests that open only on a FAILURE** | It is in tarkov.dev's data, in a `status` field almost nothing reads, so they publish as ordinary follow-ups and get listed for every player. Completing the prerequisite does not open them |
| **11 quests unlocked by ANY ONE of several** | A flat requirement list can only mean AND, so where the game branches tarkov.dev keeps one arm and drops the rest, which locks the quest for everyone who took the other |
| **5 records that are one quest published per arm** | Make Amends is three ids, Battery Change two, identical objectives. You are offered exactly one, so listing them by id lists one quest three times |
| **5 quests no source has at all** | In the game, in none of the four, checked by name and by content |

---

Escape from Tarkov quest data where every value carries the date it was last
known to be true.

Quest data isn't scarce. Dated quest data is. Without dates, merging two sources
means taking all of one or none of it, and a value nobody has checked in a year
quietly overwrites one that was confirmed yesterday.

So every field here says when, and where it came from:

```json
"name": "The Punisher - Part 3",
"minPlayerLevel": 18,
"asOf": "2026-08-10",
"provenance": {
  "name":           { "src": "observed",   "asOf": "2026-08-10", "dating": "exact" },
  "minPlayerLevel": { "src": "tarkov.dev", "asOf": null,         "dating": "none"  }
}
```

`"dating": "none"` isn't a gap. It's the honest answer for a source that
publishes no date at all, and it means one thing: don't let that value overwrite
a dated one.

## Use it

One static file behind GitHub Pages. No clone, no key, no signup.

```
https://szepiz.github.io/tarkov-quest-data/api/quests.json
```

```js
const data = await fetch('https://szepiz.github.io/tarkov-quest-data/api/quests.json')
  .then((r) => r.json());
```

It's about 1.9 MB, so cache it instead of pulling it on every page load. Each
quest carries a top-level `asOf` (the newest of its field dates), so if your copy
is newer you can skip the record without reading its `provenance` at all.

There's a second file for the map side, about 240 KB:

```
https://szepiz.github.io/tarkov-quest-data/api/maps.json
```

BattlePass document pins, corrected marker positions, 219 added labels, 87 map
texts, hazards and the story campaign. It's separate so that a consumer who only
wants quest names and objectives doesn't download a few hundred KB of pins. The
two files join by quest id and by map name.

Almost all of `maps.json` exists nowhere else. Nobody publishes a position for a
BattlePass document, a room number the map doesn't print, or a hazard area, and
where a source does publish a position it's often wrong by enough to send a
player to the wrong door.

Both are also reachable through `raw.githubusercontent.com` on the `main`
branch, which is the same bytes out of the same commit. Prefer the Pages URLs:
they serve `application/json`, state their cache window, and refresh on deploy,
where raw has served a stale copy long after a push.

[api/README.md](api/README.md) has the field list and the merge rules.

## Where the data comes from

Four public sources, collected verbatim, plus one that isn't public anywhere
else: 305 quests read off my own game screen and written down, which is what the
other four get graded against.

| source | what it is | worth knowing |
|---|---|---|
| **tarkov.dev** (`json.tarkov.dev`) | 510 / 506 / 483 quests across PvP, PvE and Seasonal; 1,494 objectives, 572 with coordinates | the only source with map coordinates, and the only one that publishes no dates at all. Still uses every pre-patch quest name |
| **wiki** (escapefromtarkov.fandom.com) | 495 pages covering 533 quest ids | tracks the game closely, because people edit it. Dated per page. CC BY-SA |
| **tarkov-data-overlay** (tarkovtracker-org) | a community correction layer over tarkov.dev | small and targeted: 13 task entries. Carries JSON schemas worth reading |
| **SPT** (`sp-tarkov/server`) | BSG's own condition schema | the quest JSON hasn't moved since March 2025. A schema reference, not current data |
| **observed/** | 305 quests read off the in-game screen | mine, CC0. Not a fifth opinion, it's the thing the other four are describing |

TarkovTracker isn't here on purpose. Its public API serves a user's own progress
behind a token and publishes no quest data of its own; underneath it's tarkov.dev
plus the overlay, both already collected.

`raw/` holds the four public sources exactly as they were served, with no
corrections and no merging. It isn't committed, partly because redistributing
other people's data is their call and not mine, and partly because a stale mirror
in someone else's repo helps nobody. `node fetch/fetch_all.js` rebuilds it in
about a minute.

## Who to believe when they disagree

196 of 510 quests disagree somewhere: 126 on the name, 55 on objectives, 33 on
the map, 20 on level, 5 on loyalty. The rule this repo applies, in order:

1. **An in-game observation.** Nothing outranks the game itself.
2. **The wiki.** 527 of its 529 dated quest pages were edited on or after patch
   1.1.0, so it's current almost everywhere.
3. **tarkov.dev**, but only where the wiki has no page for the quest.

That ordering isn't a preference, it's what the dates support. It's also why
tarkov.dev's `asOf` is `null` rather than the time I downloaded it: stamping a
fetch time on the one source that can't date itself would make it look like the
freshest thing in the file and invert every merge.

Patch 1.1.0 (2026-08-03) is why any of this matters. It replaced
prerequisite-chain unlocking with trader loyalty, renamed about 91 quests, and
rewrote Kappa. tarkov.dev has applied none of those renames and publishes 6
trader-loyalty requirements across 510 quests. Anything built on it inherits
that.

## Things about this data that will catch you out

These aren't specific to this repo. If you're building anything on Tarkov quest
data you'll hit most of them.

**Names aren't identities, and neither are part numbers.** 1.1.0 renumbered
several quest lines. The card the game calls "The Punisher - Part 1" carries the
objectives tarkov.dev publishes under Part 3, and Part 2's are under Part 1. The
names match perfectly so nothing looks wrong, right up until you produce a
confident "tarkov.dev has the wrong map" finding that's pure artefact. Match
these lines by objective text.

**The wiki renumbered its pages in place instead of moving them.** The page
titled "The Punisher - Part 1" still carries the Part 3 banner image. So any
id-to-page mapping built from names is wrong for every reshuffled line, including
tarkov.dev's own `wikiLink` field. Links in `api/quests.json` are resolved by the
quest's current name for exactly this reason.

**A rename can hide a content change.** "Painkiller" became "Charity", and the
item changed from 5 Morphine injectors to 5 Adrenaline injectors. Same objective
count, so only reading the text catches it. Follow the rename and keep the old
item list and you send players after the wrong thing.

**An unfinished quest shows fewer objectives than it has.** The game prints a
step only once the step it depends on is done, so a hand-over line is missing
until the item is picked up. That's the screen working normally, not a source
inventing steps. Only a completed quest's objective count means anything.

**`taskRequirements` is not "do these first".** 58 of the 607 edges aren't a
plain `complete`: 23 are "active or complete", 19 "complete or failed", 4
"failed", and 11 are **`active`**, meaning the prerequisite has to be in progress
and completing it breaks the requirement. Read the `status` array.

**`failConditions` encodes mutually exclusive quests.** Skier's *Chemical - Part
4*, Therapist's *Out of Curiosity* and Prapor's *Big Customer* have identical
objectives, and finishing any one fails the other two. A tool reading only
`taskRequirements` sees two ordinary incomplete quests and nags forever.

**The three game modes differ by membership, almost never by field.** Across the
483 quests all three share, exactly one field value differs anywhere. What
changes is which quests exist: the Arena crossover quests are published once per
mode under different ids, tagged `[PVP ZONE]` and `[PVE ZONE]`. Diff by field and
you'll find nothing; diff by id and you'll find 50.

**tarkov.dev's payload isn't the shape its clients adapt it into.** `map`,
`trader` and `objectives[].maps` are bare id strings, and the locale files key
them as `"<id> Name"`, `"<id> Nickname"` and `"<id> name"`, nested under `data`.
Assume the adapted `{name}` shape and every map and trader comes back null, which
looks like missing data rather than a reader looking in the wrong place.

**"Night Factory" and "Ground Zero 21+" are the same maps as their twins.**
Collapse them before comparing anything, or every Factory quest reads as a source
disagreeing with itself. That's 70 false map conflicts against 33 real ones.

**Some quests are gone, and the wiki says so.** A removed quest keeps its page
and gets a `{{Historical content}}` banner. 33 pages carry it, and 29 of those
are quests tarkov.dev still publishes.

**Some quests are faction-locked.** Four are exclusive outright (Road Closed and
Counteraction for USEC, Green Corridor and Our Own Land for BEAR) and eight more
are published twice under one name, once per faction, identical except for the
id. Ragman's Drip-Out and Textile lines are the ones that catch people.

## What's in observed/

Every quest a single PvE, USEC profile could see, across all eleven traders, from
2026-08-10 onward. 305 records: 193 completed, 107 active, 4 failed, 1 locked.

That's not the same as complete. A quest gated behind an unfinished quest, or
behind a loyalty level not yet reached, never appears on screen at all, so no
trader in there is complete in the absolute sense. Seven traders had their whole
visible list captured. Four couldn't: Ragman (LL4 not reached), the BTR Driver
(no trader tab exists, so only the active quest is ever visible), the Lightkeeper
(not unlocked, kept as an empty file on purpose so you can tell "nobody looked"
from "there was nothing to see"), and Peacekeeper, whose LL4 tab opened after it
was collected and has not been read since.

Graded against those 305 records: **wiki 700 of 733 (95%)**, tarkov.dev 895 of
1023 (87%), SPT 460 of 548 (84%), the overlay 2 of 3.

Five quests exist in the game and in none of the four sources: Therapist's *Fall
Ailment* and *The Tarkov Butcher*, and Peacekeeper's *Hiking*, *Secret Message*
and *Demonstration Model*. They're in `api/quests.json` with ids beginning
`observed:`, since they have no upstream id to borrow.

More in [observed/README.md](observed/README.md), and everything still
unresolved is in [observed/OPEN.md](observed/OPEN.md), regenerated on every run.

## Build it yourself

```sh
node fetch/fetch_all.js                 # everything -> raw/
node fetch/fetch_all.js --only=wiki     # just one source
node fetch/build_api.js                 # the quest file -> api/quests.json
node fetch/build_maps.js                # the map file   -> api/maps.json
node fetch/check_observed.js            # grade every source -> observed/REPORT.md + OPEN.md
node fetch/build_view.js                # -> view/index.html
node fetch/build_tree.js                # -> view/tree.html
node fetch/report.js                    # -> raw/SUMMARY.md
```

A fresh clone has no `raw/`, so start with `fetch_all.js`. Everything else reads
from it and will tell you if it's missing.

`build_api.js` refuses to write if any date invariant breaks: an undated source
carrying a date, `dating: "exact"` with no date on it, a quest whose `asOf` isn't
its newest field date, a removal claim with no date behind it. A wrong value is
something you can spot. A wrong date silently wins a merge it should have lost.

## The viewers

Two self-contained HTML files. Open them in a browser without cloning anything:

- **[Quest trees](https://szepiz.github.io/tarkov-quest-data/view/tree.html)**
  (`view/tree.html`) draws each trader's quest tree.
- **[Source comparison](https://szepiz.github.io/tarkov-quest-data/view/index.html)**
  (`view/index.html`) puts every source side by side for a quest and highlights
  where they disagree. Filters for source disagreements, mode differences,
  quests confirmed in game, and quests removed from the game.

Both have a PvP / PvE / Seasonal switch and a BEAR / USEC / any faction switch,
and both work from a local copy too, with no server.

## Longer notes

[FINDINGS.md](FINDINGS.md) is the full log: every rename confirmed from the game,
the merges, the trader moves, the loyalty gates that turned out wrong, and the
traps worth knowing about if you build something similar. It is long, and it is
there for anyone who wants the evidence behind the summaries above.

## A note on the writing

English is not my first language. AI was used to translate text from Hungarian
to English, and to summarise it and make the overall text easier to read.

## Licensing

Full detail in [LICENSE.md](LICENSE.md). Short version:

- **`observed/`, `mapdata/` and `fetch/`** are mine, **CC0-1.0**. Do what you like.
- **`api/quests.json`** and the two built pages in `view/` contain wiki-derived
  values, so they carry the wiki's terms: **CC BY-SA 3.0**, attribution to
  *Escape from Tarkov Wiki contributors*. Every value names its source, so
  dropping the ones where `provenance.src` is `wiki` leaves a file with no
  wiki-derived content in it.
- **`raw/` isn't committed**, so nothing here redistributes anyone else's
  dataset. `raw/MANIFEST.json` is committed, which keeps the provenance without
  the redistribution.

Escape from Tarkov is a trademark of Battlestate Games. Unofficial and
unaffiliated.
