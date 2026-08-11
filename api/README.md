# api/

`quests.json` is the file to use. Every value in it carries the date it was last
known to be true, and says which source it came from.

Fetch it directly. No clone, no key, no signup.

```
https://raw.githubusercontent.com/szepiz/tarkov-quest-data/main/api/quests.json
```

```js
const data = await fetch('https://raw.githubusercontent.com/szepiz/tarkov-quest-data/main/api/quests.json')
  .then((r) => r.json());
```

It's one static file behind a CDN, so it's fast and it can't go down on its own.
It's also about 750 KB, so cache it rather than pulling it on every page load.

This is the only folder meant for consumption. `raw/` is a local cache of the
upstream sources, `observed/` is the in-game record they get graded against, and
`fetch/` rebuilds all of it.

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

The same rules are embedded in the file as `mergeContract`, so they travel with
the data instead of living only in a README nobody fetched.

## How well each source can date itself

| source | dating | what the date means |
|---|---|---|
| `observed` | **exact, per record** | the day the quest was read off the in-game screen |
| `wiki` | **exact, per record** | that page's last revision timestamp |
| `overlay` | per snapshot | one build date for the whole file |
| `spt` | per snapshot | the last commit touching the quest JSON |
| `tarkov.dev` | **none** | it publishes no date for a task at any granularity |

**tarkov.dev's `asOf` is `null` on purpose.** Stamping it with a download time
would make the one source that can't date itself look like the freshest thing in
the file, and invert the whole merge. `retrievedAt` on the source record says
when it was downloaded, which is a fact about this repo and not about the data.

## Fields worth knowing about

| field | meaning |
|---|---|
| `confirmedInGame` | someone saw this quest on the in-game quest screen and wrote it down |
| `removedFromGame` | the quest's wiki page carries `{{Historical content}}`, which is a dated statement that it's gone rather than a failure to find it. **29 quests are still published elsewhere.** `removedSaysWiki` is when that page was last edited |
| `unknownToEverySource` | in the game and in no published source at all. Five of these. They have no upstream id, so theirs start with `observed:` |
| `modes` | `pvp`, `pve` or `seasonal`. The modes differ by membership, almost never by field value |
| `objectives` | taken from an in-game capture **only when the quest was completed**. The game reveals a step once the step it depends on is done, so an unfinished quest's list is a lower bound. Where that applied, `provenance.objectives.note` says so |
| `wikiLink` | resolved by the quest's **current** name, not by its id. The wiki renumbered several lines in place, so an id-to-page lookup links to the wrong quest |
| `requires` | tarkov.dev's `taskRequirements`, `status` array included. Read it: 58 of the 607 edges aren't a plain `complete`, and 11 need the prerequisite to be *in progress* |

## Rebuild it

```sh
node fetch/fetch_all.js && node fetch/build_api.js
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
