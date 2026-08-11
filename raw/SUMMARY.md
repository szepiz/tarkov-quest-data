# Foundation snapshot

Collected 2026-08-11T07:30:17.836Z. Raw only, nothing corrected, nothing merged.

## tarkov.dev (json.tarkov.dev)
- 510 quests (regular); 506 pve, 483 seasonal
- 1494 objectives, 572 of them carrying map coordinates
- 432 quests with a player level, 607 prerequisite edges
- **6 trader loyalty requirement(s)**, 11 reputation requirement(s)
- string fields are locale keys; `*.tasks_en.json` resolves them (key is `"<id> name"`, nested under `data`)

## tarkov-data-overlay (tarkovtracker-org)
- published build v1.55, generated 2026-08-04T00:38:15.168Z
- 13 task corrections shipped, 2 added quests
- **the SOURCE runs ahead of the build**: `src/overrides/tasks.json5` carries ~37 name fields
- newest commit 2026-08-09T20:20:38Z, "Merge pull request #258 from tarkovtracker-org/rename-test-drive"
- schemas for every override type are published in `src/schemas/`, worth following rather than inventing

## escapefromtarkov.fandom.com
- 495 pages stored for 499 distinct titles, covering 533 quest ids across all game modes (3 title(s) with no page)
- **92 recovered through the wiki's own rename history**, 1.1.0 renamed about 91 quests
  and editors are deleting the redirects, so a lookup by the name tarkov.dev publishes now misses
- 277 pages have a Requirements section, 495 an Objectives section
- **62 pages mention a Loyalty Level**, the mechanism 1.1.0 replaced the quest chain with
- `index.json` records asked-title -> resolved-page for every quest, which is the wiki's own rename map

## SPT (sp-tarkov/server), schema reference, NOT current
- 504 quests, last updated **2025-03-17**
- carries BSG's own condition shape: {"Level":217,"Quest":683,"TraderLoyalty":4,"TraderStanding":8}
- that `TraderLoyalty` type is the structure the live game uses and no public API exposes;
  the DATA is a year old, so treat this as the schema and a historical baseline

## What nobody has
- coordinates for BattlePass documents (no source carries an item record at all)
- the 1.1.0 renames as data (tarkov.dev publishes 0; only the wiki's move history has them)
- trader loyalty gates at any scale (tarkov.dev 6, overlay 0, SPT 4)

## Licensing
- wiki text is CC BY-SA (Fandom), attribution and share-alike apply to anything derived from it
- tarkov.dev and the overlay carry their own repository licences; check before redistributing
- `raw/` is a cache of other people's work, kept verbatim so provenance is never in doubt
