# mapdata/

The second folder of first-party data, alongside `observed/`. Where `observed/`
is quests read off the in-game screen, this is **positions placed by hand on a
map**, checked against the game.

It builds into [`api/maps.json`](../api/maps.json):

```sh
node fetch/build_maps.js
```

## Why it exists

tarkov.dev publishes zone coordinates for quest objectives, and those stay in
`api/quests.json`. Nobody publishes a position for:

- a **BattlePass document**, 92 pins across 9 document types
- a **room number or a landmark name** the map does not print, 219 added labels
  and 87 map texts
- a **hazard area**, a **hand-placed interactable**, or an extract a source has
  forgotten

And where a source does publish a position, it is often wrong by enough to send
a player to the wrong door. 132 of those are corrected here, and 39 markers are
hidden because they are duplicates or are not really there.

## What is in it

| file | holds |
|---|---|
| `placed.json` | corrected positions, floor overrides, hidden markers, added labels, map texts, added extracts |
| `bpdocs.json` | BattlePass document types, the maps each is found on, and the hand-placed pins |
| `story.json` | story campaign chapters (from tarkov-data-overlay), plus hand-placed hazards and interactables |

Coordinates are game units in tarkov.dev's coordinate space, so a position here
can be compared with an objective zone in `api/quests.json` directly. `floor` is
`-1` on a map that has no floors.

Correction keys are written `"<map>|<label>|<x>|<z>"`, which is the editor's own
format. `build_maps.js` splits them into `{ map, label, fromX, fromZ, to }` so a
consumer never has to parse that.

## Where it comes from, and the seam in it

These files are **baked output copied out of the tracker that produced them**
(`szepiz/tarkov-questing-companion`), where the map editor and its generators
live. The editor's working file is not here.

That used to leave a real seam — re-baking in the tracker did not update this
folder, and copying by hand is what let it drift. It is a script now, run from
the tracker:

    node _dev/export_mapdata.js            write here
    node _dev/export_mapdata.js --check    report differences, write nothing

It reads the BAKED files rather than the editor's working file, so what ships in
the app and what ships in the API come from one source and a bake that was never
run cannot be exported by accident. It refuses to write if the tracker's
correction categories grow one it does not know, because silently dropping a
whole category is the failure worth guarding against.

Then rebuild: `node fetch/build_maps.js`. The `bakedAt` date in each file still
says how old the bake is.

## Licensing

`placed.json` and the pins in `bpdocs.json` are first-party work: **CC0-1.0**.

`story.json`'s chapter list comes from tarkov-data-overlay and carries that
project's terms; the hazards and interactables in the same file are ours.
