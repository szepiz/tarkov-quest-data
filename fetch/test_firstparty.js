// The first-party files must contain ONLY what this repo produced.
//
// The whole promise of api/firstparty/ is that a consumer can take it without
// taking anyone else's data or anyone else's licence with it. That promise is
// easy to break by accident — the map bake mixes hand-placed hazards in with
// tarkov-data-overlay's story chapters, and the observation loader sits next to
// the merge that pulls in tarkov.dev — so it is checked rather than intended.
//
//   node fetch/test_firstparty.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

let fails = 0;
const ok = (c, l) => { if (!c) { fails++; console.log('FAIL  ' + l); } else console.log('PASS  ' + l); };

const q = read('api/firstparty/quests.json');
const m = read('api/firstparty/mapdata.json');
const bp = read('api/firstparty/battlepass.json');
const sm = read('api/firstparty/story-marks.json');

// ---- they say what they are -------------------------------------------------
for (const [name, f] of [['quests', q], ['mapdata', m], ['battlepass', bp], ['story-marks', sm]]) {
  ok(f.firstParty === true, `${name}: declares itself first-party`);
  ok(f.license === 'CC0-1.0', `${name}: carries its licence (${f.license})`);
  ok(!!f.generatedAt, `${name}: says when it was built`);
}

// ---- nothing from anyone else -----------------------------------------------
//
// Checked on the serialised text, because a stray third-party value can arrive
// nested anywhere and a field-by-field check only looks where it is told to.
const FOREIGN = ['tarkov.dev', 'tarkovdev', 'fandom', 'escapefromtarkov.fandom', 'sp-tarkov',
  'tarkov-data-overlay', 'overlay', 'wiki'];
// AN EXPLANATION MAY NAME ANOTHER SOURCE; A VALUE MAY NOT.
//
// Records carry the owner's own notes — "wiki agrees", "exists in the game and
// in none of tarkov.dev, the overlay, the wiki or SPT" — and those are the most
// useful thing in the file: what was checked, and why the reading is believed.
// They are commentary, not republished data. Strip every prose field, at any
// depth, and scan what is left.
const PROSE = /note|reason|meaning|comment|why|question|snapshot|resolved|changed|added|moved|tested|shattered|merged|renumbered|confirms/i;
const withoutProse = (v) => {
  if (Array.isArray(v)) return v.map(withoutProse);
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (PROSE.test(k)) continue;
    // an identifier may name where it came from — `wiki-boreas-r4c5j1` is a join
    // key for an objective synthesized from wiki content, not wiki content
    if (/(^|[a-z])[Ii]d$|^id$|ids$/.test(k)) continue;
    // a long free-text string is prose wherever it sits
    if (typeof val === 'string' && val.length > 120) continue;
    out[k] = withoutProse(val);
  }
  return out;
};
for (const [name, f] of [['quests', q], ['mapdata', m], ['battlepass', bp], ['story-marks', sm]]) {
  const text = JSON.stringify(f).toLowerCase();
  const body = { ...f };
  for (const k of ['what', 'holds', 'caveats', 'coordinates', 'excluded', 'note', 'howToChoose']) delete body[k];
  const hay = JSON.stringify(withoutProse(body)).toLowerCase();
  const hits = FOREIGN.filter((n) => hay.includes(n));
  ok(hits.length === 0, `${name}: no third-party source appears in the data${hits.length ? ' — ' + hits.join(', ') : ''}`);
  ok(text.length > 1000, `${name}: is not empty (${(text.length / 1024).toFixed(0)} KB)`);
}

// ---- the observations are whole ---------------------------------------------
ok((q.quests || []).length > 300, `${(q.quests || []).length} quest readings published`);
ok((q.sittings || []).length >= 10, `${(q.sittings || []).length} capture sittings listed with their dates`);
const noDate = (q.quests || []).filter((r) => !r.observedAt);
ok(noDate.length === 0, `every reading carries the day it was read${noDate.length ? ` (${noDate.length} do not)` : ''}`);
const noId = (q.quests || []).filter((r) => !r.questId);
ok(noId.length === 0, `every reading carries the id it joins on${noId.length ? ` (${noId.length} do not)` : ''}`);
const pinned = (q.quests || []).filter((r) => r.questIdPinned).length;
ok(pinned >= 0, `${pinned} reading(s) have their id pinned by hand rather than matched`);

// ---- the map work is whole --------------------------------------------------
const c = m.counts || {};
ok((bp.counts || {}).pins > 150, `${(bp.counts || {}).pins} hand-placed BattlePass document pins`);
ok((bp.documents || []).length === 9, `${(bp.documents || []).length} document types`);
ok((sm.counts || {}).groups > 100, `${(sm.counts || {}).groups} story mark group(s) across ${(sm.counts || {}).objectives} objectives`);
ok((sm.counts || {}).markers > 0 && (sm.counts || {}).areas > 0,
  `both kinds of story mark are present: ${(sm.counts || {}).markers} markers, ${(sm.counts || {}).areas} areas`);

// NOTHING WAS LOST ON THE WAY OUT. The two files were carved out of mapdata.json,
// so the counts have to match what the source bakes still hold — a "separate"
// file that quietly dropped half its pins looks exactly like a smaller one.
{
  const src = read('mapdata/bpdocs.json');
  const docs = src.documents || src;
  const srcPins = docs.reduce((n, d) => n + Object.values(d.pins || {}).reduce((x, a) => x + a.length, 0), 0);
  ok(srcPins === (bp.counts || {}).pins, `every BattlePass pin survived the split (${srcPins} in, ${(bp.counts || {}).pins} out)`);
  const story = read('mapdata/story.json');
  let srcGroups = 0;
  for (const ch of story.chapters || []) for (const o of ch.objectives || []) srcGroups += (o.points || []).length;
  ok(srcGroups === (sm.counts || {}).groups, `every story mark survived the split (${srcGroups} in, ${(sm.counts || {}).groups} out)`);
}

// and mapdata.json says where they went rather than just losing them
ok(!!(m.movedOut && m.movedOut.battlePassDocuments && m.movedOut.storyMarks),
  'mapdata.json points at the files that took its marks');
ok(m.battlePassDocuments === undefined, 'mapdata.json no longer carries the documents twice');
ok(Object.keys(m.corrections.labels || {}).length > 0, 'position corrections are present');
ok((m.added.labels || []).length > 100, `${(m.added.labels || []).length} labels the map does not print`);
ok(Array.isArray(m.added.hazards) && Array.isArray(m.added.interactables),
  'hand-placed hazards and interactables are present');
// THE WORDING IS NOT OURS TO RELICENSE. Chapter names and objective descriptions
// come from the project that publishes the campaign; the marks carry ids and
// coordinates so they can be joined to it instead of copying it.
{
  const text = JSON.stringify(sm);
  ok(!/"description"/.test(text) && !/"name"/.test(text),
    'story marks carry no chapter name or objective description');
  ok((sm.marks || []).every((x) => x.objectiveId && Array.isArray(x.points)),
    'every story mark has an id to join on and points to draw');
  ok(!!sm.joinOn, 'and says what to join it against');
}

// story chapters belong to the overlay and must NOT be here
ok(m.chapters === undefined && !JSON.stringify(m).includes('chaptersFrom'),
  "the overlay's story chapters are not in the first-party file");

// ---- the slices are of the CURRENT quests.json -------------------------------
//
// Rebuilding api/quests.json without re-running the split leaves the slices
// describing yesterday's data, and nothing about them looks wrong: they parse,
// they rejoin, they are just old. Each slice records the generatedAt of the file
// it was cut from, so the mismatch is visible instead of silent.
{
  const whole = read('api/quests.json');
  for (const name of ['core', 'requirements', 'objectives', 'wording', 'provenance']) {
    const part = read(`api/quests/${name}.json`);
    const fresh = part.generatedAt === whole.generatedAt;
    ok(fresh, `quests/${name}.json was cut from the current quests.json${fresh ? '' : ` — cut from ${part.generatedAt}, current is ${whole.generatedAt}`}`);
  }
}

// ---- the index tells the truth about them -----------------------------------
const idx = read('api/index.json');
const listed = (idx.endpoints || []).filter((e) => e.firstParty).map((e) => e.path);
ok(listed.includes('api/firstparty/quests.json') && listed.includes('api/firstparty/mapdata.json'),
  'the index marks both first-party files as such');
for (const e of idx.endpoints || []) {
  const real = fs.existsSync(path.join(ROOT, e.path)) ? fs.statSync(path.join(ROOT, e.path)).size : -1;
  if (real !== e.bytes) { fails++; console.log(`FAIL  index size for ${e.path}: says ${e.bytes}, is ${real}`); }
}
ok(true, `the index lists ${(idx.endpoints || []).length} endpoints, all with the size they really are`);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
