# blended-tarky-api

<sub>The repository is still called `tarkov-quest-data`, and stays that way on purpose:
renaming it would move the published URLs, and apps already installed fetch from
them. Every address below is the one to use.</sub>

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
| **216 BattlePass document pins** | The documents exist as items in tarkov.dev. No source has a position for any of them |
| **223 map labels and 87 map texts** | On top of what tarkov.dev publishes, not instead of it. Switchboard, Heat Station, Desalinator, Central Discharge Collector, and room numbers no map prints |
| **141 corrected pin positions** | Places where a published position is wrong by enough to send you to the wrong door, plus 38 markers hidden because they aren't really there |
| **Story task locations** | The overlay has the chapters. It carries no coordinates at all, so every pin for them is placed here |
| **Objectives worded as the game words them** | 292 quests carry the wording against the objective ids a tracker ticks with. Not a formatting preference: the wiki asks for 2 ComTac II headsets where the game asks for one, sends *Job for a Patriot* to three maps it no longer uses, and gives *No Swiping* no map at all |
| **35 quests flagged as removed** | The wiki says so on the page; nobody publishes it as data, so tools keep listing quests BSG deleted |
| **Loyalty gates on 185 quests** | **162 are read straight off the game's own loyalty tabs**, 54 more out of the wiki's prose. The game also removes 39 that sources claim — *All This Filth...* is published at LL4 and offered at LL1 |
| **5 records that are one quest published per arm** | Make Amends is three ids, Battery Change two, identical objectives. You are offered exactly one, so listing them by id lists one quest three times |

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

Static files behind GitHub Pages. No clone, no key, no signup. Start with
everything in one file:

```
https://szepiz.github.io/tarkov-quest-data/api/quests.json
```

```js
const data = await fetch('https://szepiz.github.io/tarkov-quest-data/api/quests.json')
  .then((r) => r.json());
```

About 2.1 MB, so cache it rather than pulling it on every page load. Each quest carries a top-level `asOf` (the newest of its
field dates), so if your copy is newer you can skip the record without reading
its `provenance` at all.

### Take only the part you need

```
https://szepiz.github.io/tarkov-quest-data/api/index.json
```

`index.json` lists every file with its real size and what it holds, so you can
choose before downloading anything.

| file | size | what it is |
|---|---|---|
| `api/quests.json` | ~2.1 MB | everything, merged, with per-field provenance |
| `api/quests/core.json` | ~210 KB | name, trader, map, mode, loyalty tab, flags |
| `api/quests/requirements.json` | ~110 KB | level, prerequisite quests, loyalty and reputation |
| `api/quests/objectives.json` | ~1.1 MB | structured objectives with ids, zones and coordinates |
| `api/quests/wording.json` | ~190 KB | the game's own objective wording, keyed by objective id |
| `api/quests/provenance.json` | ~480 KB | which source each field came from, and when |
| `api/maps.json` | ~250 KB | the map side, with hand-placed corrections applied |
| **`api/firstparty/quests.json`** | ~210 KB | **quests read off the game screen. CC0.** |
| **`api/firstparty/mapdata.json`** | ~55 KB | **corrections, added labels and map text, hazards, interactables. CC0.** |
| **`api/firstparty/battlepass.json`** | ~22 KB | **216 BattlePass document spots. CC0.** |
| **`api/firstparty/story-marks.json`** | ~61 KB | **137 story objective positions. CC0.** |

The files under `api/quests/` are the same data as `quests.json`, cut by subject.
Rejoin them on `id` and the whole record comes back — the build verifies that on
every run and refuses to publish a split that does not reassemble. Take the whole
file or take slices, not both.

`api/maps.json` joins to the quests by quest id and by map name. Almost all of it
exists nowhere else: nobody publishes a position for a BattlePass document, a
room number the map doesn't print, or a hazard area, and where a source does
publish a position it's often wrong by enough to send a player to the wrong door.

### api/firstparty/ — the part that isn't a copy of anything

Everything else here is collected from other projects and merged. These four
files aren't: quests transcribed from the in-game trader screen, and positions
placed by hand and checked in the game. **CC0-1.0**, no third-party data in them,
and usable without touching `quests.json` at all — each reading carries
`questId`, tarkov.dev's id, so it joins onto whatever you already have.

The BattlePass spots and the story marks are split out because they are the two
most likely to be wanted alone: no source publishes a position for either, and
someone building a map layer for one of them shouldn't have to take label
corrections with it. **Story marks carry ids and coordinates, not wording** —
the chapter names and objective descriptions belong to the project that
publishes the campaign, so join on `objectiveId` against `api/maps.json` for
those rather than finding them relicensed here.

They also state what they can't tell you, which matters more than the readings:
the game reveals objectives progressively, so an unfinished quest shows fewer
lines than it has, and `objectivesComplete` is what says whether a list is whole.
`lineSuspect` marks a record whose quest line 1.1.0 renumbered, where matching by
name alone pairs the wrong records.

Every file is also reachable through `raw.githubusercontent.com` on the `main`
branch, which is the same bytes out of the same commit. Prefer the Pages URLs:
they serve `application/json`, state their cache window, and refresh on deploy,
where raw has served a stale copy long after a push.

[api/README.md](api/README.md) has the field list and the merge rules.

## Where the data comes from

Four public sources, collected verbatim, plus one that isn't public anywhere
else: 319 quests transcribed from the in-game trader screen, which is what the
other four get graded against.

| source | what it is | worth knowing |
|---|---|---|
| **tarkov.dev** (`json.tarkov.dev`) | 517 / 513 / 490 quests across PvP, PvE and Seasonal; 1,493 objectives, 441 with coordinates | the only source with map coordinates, and the only one that publishes no dates at all. Shipped its 1.1.0 correction on 2026-08-15 |
| **wiki** (escapefromtarkov.fandom.com) | 498 pages covering 540 quest ids | tracks the game closely, because people edit it. Dated per page. CC BY-SA |
| **tarkov-data-overlay** (tarkovtracker-org) | a community correction layer over tarkov.dev | targeted rather than broad. Carries JSON schemas worth reading |
| **SPT** (`sp-tarkov/server`) | BSG's own condition schema | the quest JSON hasn't moved since March 2025. A schema reference, not current data |
| **first-party readings** | 319 quests read off the in-game screen | CC0, and published on its own as `api/firstparty/quests.json`. Not a fifth opinion, it is the thing the other four are describing |

TarkovTracker isn't here on purpose. Its public API serves a user's own progress
behind a token and publishes no quest data of its own; underneath it's tarkov.dev
plus the overlay, both already collected.

`raw/` holds the four public sources exactly as they were served, with no
corrections and no merging. It isn't committed, partly because redistributing
other people's data is their call to make, and partly because a stale mirror in
someone else's repo helps nobody. `node fetch/fetch_all.js` rebuilds it in
about a minute.

## Who to believe when they disagree

238 of 540 quests disagree somewhere: 134 on the name, 79 on level, 47 on
objectives, 41 on the map, 14 on loyalty, 4 on the trader. The rule this repo
applies:

1. **An in-game reading wins.** Nothing outranks the game itself, whatever date
   the others carry.
2. **Otherwise the more recently dated value wins**, compared per field. An
   undated value never overwrites a dated one.

That used to be a fixed ranking — readings, then the wiki, then tarkov.dev —
and the ranking was measured rather than assumed: 527 of the wiki's 529 dated
quest pages were edited on or after patch 1.1.0, while tarkov.dev was still
pre-patch on about 91 names.

**The measurement reversed.** On 2026-08-15 tarkov.dev shipped its 1.1.0
correction: prerequisite chains dropped from 508 quests to 252, level
requirements from 376 to 224, Kappa from 257 quests to 16. Graded against the 319
in-game readings it now scores 100% where it speaks, against the wiki's 97%. A
fixed order cannot follow a change like that, so the order was replaced by the
dates themselves.

tarkov.dev publishes no per-task date, so its `asOf` is never a fetch time —
stamping one on the source that cannot date itself would make it look like the
freshest thing in the file and invert every merge. It earns a date only by
changing: this repo stores every field on each build, and a value seen to move is
dated the day it moved, as `"dating": "observed-change"`. A value never seen to
move stays undated.

Patch 1.1.0 (2026-08-03) is why any of this matters. It replaced
prerequisite-chain unlocking with trader loyalty, renamed about 91 quests, and
rewrote Kappa. Anything built on a pre-patch snapshot inherits all of it.

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

**`taskRequirements` is not "do these first".** 36 of the 273 edges aren't a
plain `complete`: 14 are **`active`** alone, meaning the prerequisite has to be in
progress and completing it breaks the requirement; 14 more are "active or
complete", 9 involve a failure, and 2 open **only** on one. Read the `status`
array. (1.1.0 cut the edge count from 607 — most quests now gate on trader
loyalty instead of on another quest.)

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
and gets a `{{Historical content}}` banner. 35 pages carry it, and most are
quests tarkov.dev still publishes.

**Some quests are faction-locked.** Four are exclusive outright (Road Closed and
Counteraction for USEC, Green Corridor and Our Own Land for BEAR) and eight more
are published twice under one name, once per faction, identical except for the
id. Ragman's Drip-Out and Textile lines are the ones that catch people.

## Build it yourself

```sh
node fetch/fetch_all.js                 # everything -> raw/
node fetch/fetch_all.js --only=wiki     # just one source
node fetch/build_api.js                 # the quest file -> api/quests.json
node fetch/build_maps.js                # the map file   -> api/maps.json
node fetch/build_slices.js              # the split      -> api/quests/, api/firstparty/, api/index.json
node fetch/check_observed.js            # grade every source -> observed/REPORT.md + OPEN.md
node fetch/test_firstparty.js           # the first-party files carry nobody else's data
node fetch/test_pick.js                 # which source wins a field
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

`build_slices.js` refuses just as bluntly: it will not write a split where a
field belongs to no slice, or where the slices don't rejoin into exactly the file
they were cut from.

## The viewers

Two self-contained HTML files. Open them in a browser without cloning anything:

- **[Quest trees](https://szepiz.github.io/tarkov-quest-data/view/tree.html)**
  (`view/tree.html`) draws each trader's quest tree. Prerequisite edges are drawn
  by what they ask for — completed, either outcome, only if **failed**, or a
  choice of several. A chain that crosses traders is followed in both directions:
  under each box, what fed it on the left and what it feeds on the right, and
  clicking either lands on that quest in the other trader's tree.
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

- **`api/firstparty/`, `observed/`, `mapdata/` and `fetch/`** are first-party,
  **CC0-1.0**. Do what you like with them.
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
