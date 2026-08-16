// Cuts the published data into parts a consumer can take one at a time, and
// publishes the FIRST-PARTY data — the things nobody else has — on its own.
//
//   node fetch/build_slices.js
//
// WHY. api/quests.json is one 1.5 MB file and 54% of it is objective structures.
// Someone who wants nothing but the loyalty gates was downloading all of it, and
// someone who wants only the readings taken off the game screen had no way to
// ask for those alone — they were mixed in with tarkov.dev's and the wiki's
// values, distinguishable only by reading `provenance` field by field.
//
// TWO KINDS OF SPLIT, and they are not the same thing:
//
//   api/quests/*.json      the SAME data, cut by subject. Rejoin them on `id`
//                          and you have api/quests.json back, exactly — which
//                          this script checks on every build rather than
//                          claiming.
//   api/firstparty/*.json  only what this repo produced: quests read off the
//                          owner's own game screen, and positions placed by
//                          hand on a map. No tarkov.dev, no wiki, no SPT. It is
//                          the half of this repo that does not exist anywhere
//                          else, and it is CC0.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'api');
const { loadObserved } = require('./observed_lib.js');

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const full = read(path.join(OUT, 'quests.json'));
const TODAY = new Date().toISOString().slice(0, 10);

// ---- how the quest record is cut --------------------------------------------
//
// Every field lands in exactly one slice. A field nobody assigned is a build
// failure, not a field quietly dropped from the split — that is how a consumer
// ends up with a slice that silently stopped carrying something.
const SLICES = {
  core: ['id', 'name', 'trader', 'map', 'modes', 'faction', 'traderTab', 'kappaRequired',
    'lightkeeperRequired', 'restartable', 'confirmedInGame', 'removedFromGame', 'removedSaysWiki',
    'sameQuestAs', 'wikiLink', 'asOf', 'modeOverrides'],
  requirements: ['id', 'minPlayerLevel', 'requires', 'requiresAnyOf', 'traderRequirements',
    'failedBy', 'loyalty', 'onlyAfterFailure'],
  objectives: ['id', 'objectives', 'objectiveMaps'],
  wording: ['id', 'objectiveText', 'objectiveTextById', 'objectivesGone'],
  provenance: ['id', 'provenance'],
};
const HOLDS = {
  core: 'what the quest IS: name, trader, map, mode, the loyalty tab it sits under, and the flags',
  requirements: 'what has to be true before you can take it: player level, prerequisite quests, trader loyalty and reputation',
  objectives: "tarkov.dev's structured objectives, with their ids, zones and coordinates — the big one",
  wording: "the game's own objective wording, keyed by objective id where it could be matched",
  provenance: 'which source each field came from and the date it was last known true',
};

{
  const assigned = new Set(Object.values(SLICES).flat());
  const seen = new Set();
  for (const q of full.quests) for (const k of Object.keys(q)) seen.add(k);
  const orphan = [...seen].filter((k) => !assigned.has(k));
  if (orphan.length) {
    console.error(`REFUSING TO WRITE: ${orphan.length} field(s) belong to no slice: ${orphan.join(', ')}`);
    console.error('Add them to SLICES above — a field with no home vanishes from the split.');
    process.exit(1);
  }
}

const meta = (name, holds, extra = {}) => ({
  what: `Part of ${full.game || 'Escape from Tarkov'} quest data from ${'https://github.com/szepiz/tarkov-quest-data'}`,
  holds,
  schemaVersion: full.schemaVersion,
  generatedAt: full.generatedAt,
  rejoinOn: 'id',
  whole: 'api/quests.json',
  ...extra,
});

fs.mkdirSync(path.join(OUT, 'quests'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'firstparty'), { recursive: true });

const written = [];
const note = (p, holds, firstParty) => {
  const bytes = fs.statSync(path.join(ROOT, p)).size;
  written.push({ path: p, bytes, holds, firstParty: !!firstParty });
  console.log(`  ${p.padEnd(34)} ${(bytes / 1024).toFixed(0).padStart(5)} KB   ${holds.slice(0, 52)}`);
};

for (const [name, fields] of Object.entries(SLICES)) {
  const quests = full.quests.map((q) => {
    const out = {};
    for (const f of fields) if (q[f] !== undefined) out[f] = q[f];
    return out;
  });
  const p = `api/quests/${name}.json`;
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({ ...meta(name, HOLDS[name]), quests }, null, 1) + '\n', 'utf8');
  note(p, HOLDS[name]);
}

// ---- the check that makes the split safe to rely on -------------------------
//
// Rejoin what was just written and compare it to the file it came from. Anything
// that failed to round-trip — a field in two slices, a field in none, an
// ordering difference — shows up here rather than in someone's app.
{
  const rejoined = new Map();
  for (const name of Object.keys(SLICES)) {
    const part = read(path.join(OUT, 'quests', `${name}.json`));
    for (const q of part.quests) {
      const acc = rejoined.get(q.id) || {};
      Object.assign(acc, q);
      rejoined.set(q.id, acc);
    }
  }
  let bad = 0;
  for (const q of full.quests) {
    const back = rejoined.get(q.id);
    // key order differs between slices, so compare on sorted keys
    const norm = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
    if (!back || norm(back) !== norm(q)) {
      if (bad < 3) console.error(`   !! ${q.name} does not round-trip`);
      bad++;
    }
  }
  if (bad) {
    console.error(`REFUSING TO WRITE: ${bad} quest(s) do not rejoin into what they were cut from`);
    process.exit(1);
  }
  console.log(`  rejoin check: all ${full.quests.length} quests reassemble exactly`);
}

// ---- first party: the quests read off the owner's own screen ----------------
{
  const obs = loadObserved(ROOT);
  const records = [...obs.byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const docs = obs.docs || [];
  const p = 'api/firstparty/quests.json';
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({
    what: 'Quests as they appeared on the trader screen in game, transcribed from screenshots.',
    firstParty: true,
    license: 'CC0-1.0',
    readBy: 'szepiz',
    generatedAt: TODAY,
    holds: 'The one thing in this repo that is not a copy of someone else\'s work. Each record is a '
      + 'card the owner actually saw: the trader, the loyalty tab it sat under, the objective lines '
      + 'as the game wrote them, and the day it was read. Nothing here is inferred.',
    caveats: [
      'The game reveals objectives progressively, so an unfinished quest shows fewer lines than it has. '
        + '`objectivesComplete` says whether the list is the whole list.',
      '`questId` is tarkov.dev\'s id, matched by name and content. `questIdPinned` means it was set by '
        + 'hand instead, because 1.1.0 renumbered lines and names alone pair the wrong records.',
      '`lineSuspect` marks a record whose quest line was renumbered, where a name match may be wrong.',
      'Captured on a PvE profile; `mode` says so per record.',
    ],
    counts: { records: records.length, traders: new Set(records.map((r) => r.trader)).size },
    sittings: docs.map((d) => ({
      trader: d.trader, observedAt: d.observedAt, gameVersion: d.gameVersion,
      allVisibleCaptured: d.allVisibleCaptured, quests: (d.quests || []).length,
    })),
    unmatched: obs.unmatched || [],
    quests: records,
  }, null, 1) + '\n', 'utf8');
  note(p, 'quests read off the game screen, nothing inferred', true);
}

// ---- first party: positions placed by hand ---------------------------------
{
  const placed = read(path.join(ROOT, 'mapdata', 'placed.json'));
  const bpdocs = read(path.join(ROOT, 'mapdata', 'bpdocs.json'));
  const story = read(path.join(ROOT, 'mapdata', 'story.json'));
  const pins = (bpdocs.documents || []).reduce((n, d) =>
    n + Object.values(d.pins || {}).reduce((m, a) => m + a.length, 0), 0);
  const p = 'api/firstparty/mapdata.json';
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({
    what: 'Positions placed by hand on a map and checked against the game.',
    firstParty: true,
    license: 'CC0-1.0',
    placedBy: placed.placedBy || 'szepiz',
    generatedAt: TODAY,
    holds: 'Coordinates nobody else publishes: BattlePass document spots, room numbers and landmark '
      + 'names the map does not print, hazards, interactables, extracts a source forgot — plus '
      + 'corrections to positions that are published but wrong.',
    coordinates: placed.note,
    // story CHAPTERS are tarkov-data-overlay's and stay out of a first-party
    // file; the hazards and interactables in that same bake are hand-placed.
    excluded: 'Story chapters are third-party (tarkov-data-overlay) and are in api/maps.json, not here.',
    counts: {
      ...(placed.counts || {}),
      battlePassPins: pins,
      hazards: (story.hazards || []).length,
      interactables: (story.interactables || []).length,
    },
    corrections: {
      labels: placed.labels, extracts: placed.extracts, objectives: placed.objectives,
      transits: placed.transits, switches: placed.switches,
    },
    floors: {
      objectives: placed.objectiveFloors, extracts: placed.extractFloors, labels: placed.labelFloors,
      transits: placed.transitFloors, switches: placed.switchFloors,
    },
    hidden: placed.hidden,
    added: {
      labels: placed.newLabels, mapTexts: placed.mapTexts, extracts: placed.newExtracts,
      hazards: story.hazards || [], interactables: story.interactables || [],
    },
    extractDetail: { factions: placed.extractFactions, notes: placed.extractNotes, switches: placed.extractSwitches },
    // BattlePass documents and story marks were here. They are the two kinds of
    // mark someone is most likely to want on their own — nobody else publishes a
    // position for either — so each has its own file now.
    movedOut: {
      battlePassDocuments: 'api/firstparty/battlepass.json',
      storyMarks: 'api/firstparty/story-marks.json',
    },
  }, null, 1) + '\n', 'utf8');
  note(p, 'corrections, labels, map text, hazards, interactables', true);
}

// ---- first party: where the BattlePass documents are ------------------------
{
  const bpdocs = read(path.join(ROOT, 'mapdata', 'bpdocs.json'));
  const documents = bpdocs.documents || bpdocs;
  const pins = documents.reduce((n, d) =>
    n + Object.values(d.pins || {}).reduce((m, a) => m + a.length, 0), 0);
  const maps = new Set();
  for (const d of documents) for (const m of Object.keys(d.pins || {})) maps.add(m);
  const p = 'api/firstparty/battlepass.json';
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({
    what: 'Where BattlePass documents are found, placed by hand on the map.',
    firstParty: true,
    license: 'CC0-1.0',
    placedBy: 'szepiz',
    generatedAt: TODAY,
    holds: 'The documents exist as items, and no source publishes a position for a single one of '
      + 'them. Each type lists the maps it is found on, and every pin under it was placed in the map '
      + 'editor and checked in game.',
    caveats: [
      'A pin is a place a document HAS been found, not a guaranteed spawn.',
      'Coordinates are game units in the same space the map data uses; `floor` is -1 on a map with no floors.',
      '`spots` names the described location a pin belongs to where one is known, and is null otherwise.',
    ],
    counts: { documents: documents.length, pins, maps: maps.size },
    documents,
  }, null, 1) + '\n', 'utf8');
  note(p, 'BattlePass document spots, placed by hand', true);
}

// ---- first party: the story marks -------------------------------------------
{
  const story = read(path.join(ROOT, 'mapdata', 'story.json'));
  const marks = [];
  let groups = 0, pinCount = 0, areaCount = 0;
  for (const c of story.chapters || []) {
    for (const o of c.objectives || []) {
      if (!(o.points || []).length) continue;
      groups += o.points.length;
      for (const g of o.points) ((g.pts || []).length > 1 ? areaCount++ : pinCount++);
      marks.push({
        objectiveId: o.id,
        chapterId: c.id,
        sourceQuestId: o.sourceQuestId || null,
        maps: o.maps || [],
        points: o.points,
      });
    }
  }
  const p = 'api/firstparty/story-marks.json';
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({
    what: 'Where story campaign objectives happen, placed by hand on the map.',
    firstParty: true,
    license: 'CC0-1.0',
    placedBy: 'szepiz',
    generatedAt: TODAY,
    holds: 'The story campaign is published without a single coordinate anywhere. Every position here '
      + 'was placed in the map editor and checked in game.',
    joinOn: 'objectiveId, against story.chapters[].objectives[].id in api/maps.json',
    caveats: [
      'IDS AND COORDINATES ONLY. The chapter names and objective descriptions belong to the project '
        + 'that publishes the campaign, so they are not republished here under a licence that is not '
        + 'theirs to give. Join on objectiveId for the wording.',
      'A group holding one point is a marker; a group holding several is an area, and the points are '
        + 'its outline.',
      '`floor` is the storey chosen at placement, not derived from a height.',
    ],
    counts: { objectives: marks.length, groups, markers: pinCount, areas: areaCount },
    marks,
  }, null, 1) + '\n', 'utf8');
  note(p, 'story objective positions, placed by hand', true);
}

// ---- the index, so a consumer can see what exists without guessing ---------
{
  const stat = (p) => fs.statSync(path.join(ROOT, p)).size;
  const endpoints = [
    { path: 'api/quests.json', bytes: stat('api/quests.json'),
      holds: 'every quest field in one file, merged from every source, with per-field provenance',
      firstParty: false },
    { path: 'api/maps.json', bytes: stat('api/maps.json'),
      holds: 'the map side: features, extracts, hazards and hand-placed corrections applied',
      firstParty: false },
    ...written,
  ];
  const p = 'api/index.json';
  fs.writeFileSync(path.join(ROOT, p), JSON.stringify({
    what: 'Every file this repo publishes, so a consumer can take only what it needs.',
    generatedAt: TODAY,
    base: 'https://szepiz.github.io/tarkov-quest-data/',
    alternateBase: 'https://raw.githubusercontent.com/szepiz/tarkov-quest-data/main/',
    howToChoose: [
      'api/quests.json is everything. The files under api/quests/ are the same data cut by subject — '
        + 'take one, or several, and rejoin them on `id`. Do not take both the whole file and a slice.',
      'api/firstparty/ is the only data this repo produced rather than collected. It is CC0 and it '
        + 'exists nowhere else. If you want just that, take just that.',
      'Everything else carries the licence of whoever published it — see the repo README.',
    ],
    endpoints,
  }, null, 1) + '\n', 'utf8');
  console.log(`  ${p.padEnd(34)} ${(stat(p) / 1024).toFixed(0).padStart(5)} KB   the list of everything above`);
}

const firstPartyBytes = written.filter((w) => w.firstParty).reduce((n, w) => n + w.bytes, 0);
console.log(`\nfirst-party data published on its own: ${(firstPartyBytes / 1024).toFixed(0)} KB`);
