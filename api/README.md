# api/

Every value here carries the date it was last known to be true, and says which
source it came from.

**Take only what you need.** `index.json` lists every file with its size and what
it holds, so you can choose without downloading anything first.

| file | size | what it is |
|---|---|---|
| `quests.json` | ~2.1 MB | everything, in one file. Start here if you are not sure. |
| `quests/core.json` | ~210 KB | what a quest IS: name, trader, map, mode, loyalty tab, flags |
| `quests/requirements.json` | ~110 KB | level, prerequisite quests, trader loyalty and reputation |
| `quests/objectives.json` | ~1.1 MB | the structured objectives, with ids, zones and coordinates |
| `quests/wording.json` | ~190 KB | the game's own objective wording, keyed by objective id |
| `quests/provenance.json` | ~480 KB | which source each field came from, and when |
| `maps.json` | ~250 KB | the map side: features, extracts, hazards, corrections applied |
| **`firstparty/quests.json`** | ~210 KB | **quests read off the game screen. Ours. CC0.** |
| **`firstparty/mapdata.json`** | ~75 KB | **positions placed by hand and checked in game. Ours. CC0.** |

The files under `quests/` are the SAME data as `quests.json`, cut by subject.
Rejoin them on `id` and you get the whole record back — the build checks that on
every run and refuses to publish a split that does not reassemble. Take the whole
file or take slices, not both.

## firstparty/ — the part that exists nowhere else

Everything else in this repo is collected from other projects and merged. These
two files are not: they are quests transcribed from the owner's own screen, and
map positions placed by hand and checked in the game.

They are **CC0-1.0**, they carry no third-party data, and they stand alone — you
can consume them without touching `quests.json` at all. `questId` on each reading
is tarkov.dev's id, so you can join them onto whatever you already have.

Both say what they cannot tell you, which matters more than the readings: the
game reveals objectives progressively, so an unfinished quest shows fewer lines
than it has, and `objectivesComplete` is what says whether a list is the whole
list. `lineSuspect` marks a record whose quest line was renumbered by patch
1.1.0, where matching by name alone can pair the wrong records.

`quests.json` remains the file to use if you want one file and no decisions.

Fetch it directly. No clone, no key, no signup.

```
https://szepiz.github.io/tarkov-quest-data/api/quests.json
```

```js
const data = await fetch('https://szepiz.github.io/tarkov-quest-data/api/quests.json')
  .then((r) => r.json());
```

Served by GitHub Pages: `application/json`, `max-age=600`, refreshed on deploy.
The same bytes are also on `raw.githubusercontent.com` under the `main` branch
if you need a second way in, but prefer Pages. raw is not meant to back an
application and has served a stale copy long after a push.

It's one static file behind a CDN, so it's fast and it can't go down on its own.
It's also about 1.9 MB, so cache it rather than pulling it on every page load.

**`maps.json`** (about 250 KB) is the map side: BattlePass document pins,
corrected marker positions, added labels and map texts, hazards and the story
campaign. It joins to the quests by quest id and by map name, and carries the
same per-section dating. Most of it is first-party; the hand-placed part of it,
without the story campaign that belongs to tarkov-data-overlay, is also
published on its own as `firstparty/mapdata.json`.

This is the only folder meant for consumption. `raw/` is a local cache of the
upstream sources, `observed/` is the in-game record they get graded against,
`mapdata/` holds the hand-placed map work, and `fetch/` rebuilds all of it.

## Why the dates matter

Quest data already exists in several places. What it usually doesn't carry is
**when each value was last known to be true**. Without that, merging two sources
means choosing between taking all of one or none of it, and a stale field quietly
overwrites a fresh one.

So every field says when and where:

```json
{
  "id": "59c50c8886f7745fed3193bf",
  "name": "The Punisher - Part 3",
  "map": "Reserve",
  "minPlayerLevel": 18,
  "asOf": "2026-08-10",
  "confirmedInGame": true,
  "provenance": {
    "name":           { "src": "observed",   "asOf": "2026-08-10", "dating": "exact" },
    "map":            { "src": "observed",   "asOf": "2026-08-10", "dating": "exact" },
    "minPlayerLevel": { "src": "tarkov.dev", "asOf": null,         "dating": "none"  }
  }
}
```

Read the value from the top level and the date from `provenance`. Each quest's
own `asOf` is the newest of its field dates, so if yours is newer you can skip
the whole record without reading further.

## The merge rules

1. **Compare per field, not per quest.** A quest can hold a name confirmed
   yesterday next to a level nobody has checked in a year.
2. **`"dating": "none"` means the source can't say when the value was last true.**
   Don't let an undated value overwrite a dated one, in either direction. It
   isn't old and it isn't new, it's unknown.
3. **Newer wins.** Where both are dated, keep the later one.
4. **Our own in-game readings outrank everything**, whatever date the others
   carry. They are the only source that was read off the game itself.

The same rules are embedded in the file as `mergeContract`, so they travel with
the data instead of living only in a README nobody fetched.

## How well each source can date itself

| source | dating | what the date means |
|---|---|---|
| `observed` | **exact, per record** | the day the quest was read off the in-game screen |
| `wiki` | **exact, per record** | that page's last revision timestamp |
| `overlay` | per snapshot | one build date for the whole file |
| `spt` | per snapshot | the last commit touching the quest JSON |
| `tarkov.dev` | **none**, or `observed-change` | it publishes no date for a task at any granularity; see below |

**tarkov.dev's `asOf` is never the download time.** Stamping it with one would
make the source that can't date itself look like the freshest thing in the file,
and invert the whole merge. `retrievedAt` on the source record says when it was
downloaded, which is a fact about this repo and not about the data.

**It can still earn a date.** This repo stores the value of every tarkov.dev
field on each build, so a value that changes between builds is dated the day the
change was seen, as `"dating": "observed-change"`. Read that as *"at least this
new"* — it is evidence, not a claim about when the game changed. A value that has
never been seen to move stays `"dating": "none"`, because we know what it says
and not how old it is.

This matters because it replaced a fixed precedence of observed > wiki >
tarkov.dev. That order was measured rather than assumed — 527 of 529 wiki quest
pages had been edited on or after patch 1.1.0 while tarkov.dev was still
pre-patch on about 91 names — and on 2026-08-15 tarkov.dev shipped its
correction. Graded against 319 quests read off the game, it now scores **100%
where it speaks against the wiki's 97%**. A fixed order cannot follow a change
like that; dates can.

## Fields worth knowing about

| field | meaning |
|---|---|
| `confirmedInGame` | someone saw this quest on the in-game quest screen and wrote it down |
| `removedFromGame` | the quest's wiki page carries `{{Historical content}}`, which is a dated statement that it's gone rather than a failure to find it. **29 quests are still published elsewhere.** `removedSaysWiki` is when that page was last edited |
| `unknownToEverySource` | in the game and in no published source at all. Five of these. They have no upstream id, so theirs start with `observed:` |
| `modes` | `pvp`, `pve` or `seasonal`. The modes differ by membership, almost never by field value |
| `objectiveText` | the wording, from the best-dated source that has it — **the game's own wherever a record exists**. Whether an unfinished quest's list is short is not guessed at: every observation carries `objectivesComplete`, and `objectivesHidden` names the steps the game had not revealed. On the 31 where it showed fewer, the source's list is published instead and `provenance.objectiveText.note` says why. That is not a formatting preference — the wiki asks for 2 ComTac II headsets where the game asks for one, sends *Job for a Patriot* to three maps it no longer uses, and lists *Pyramid Scheme*'s ten steps in another order |
| `objectives` | the STRUCTURED list — a stable id to tick against, a type, maps, zone coordinates, item names, keys. Only tarkov.dev has any of it, so it is undated and published verbatim. Kept apart from `objectiveText` on purpose: 1.1.0 rewrote quests to different objective counts, so pairing the two by index would attach one quest's coordinates to another quest's sentence |
| `objectiveTextById` | the bridge between those two, on **243 quests**: the game's wording keyed by the objective id it belongs to, so anything rendering the structured list can show it. Matched by CONTENT, never by index — every objective has to claim one line with a clear margin over the runner-up or the whole quest is left alone, which is why 67 quests have none (*Pyramid Scheme*'s fifteen near-identical ATM steps, *Bad Habit*'s six objectives against the game's two). What a step asks you to DO has to agree as well as its wording, and it outranks the wording: *No Swiping*'s "Eliminate any target at the smuggler bases" shares more words with "Locate the smugglers' base" than with the eliminate objective, so word overlap alone would put the sentence on the wrong pin — the verb decides it instead. **Two shapes are exempt from the margin**. One line on each side, because a margin is a margin over a runner-up and there isn't one: 93 pair that way, and they are the cases where the wording can differ completely and the pairing still be forced — *Hunting Trip* publishes "kill Shturman with a headshot from over 40m using an M700" against the game's "twenty bosses with any bolt-action". And a VERB FAMILY holding one line and one objective, for the same reason one step down: *Counteraction*'s kill step names five maps where tarkov.dev names Lighthouse alone, scoring 0.333 against a floor of 0.5, and it is still the only eliminate step either side has |
| `objectivesGone` | **21 published objectives across 11 quests that the game does not have.** Only ever leftovers of a kind the card was ALREADY showing — a fourth stash step cannot be hidden behind the second, while a "hand over" step genuinely does appear only once the item is in hand. *Gratitude* asks for two of the four items, *The Huntsman Path - Big Game* is one objective now, *Revision - Reserve* eight. A consumer that renders `objectives` should drop these |
| `wikiLink` | resolved by the quest's **current** name, not by its id. The wiki renumbered several lines in place, so an id-to-page lookup links to the wrong quest |
| `traderRequirements` | the gate model: loyalty levels and Fence reputation. **150 of the 165 loyalty gates are the tab the quest was sitting under in game**, which is the one source allowed to CONTRADICT the others here rather than only add to them — it removed 15 gates the sources claim and corrected *Setting Priorities* from LL3 to LL4. LL1 is where every trader starts, so a quest seen at LL1 produces no row at all; `loyalty` keeps the raw reading including LL1, because a confirmed absence of a gate is worth more than silence |
| `traderTab` | **which tab of the trader's quest list the game filed it under**: `1`-`4` for the loyalty tabs, `"essential"` for the one the game calls Essential, absent for a quest nobody has seen. Not a requirement, and not derivable from one — LL1 and Essential both gate on nothing, so in `traderRequirements` they are indistinguishable from each other AND from the 219 quests with no observation. Present on all 319 records: LL1 64, LL2 74, LL3 61, LL4 27, Essential 93. No other source publishes the Essential tab at all
| `requires` | tarkov.dev's `taskRequirements`, `status` array included. Read it: 62 of the 631 edges aren't a plain `complete` — 37 need the prerequisite *in progress*, 21 take either outcome, and 4 want it **failed** |
| `onlyAfterFailure` | the quest exists **only once another has been failed**, and completing that one does not open it. Four quests: Hot Wheels - Let's Try Again, and the make-amends quests a trader offers after you side with a rival. It's derived from `requires`, and stated separately because a `status` of `["failed"]` reads like an ordinary prerequisite to anything that doesn't check |
| `requiresAnyOf` | complete **any one** of these. tarkov.dev's requirement list is flat, so it can only mean AND — where the game branches it keeps one arm and drops the rest, and a tracker built on it locks the quest for everyone who took the other. From the wiki's `|previous` field, which writes the choice out. **Requirement rows naming a quest in this list are superseded by it** |
| `sameQuestAs` | the same quest published under several ids, one per branch arm, identical objectives — Make Amends is three, Battery Change two. You are offered exactly one, so listing them by id lists one quest three times. Only where the wiki's own "or" splits along the same lines |

## Rebuild it

```sh
node fetch/fetch_all.js && node fetch/build_api.js   # quests.json
node fetch/build_maps.js                             # maps.json
```

The build refuses to write if any date invariant breaks: an undated source
carrying a date, `dating: "exact"` with no date on it, a quest whose `asOf` isn't
its newest field date, a removal claim with no date behind it. A wrong value is
something you can notice. A wrong date silently wins a merge it should have lost.

## Licensing

`quests.json` is a derived work and carries the strictest licence of its inputs:
**CC BY-SA 3.0**, because wiki-sourced values are in it. Attribution goes to
*Escape from Tarkov Wiki contributors*, https://escapefromtarkov.fandom.com

The `observed` values are first-party and are offered under **CC0-1.0** on their
own. They're in `observed/` if you want them without the share-alike.

Every value names its source, so you can filter to the licence you can accept.
