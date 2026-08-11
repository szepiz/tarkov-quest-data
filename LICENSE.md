# Licensing

Two licences, because part of this is first-party and part of it is derived from
a source that requires share-alike.

## First-party: CC0 1.0 (public domain)

- **`observed/`**, quests read off the in-game quest screen and transcribed. No
  upstream.
- **`mapdata/`**, positions placed by hand on a map and checked against the
  game. `api/maps.json` is built from it and is CC0 too, apart from the story
  chapter list, which comes from tarkov-data-overlay and is marked as such.
- **`fetch/`**, the collectors, the grader and the builders, including the viewer
  templates.

Use them for anything, with or without credit.

## Derived: CC BY-SA 3.0

- **`api/quests.json`**
- **`view/index.html`** and **`view/tree.html`**, the built pages with the data
  baked in. Both carry the attribution in a footer, because a self-contained page
  gets shared on its own, away from this repo.

They contain values taken from the Escape from Tarkov Wiki, which is CC BY-SA
3.0, so anything derived from them carries the same terms. If you redistribute,
keep the attribution and share alike:

> Escape from Tarkov Wiki contributors, https://escapefromtarkov.fandom.com
> Licensed CC BY-SA 3.0.

**Every value in `api/quests.json` names its source**, so you can filter down to
the licence you can accept. Dropping every value whose `provenance.src` is `wiki`
leaves a file with no wiki-derived content in it.

## Not redistributed

`raw/` is a local cache of four upstream projects, kept byte for byte so
provenance is never in doubt. **It isn't committed**, see `.gitignore`. Their
data is theirs to license, and a stale mirror in someone else's repo helps
nobody. `node fetch/fetch_all.js` rebuilds it from the original sources.

Credit to the upstream projects, which is owed rather than required:

- **tarkov.dev**, https://tarkov.dev (json.tarkov.dev)
- **Escape from Tarkov Wiki**, https://escapefromtarkov.fandom.com
- **tarkov-data-overlay** (tarkovtracker-org)
- **SPT** (sp-tarkov/server)

Escape from Tarkov is a trademark of Battlestate Games. This project is
unofficial and unaffiliated.
