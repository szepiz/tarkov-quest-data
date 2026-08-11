// Builds api/maps.json, the map half of the published data.
//
// It is a SECOND file rather than more of quests.json on purpose. Most of this
// is geometry, and a consumer who wants quest names and objectives should not
// have to download a few hundred KB of pins to get them. The two files are
// joined by quest id and by map name, both of which are stable.
//
// Almost everything here is FIRST-PARTY and exists nowhere else. tarkov.dev
// publishes zone coordinates for objectives (those stay in quests.json) but
// nobody publishes a position for a BattlePass document, a corrected label, or
// the 87 map texts and 219 added labels that were placed by hand. That is the
// point of this file.
//
// Dating follows the same rule as quests.json: a value carries the date it was
// last known to be true, and a source that cannot date itself says so.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'mapdata');
const OUT = path.join(ROOT, 'api');

if (!fs.existsSync(SRC)) {
  console.error(`\nmapdata/ is missing, so there is nothing to build.\n`);
  process.exit(1);
}
const J = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
const placed = J('placed.json');
const bp = J('bpdocs.json');
const story = J('story.json');

const day = (t) => (t ? String(t).slice(0, 10) : null);
const n = (v) => (Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0));

// The editor writes its correction keys as "<map>|<label>|<x>|<z>". Splitting
// them out means a consumer never has to parse our key format to find the map a
// correction belongs to.
const splitKey = (k) => {
  const parts = String(k).split('|');
  return parts.length >= 4
    ? { map: parts[0], label: parts.slice(1, -2).join('|'), fromX: Number(parts[parts.length - 2]), fromZ: Number(parts[parts.length - 1]) }
    : { map: null, label: String(k) };
};
const asMoves = (obj) => Object.entries(obj || {}).map(([k, v]) => ({ ...splitKey(k), to: v }));

const bakedAt = day(placed.bakedAt) || day(story.bakedAt);
const FIRST_PARTY = { src: 'placed by hand', asOf: bakedAt, dating: 'exact' };

// Corrections: something published in the wrong place, moved to the right one.
const corrections = {
  labels: asMoves(placed.labels),
  extracts: asMoves(placed.extracts),
  objectives: asMoves(placed.objectives),
  transits: asMoves(placed.transits),
  switches: asMoves(placed.switches),
  floors: {
    objectives: placed.objectiveFloors || {},
    extracts: placed.extractFloors || {},
    labels: placed.labelFloors || {},
    transits: placed.transitFloors || {},
    switches: placed.switchFloors || {},
  },
  // Things a source publishes that are not really there, or are duplicates.
  hidden: Object.keys(placed.hidden || {}),
};

// Additions: things NO source publishes at all. The most valuable part.
const additions = {
  labels: placed.newLabels || [],
  mapTexts: placed.mapTexts || [],
  extracts: placed.newExtracts || [],
  interactables: story.interactables || [],
  hazards: story.hazards || [],
};

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  what: 'Map-side data for Escape from Tarkov: hand-placed corrections and additions, '
    + 'BattlePass document locations, and the story campaign.',
  pairsWith: 'api/quests.json, joined by quest id and by map name.',

  mergeContract: {
    rule: 'Compare dates per section, not per file. Keep whichever value is newer.',
    firstParty: 'Everything marked `placed by hand` was positioned in a map editor by a player '
      + 'against the game itself. No published source carries any of it, so there is usually '
      + 'nothing to merge it against.',
    coordinates: 'Game units, in tarkov.dev\'s coordinate space, so a position here can be compared '
      + 'with an objective zone in quests.json directly. `floor` is -1 on a map with no floors.',
  },

  sources: {
    placed: {
      what: 'Positions placed by hand in the tracker\'s map editor, checked against the game.',
      dating: 'exact', datingNote: 'The day the data was last baked.',
      asOf: bakedAt, license: 'CC0-1.0',
    },
    overlay: {
      what: 'tarkov-data-overlay (tarkovtracker-org), the source of the story chapter list.',
      dating: 'snapshot', asOf: day(story.bakedAt),
      note: 'Chapters only. Their locations, and every hazard and interactable, are hand-placed.',
    },
  },

  counts: {
    correctedPositions: corrections.labels.length + corrections.extracts.length
      + corrections.objectives.length + corrections.transits.length + corrections.switches.length,
    hiddenMarkers: corrections.hidden.length,
    addedLabels: additions.labels.length,
    mapTexts: additions.mapTexts.length,
    addedExtracts: additions.extracts.length,
    interactables: additions.interactables.length,
    hazards: additions.hazards.length,
    bpDocuments: n(bp.documents),
    bpPins: (bp.documents || []).reduce((t, d) => t + Object.values(d.pins || {}).reduce((s, a) => s + a.length, 0), 0),
    storyChapters: n(story.chapters),
  },

  corrections: { ...corrections, provenance: FIRST_PARTY },
  additions: { ...additions, provenance: FIRST_PARTY },

  // BattlePass documents. The game says which maps each is found on; the pins
  // are ours, because no source publishes a position for any of them.
  battlePassDocuments: {
    season: 'Season 1, KORD BREACH',
    documents: bp.documents || [],
    provenance: { spots: { src: 'in game', asOf: bakedAt, dating: 'exact' }, pins: FIRST_PARTY },
  },

  story: {
    chapters: story.chapters || [],
    provenance: { src: 'tarkov-data-overlay', asOf: day(story.bakedAt), dating: 'snapshot' },
  },
};

// Refuse to publish a file that claims work it does not contain. The additions
// are the whole reason this file exists, so an empty one is a failure and not a
// result, the same rule the fetchers already follow.
if (!payload.counts.addedLabels && !payload.counts.mapTexts && !payload.counts.bpPins) {
  console.error('REFUSING TO WRITE: no hand-placed data found, which means mapdata/ did not load.');
  process.exit(1);
}
if (!bakedAt) {
  console.error('REFUSING TO WRITE: hand-placed data with no date on it cannot be merged by anyone.');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, 'maps.json');
fs.writeFileSync(file, JSON.stringify(payload, null, 1) + '\n', 'utf8');
console.log(`api/maps.json, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
for (const [k, v] of Object.entries(payload.counts)) console.log(`   ${k.padEnd(20)} ${v}`);
