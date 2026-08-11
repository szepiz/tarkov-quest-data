// Builds view/index.html, every quest, with what each source says side by
// side. Reads raw/ only. Nothing is merged or corrected; where the sources
// disagree the viewer shows the disagreement rather than picking a winner,
// because picking is the NEXT step and this one is the evidence.
//
// GAME MODE is a dimension of the data, not a build-time choice. tarkov.dev
// publishes three task lists, regular (PvP), pve, pvp-season (seasonal), and
// they do NOT hold the same quests. Rows are the UNION of all three; each row
// records which modes contain it, and per-field values are stored per mode only
// where the modes actually disagree. That keeps the file small and, more to the
// point, makes "do the modes differ?" a thing you can read off the page instead
// of a thing you have to take on trust.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));

const MODES = ['regular', 'pve', 'pvp-season'];
const MODE_LABEL = { regular: 'PvP', pve: 'PvE', 'pvp-season': 'Seasonal' };

const wikiIdx = J('wiki/index.json');
const spt = J('spt/quests.json');
const ov = J('overlay/dist.overlay.json');

// In-game records. Not a fifth source to weigh against the other four, it is
// what they are all describing, so the viewer shows it above them, not beside.
const { loadObserved } = require('./observed_lib.js');
require('./raw_ready.js')(ROOT);
const observed = loadObserved(ROOT);

// THE RAW PAYLOAD IS NOT THE SHAPE A CLIENT ADAPTS IT INTO. `map`, `trader`
// and `objectives[].maps` are bare ids, not `{name}` objects, and the locale
// files key them by "<id> <Field>", "<id> Name" for a map, "<id> Nickname" for
// a trader, "<id> name" for a task. Assuming the adapted shape silently yields
// null for every map and trader, which reads as "no source knows" rather than
// as a bug in the reader.
//
// Every one of those lookups is PER MODE: each mode ships its own locale file.
// "Night Factory" and "Ground Zero 21+" are the same physical map as their
// daytime / sub-21 twin. Collapsing them is not an opinion about the data, it
// is the difference between a real disagreement and a naming variant, without
// it every Factory quest reads as a conflict between the source and itself.
const MAP_VARIANT = (n) => (n === 'Night Factory' ? 'Factory' : String(n || '').replace(/\s*21\+\s*$/, ''));

function loadMode(mode) {
  const td = J(`tarkovdev/${mode}.tasks.json`);
  const en = (J(`tarkovdev/${mode}.tasks_en.json`) || {}).data || {};
  const mapsEn = (J(`tarkovdev/${mode}.maps_en.json`) || {}).data || {};
  const tradersEn = (J(`tarkovdev/${mode}.traders_en.json`) || {}).data || {};
  // Trimmed, because the locale data is not clean: pve serves
  // "Arena Business\n" where regular serves "Arena Business". Untrimmed, the
  // same quest reads as two different names across modes and as renamed against
  // its own wiki page. Whitespace is parsing, not a correction, raw/ keeps the
  // newline exactly as served.
  const L = (v) => {
    const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v;
    return typeof r === 'string' ? r.trim() : r;
  };
  const MAPN = (id) => (typeof id === 'string' && mapsEn[`${id} Name`] ? MAP_VARIANT(mapsEn[`${id} Name`]) : null);
  const TRADERN = (id) => (typeof id === 'string' ? (tradersEn[`${id} Nickname`] || '').trim() || null : null);

  const tasks = (td.data && td.data.tasks) || {};
  // Same trap again: `taskRequirements[].task` is a bare ID STRING, so
  // `r.task.name` is undefined and every prerequisite renders as "?", on 485
  // of 510 quests, which looks like tarkov.dev publishing nothing rather than a
  // reader looking in the wrong place. Names come from the mode's own table.
  const nameOfId = (qid) => (tasks[qid] ? L(tasks[qid].name) : null);

  const out = new Map();
  for (const [id, t] of Object.entries(tasks)) {
    out.set(id, {
      name: L(t.name),
      trader: TRADERN(t.trader),
      // Ragman publishes Drip-Out and Textile once per PMC faction under the SAME
      // name, identical in every field but the id. Without this the viewer shows
      // each of them twice with nothing to tell them apart.
      faction: t.factionName && t.factionName !== 'Any' ? t.factionName : null,
      map: MAPN(t.map),
      objMaps: [...new Set((t.objectives || []).flatMap((o) => (o.maps || []).map(MAPN).filter(Boolean)))],
      level: t.minPlayerLevel || null,
      loyalty: (t.traderRequirements || []).filter((r) => r.requirementType === 'level')
        .map((r) => `${TRADERN(r.trader) || '?'} LL${r.value}`),
      // `status` matters as much as the name, and 58 of 607 edges are not a
      // plain "complete": 23 are "active or complete" (accepting it is enough),
      // 19 "complete or failed" (either outcome), 11 "active" (it must be IN
      // PROGRESS, so completing it BREAKS the requirement), 4 "failed", 1 any of
      // the three. Read as a chain, those 58 gate the wrong way round. Shown
      // whenever it is not a plain "complete".
      chain: (t.taskRequirements || []).map((r) => {
        const nm = nameOfId(r.task) || `unknown quest ${r.task}`;
        const st = (r.status || []).slice().sort();
        return st.length && !(st.length === 1 && st[0] === 'complete') ? `${nm} (${st.join(' or ')})` : nm;
      }),
      objectives: (t.objectives || []).map((o) => L(o.description)),
    });
  }
  return { rows: out, mapsEn, tradersEn };
}

const M = {};
for (const mode of MODES) M[mode] = loadMode(mode);

// map names longest first: 'The Lab' is a prefix of 'The Labyrinth'
const MAP_NAMES = [...new Set(MODES.flatMap((m) => Object.entries(M[m].mapsEn)
  .filter(([k]) => / Name$/.test(k)).map(([, v]) => MAP_VARIANT(v))))]
  .filter(Boolean).sort((a, b) => b.length - a.length);
const tradersEnAll = Object.assign({}, ...MODES.map((m) => M[m].tradersEn));
const TRADERN_ANY = (id) => (typeof id === 'string' ? (tradersEnAll[`${id} Nickname`] || null) : null);

// ---- wiki page -> the bits worth comparing
const wikiPage = (title) => {
  const f = path.join(RAW, 'wiki', 'pages', String(title).replace(/[^\w.-]+/g, '_') + '.txt');
  try { return fs.readFileSync(f, 'utf8'); } catch { return null; }
};
const strip = (s) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/\{\{[^}]*\}\}/g, '').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// SUB-BULLETS COUNT. The wiki writes optional objectives as second-level
// bullets ("** (''Optional'') …"). Filtering to /^\*[^*]/ silently drops them,
// which then presents as the wiki disagreeing on objective count when it agrees
// exactly, the game prints those same lines with an (Optional) prefix.
const section = (w, name) => {
  const m = new RegExp(`==\\s*${name}\\s*==\\s*\\n([\\s\\S]*?)(?:\\n==[^=]|$)`).exec(w || '');
  if (!m) return null;
  return m[1].split('\n').map((l) => l.trim()).filter((l) => /^\*+\s*\S/.test(l)).map((l) => strip(l.replace(/^\*+\s*/, '')));
};

const byQuest = wikiIdx.quests.reduce((a, q) => (a[q.id] = q, a), {});

// ---- who to believe when the sources disagree
//
// The rule, settled 2026-08-11: a first-party in-game observation first, and
// failing that, whichever source was updated most recently.
//
// Only half of that is directly measurable. The wiki gives a real per-page
// last-edit date; tarkov.dev publishes NO date for a task, so "most recent" can
// never be a straight comparison of two numbers. What stands in for it is
// evidence: 527 of the wiki's 529 dated quest pages were edited on or after
// 1.1.0 (2026-08-03), while tarkov.dev still publishes the PRE-1.1.0 name for
// about 91 quests, which proves, per quest, that its record predates the patch.
// So the rule lands as: the wiki wins unless its page has gone untouched since
// the patch, and a name mismatch is tarkov.dev's own admission of staleness.
const PATCH_1_1_0 = '2026-08-03';
const verdictFor = (q, w, devName) => {
  const edited = (q && q.edited) || null;
  const fresh = !!edited && edited.slice(0, 10) >= PATCH_1_1_0;
  const removed = /\{\{\s*Historical content/i.test(w || '');
  // tarkov.dev still calling it by a name the wiki has moved on from dates its record
  const devStale = !!(devName && q && q.page && devName !== q.page);
  if (removed) {
    return { by: 'wiki', removed: true, edited, devStale,
      why: 'The wiki banners this page {{Historical content}}, the quest was removed. tarkov.dev still publishes it.' };
  }
  if (!w) {
    return { by: 'tarkov.dev', removed: false, edited, devStale,
      why: 'No wiki page for this quest, so there is nothing to weigh tarkov.dev against.' };
  }
  if (fresh) {
    return { by: 'wiki', removed: false, edited, devStale,
      why: `Wiki page last edited ${edited.slice(0, 10)}, after patch 1.1.0`
        + (devStale ? `, and tarkov.dev still calls it "${devName}", its record predates the rename.` : '.') };
  }
  return { by: 'unsettled', removed: false, edited, devStale,
    why: edited
      ? `Wiki page has not been touched since ${edited.slice(0, 10)}, before patch 1.1.0, and tarkov.dev publishes no date at all.`
      : 'Neither source carries a date for this quest.' };
};
const DEV_FIELDS = ['name', 'trader', 'map', 'objMaps', 'level', 'loyalty', 'chain', 'objectives'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const allIds = [...new Set(MODES.flatMap((m) => [...M[m].rows.keys()]))];
const rows = [];
for (const id of allIds) {
  const modes = MODES.filter((m) => M[m].rows.has(id));
  const base = M[modes[0]].rows.get(id);

  // per-field overrides, recorded only where a mode genuinely says something else
  const devByMode = {};
  const modeDiff = [];
  for (const f of DEV_FIELDS) {
    if (modes.slice(1).every((m) => same(M[m].rows.get(id)[f], base[f]))) continue;
    modeDiff.push(f);
    for (const m of modes.slice(1)) {
      const v = M[m].rows.get(id)[f];
      if (!same(v, base[f])) (devByMode[m] = devByMode[m] || {})[f] = v;
    }
  }

  const q = byQuest[id] || {};
  const w = q.page ? wikiPage(q.page) : null;
  const wReq = section(w, 'Requirements');
  const wObj = section(w, 'Objectives');
  const s = spt[id];

  const loySpt = s ? (((s.conditions || {}).AvailableForStart) || [])
    .filter((c) => c.conditionType === 'TraderLoyalty')
    .map((c) => `${tradersEnAll[c.target] || c.target} LL${c.value}`) : [];
  const lvlSpt = s ? (((s.conditions || {}).AvailableForStart) || [])
    .filter((c) => c.conditionType === 'Level').map((c) => c.value) : [];

  rows.push({
    id,
    modes,
    dev: base,
    devByMode: Object.keys(devByMode).length ? devByMode : null,
    modeDiff: modeDiff.length ? modeDiff : null,
    name: { spt: s ? s.QuestName : null, wiki: q.page || null,
      ovr: (ov.tasks && ov.tasks[id] && ov.tasks[id].name) || null },
    trader: { spt: s ? (TRADERN_ANY(s.traderId) || s.traderId) : null },
    map: { wiki: [...new Set((wObj || []).flatMap((l) => MAP_NAMES.filter((m) => l.includes(m))))] },
    level: { spt: lvlSpt[0] ?? null, wiki: (wReq || []).filter((l) => /must be level/i.test(l)) },
    loyalty: { spt: loySpt, wiki: (wReq || []).filter((l) => /loyalty level/i.test(l)) },
    chain: { spt: s ? (((s.conditions || {}).AvailableForStart) || []).filter((c) => c.conditionType === 'Quest').length : null },
    objectives: { wiki: wObj || [] },
    hasWiki: !!w,
    observed: observed.byId.get(id) || null,
    // An observation outranks every source, so it short-circuits the tiebreak.
    verdict: observed.byId.get(id)
      ? { by: 'observed', removed: false, edited: (q && q.edited) || null, devStale: !!(q && q.page && base.name !== q.page),
        why: 'Read off the in-game quest screen. Nothing outranks it.' }
      : verdictFor(q, w, base.name),
  });
}
// Quests the game has and NO source does. They cannot come from the source list, // that is the whole point of them, so they are appended from observed/ or they
// would be invisible in the one viewer built to show what the sources miss.
for (const u of observed.unmatched) {
  rows.push({
    id: `observed:${u.name}`,
    modes: MODES.slice(),          // no source lists it, so nothing says which modes have it
    sourceless: true,
    dev: { name: null, trader: null, map: null, objMaps: [], level: null, loyalty: [], chain: [], objectives: [] },
    devByMode: null, modeDiff: null,
    name: { spt: null, wiki: null, ovr: null },
    trader: { spt: null }, map: { wiki: [] },
    level: { spt: null, wiki: [] }, loyalty: { spt: [], wiki: [] },
    chain: { spt: null }, objectives: { wiki: [] },
    hasWiki: false,
    observed: u,
    verdict: { by: 'observed', removed: false, edited: null, devStale: false,
      why: 'Read off the in-game quest screen, and no source has this quest at all.' },
  });
}

// sorted by the name the list actually SHOWS, so a confirmed rename does not
// leave the quest filed under a name no longer on screen ("Oil Run" under B)
const listName = (r) => String((r.observed && r.observed.name) || r.dev.name);
rows.sort((a, b) => listName(a).localeCompare(listName(b)));

const data = {
  generated: new Date().toISOString(), rows,
  modes: MODES, modeLabels: MODE_LABEL,
  modeCounts: Object.fromEntries(MODES.map((m) => [m, M[m].rows.size])),
  meta: { sources: ['tarkov.dev', 'tarkov-data-overlay', 'wiki', 'SPT (Mar 2025)'] },
};

const tpl = fs.readFileSync(path.join(__dirname, 'view_template.html'), 'utf8');
const outDir = path.join(ROOT, 'view');
fs.mkdirSync(outDir, { recursive: true });
const html = tpl.replace('/*DATA*/', () => JSON.stringify(data));
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

console.log(`view/index.html  ${(html.length / 1024 / 1024).toFixed(1)} MB  ${rows.length} quests (union of ${MODES.length} modes)`);
for (const m of MODES) {
  const mine = rows.filter((r) => r.modes.includes(m));
  const onlyHere = mine.filter((r) => r.modes.length === 1).length;
  console.log(`   ${MODE_LABEL[m].padEnd(9)} ${String(mine.length).padStart(3)} quests`
    + (onlyHere ? `, ${onlyHere} of them in NO other mode` : ', all shared with another mode'));
}
const diff = rows.filter((r) => r.modeDiff);
console.log(`   ${rows.filter((r) => r.modes.length < MODES.length).length} quest(s) missing from at least one mode`);
console.log(`   ${diff.length} quest(s) whose field values differ BETWEEN modes`
  + (diff.length ? `: ${diff.map((r) => `${r.dev.name} (${r.modeDiff.join(', ')})`).join('; ')}` : ''));
const noWiki = rows.filter((r) => !r.hasWiki).length;
console.log(`   ${rows.length - noWiki} with a wiki page, ${noWiki} without`);

// Where the sources disagree, for the default mode. Same rule the viewer uses:
// two sources that BOTH said something, saying different things.
const norm = (v) => Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase()).sort().join('|')
  : (v == null || v === '' ? '' : String(v).trim().toLowerCase());
const disagrees = (vals) => {
  const said = Object.values(vals).map(norm).filter((v) => v !== '');
  return said.length > 1 && new Set(said).size > 1;
};
const kinds = { name: 0, trader: 0, map: 0, level: 0, loyalty: 0, objectives: 0 };
let any = 0;
for (const r of rows.filter((x) => x.modes.includes('regular'))) {
  const d = r.dev;
  const f = [];
  if (disagrees({ td: d.name, ovr: r.name.ovr, wiki: r.name.wiki, spt: r.name.spt })) f.push('name');
  if (disagrees({ td: d.trader, spt: r.trader.spt })) f.push('trader');
  if (disagrees({ td: [...new Set([d.map, ...(d.objMaps || [])].filter(Boolean))], wiki: r.map.wiki })) f.push('map');
  if (disagrees({ td: d.level, spt: r.level.spt })) f.push('level');
  if (disagrees({ td: d.loyalty, wiki: r.loyalty.wiki, spt: r.loyalty.spt })) f.push('loyalty');
  if (d.objectives.length !== r.objectives.wiki.length && r.objectives.wiki.length) f.push('objectives');
  f.forEach((k) => kinds[k]++);
  if (f.length) any++;
}
console.log(`   PvP disagreements: ${any} quest(s), `
  + Object.entries(kinds).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`).join(', '));
console.log(`   ${observed.byId.size} quest(s) confirmed in game`
  + (observed.unmatched.length ? `, ${observed.unmatched.length} observation(s) matched nothing` : ''));
