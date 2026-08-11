// Builds api/quests.json, the thing this repo exists to publish.
//
// The point of the file is not "quest data": several projects already have that.
// The point is that EVERY VALUE CARRIES THE DATE IT WAS LAST KNOWN TO BE TRUE,
// and says which source it came from. A consumer who already holds better data
// for one field can then keep it, instead of choosing between taking all of ours
// or none of it.
//
// THE DATE IS NOT THE DOWNLOAD TIME. Fetching a stale record today does not
// make it current, and stamping every field with the fetch time would make the
// stalest source look like the freshest. So each source is rated by how well it
// can date its own content:
//
//   observed    exact, per record, read off the game screen on a known day
//   wiki        exact, per record, the page's last revision timestamp
//   overlay     per snapshot, $meta.generated
//   SPT         per snapshot     , the last commit touching the quest JSON
//   tarkov.dev  NONE             , publishes no per-task date of any kind
//
// tarkov.dev's `asOf` is therefore null, not the fetch time, and its `dating` is
// "none". A merging consumer must never let an undated value overwrite a dated
// one; that rule is what the whole file is for, and faking a date would break it.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const OUT = path.join(ROOT, 'api');
const { loadObserved } = require('./observed_lib.js');
require('./raw_ready.js')(ROOT);

const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));
const MODES = ['regular', 'pve', 'pvp-season'];
const MODE_PUB = { regular: 'pvp', pve: 'pve', 'pvp-season': 'seasonal' };
const MAP_VARIANT = (n) => (n === 'Night Factory' ? 'Factory' : String(n || '').replace(/\s*21\+\s*$/, ''));
const day = (t) => (t ? String(t).slice(0, 10) : null);

// ---- sources
const wikiIdx = J('wiki/index.json');
const wikiRec = wikiIdx.quests.reduce((a, q) => (a[q.id] = q, a), {});
const overlay = J('overlay/dist.overlay.json');
const sptCommits = J('spt/commits.json');
const manifest = (() => { try { return J('MANIFEST.json'); } catch { return {}; } })();

const wikiPage = (title) => {
  try { return fs.readFileSync(path.join(RAW, 'wiki', 'pages', String(title).replace(/[^\w.-]+/g, '_') + '.txt'), 'utf8'); }
  catch { return null; }
};
const strip = (s) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/\{\{[^}]*\}\}/g, '').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// sub-bullets are optional objectives and count, see README
const section = (w, name) => {
  const m = new RegExp(`==\\s*${name}\\s*==\\s*\\n([\\s\\S]*?)(?:\\n==[^=]|$)`).exec(w || '');
  if (!m) return null;
  return m[1].split('\n').map((l) => l.trim()).filter((l) => /^\*+\s*\S/.test(l)).map((l) => strip(l.replace(/^\*+\s*/, '')));
};
const isRemoved = (w) => /\{\{\s*Historical content/i.test(w || '');

function loadMode(mode) {
  const td = J(`tarkovdev/${mode}.tasks.json`);
  const en = (J(`tarkovdev/${mode}.tasks_en.json`) || {}).data || {};
  const mapsEn = (J(`tarkovdev/${mode}.maps_en.json`) || {}).data || {};
  const trEn = (J(`tarkovdev/${mode}.traders_en.json`) || {}).data || {};
  const L = (v) => { const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v; return typeof r === 'string' ? r.trim() : r; };
  const MAPN = (id) => (typeof id === 'string' && mapsEn[`${id} Name`] ? MAP_VARIANT(mapsEn[`${id} Name`]) : null);
  const TRN = (id) => (typeof id === 'string' ? (trEn[`${id} Nickname`] || '').trim() || null : null);
  const tasks = (td.data && td.data.tasks) || {};
  const out = new Map();
  for (const [id, t] of Object.entries(tasks)) {
    out.set(id, {
      id,
      name: L(t.name),
      trader: TRN(t.trader),
      faction: t.factionName && t.factionName !== 'Any' ? t.factionName : null,
      map: MAPN(t.map),
      objectiveMaps: [...new Set((t.objectives || []).flatMap((o) => (o.maps || []).map(MAPN).filter(Boolean)))],
      minPlayerLevel: t.minPlayerLevel || null,
      loyalty: (t.traderRequirements || []).filter((r) => r.requirementType === 'level')
        .map((r) => ({ trader: TRN(r.trader), level: r.value })),
      objectives: (t.objectives || []).map((o) => L(o.description)),
      requires: (t.taskRequirements || []).map((r) => ({ task: r.task, status: r.status || ['complete'] })),
      kappaRequired: !!t.kappaRequired,
      lightkeeperRequired: !!t.lightkeeperRequired,
      wikiLink: t.wikiLink ? String(t.wikiLink).replace(/(?:%0A|%0D)+$/i, '') : null,
    });
  }
  return out;
}
const M = Object.fromEntries(MODES.map((m) => [m, loadMode(m)]));
const observed = loadObserved(ROOT);

// ---- source descriptors, each stating how well it can date itself
const overlayAt = day((overlay.$meta || {}).generated);
const sptAt = day((sptCommits[0] || {}).date);
const wikiDates = wikiIdx.quests.map((q) => q.edited).filter(Boolean).sort();
const obsDates = observed.docs.map((d) => d.observedAt).filter(Boolean).sort();
const fetchedAt = day(manifest.generated) || day(wikiIdx.fetchedAt);

const SOURCES = {
  observed: {
    what: 'Read off the in-game quest screen and transcribed.',
    dating: 'exact', datingNote: 'The day the quest was seen on screen.',
    asOf: obsDates[obsDates.length - 1] || null,
    coverage: `${observed.byId.size} quests`,
    profile: { mode: 'pve', faction: 'USEC', gameVersion: '1.1.0' },
    license: 'CC0-1.0, this is our own observation, use it freely.',
  },
  wiki: {
    what: 'escapefromtarkov.fandom.com, one page per quest.',
    dating: 'exact', datingNote: "The page's last revision timestamp, per quest.",
    asOf: day(wikiDates[wikiDates.length - 1]),
    coverage: `${wikiIdx.pagesStored} pages`,
    license: 'CC BY-SA 3.0, attribution and share-alike apply to anything derived from it.',
    attribution: 'Escape from Tarkov Wiki contributors, https://escapefromtarkov.fandom.com',
  },
  overlay: {
    what: 'tarkov-data-overlay (tarkovtracker-org), a correction layer over tarkov.dev.',
    dating: 'snapshot', datingNote: 'One build date for the whole file ($meta.generated); it cannot date a single task.',
    asOf: overlayAt, version: (overlay.$meta || {}).version || null,
  },
  'tarkov.dev': {
    what: 'json.tarkov.dev, the widest coverage, and the only source with map coordinates.',
    dating: 'none',
    datingNote: 'PUBLISHES NO DATE FOR A TASK, at any granularity. `asOf` is null on purpose: '
      + 'the fetch time says when we downloaded it, not when the record was last true. Never let an '
      + 'undated value overwrite a dated one.',
    asOf: null, retrievedAt: fetchedAt,
  },
  spt: {
    what: 'SPT-AKI quest JSON, kept as a schema reference.',
    dating: 'snapshot', datingNote: 'The last commit touching the quest JSON.',
    asOf: sptAt,
  },
};

// ---- the believe-order, and the evidence for it
//
// 1. observed , the game itself. Nothing outranks it.
// 2. wiki     , 527 of its 529 dated quest pages were edited on or after patch
//                1.1.0 (2026-08-03), so it is current almost everywhere.
// 3. tarkov.dev, undated, and demonstrably pre-1.1.0 on about 91 names.
// A field is taken from the first source that HAS it, and the record says which.
const pick = (candidates) => {
  for (const c of candidates) {
    if (c.value === undefined || c.value === null) continue;
    if (Array.isArray(c.value) && !c.value.length) continue;
    return c;
  }
  return null;
};

// Every page title we actually hold, so a link can be checked before it is
// published rather than pointing at a page that may not exist.
const storedPages = new Set(fs.existsSync(path.join(RAW, 'wiki', 'pages'))
  ? fs.readdirSync(path.join(RAW, 'wiki', 'pages')).map((f) => f.replace(/\.txt$/, ''))
  : []);
const pageKey = (t) => String(t || '').replace(/[^\w.-]+/g, '_');
const wikiUrl = (title) => `https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
const wikiLinkFor = (currentName, wq) => {
  if (currentName && storedPages.has(pageKey(currentName))) return wikiUrl(currentName);
  if (wq && wq.page && storedPages.has(pageKey(wq.page))) return wikiUrl(wq.page);
  return null;
};

const allIds = [...new Set(MODES.flatMap((m) => [...M[m].keys()]))];
const quests = [];
let removedCount = 0;

for (const id of allIds) {
  const modes = MODES.filter((m) => M[m].has(id));
  const dev = M[modes[0]].get(id);
  const wq = wikiRec[id] || null;
  const wpage = wq && wq.page ? wikiPage(wq.page) : null;
  const wikiAt = wq ? day(wq.edited) : null;
  const wObj = section(wpage, 'Objectives') || [];
  const obs = observed.byId.get(id) || null;
  const obsAt = obs ? day(obs.observedAt) : null;
  const removed = isRemoved(wpage);
  if (removed) removedCount++;

  const src = {
    obs: (field, value) => ({ src: 'observed', asOf: obsAt, dating: 'exact', value }),
    wiki: (field, value) => ({ src: 'wiki', asOf: wikiAt, dating: 'exact', value }),
    dev: (field, value) => ({ src: 'tarkov.dev', asOf: null, dating: 'none', value }),
  };

  const fields = {};
  const provenance = {};
  const put = (name, chosen) => {
    if (!chosen) return;
    fields[name] = chosen.value;
    provenance[name] = { src: chosen.src, asOf: chosen.asOf, dating: chosen.dating };
  };

  // An index entry is not a page. `Immunity` and `Neuanfang` have a row in the
  // wiki index but no stored page, one resolved to a SKILL page and was
  // rejected, the other has no page at all, so their `edited` is null. Taking
  // the title from the index anyway produced a value marked `dating: "exact"`
  // with no date on it, which is precisely the lie this file must not tell. The
  // wiki speaks about a quest only when we hold its page AND its date.
  const wikiSays = !!(wpage && wikiAt);
  put('name', pick([
    obs && src.obs('name', obs.name),
    wikiSays && wq.page ? src.wiki('name', wq.page) : null,
    src.dev('name', dev.name),
  ].filter(Boolean)));

  put('trader', pick([
    obs && src.obs('trader', obs.trader),
    src.dev('trader', dev.trader),
  ].filter(Boolean)));

  // The card's location header is not always a map name.
  const NOT_A_MAP = new Set(['Any location', 'Transition']);
  put('map', pick([
    obs && obs.location && !NOT_A_MAP.has(obs.location) ? src.obs('map', obs.location) : null,
    src.dev('map', dev.map),
  ].filter(Boolean)));

  // An UNFINISHED quest's objective list is a LOWER BOUND, the game reveals a
  // step only once the step it depends on is done. Publishing it as the whole
  // list would ship a shorter quest than the game has.
  const obsObjUsable = obs && obs.status === 'completed' && (obs.objectives || []).length;
  put('objectives', pick([
    obsObjUsable ? src.obs('objectives', obs.objectives) : null,
    wikiSays && wObj.length ? src.wiki('objectives', wObj) : null,
    src.dev('objectives', dev.objectives),
  ].filter(Boolean)));
  if (obs && !obsObjUsable && (obs.objectives || []).length) {
    provenance.objectives = provenance.objectives || {};
    provenance.objectives.note = `The in-game capture shows ${obs.objectives.length} objective(s), but the quest was `
      + `${obs.status} when seen and the game hides steps behind unfinished ones, so it is a lower bound, not the list.`;
  }

  put('loyalty', pick([
    obs && obs.availableAtLoyalty != null && obs.trader
      ? src.obs('loyalty', [{ trader: obs.trader, level: obs.availableAtLoyalty }]) : null,
    dev.loyalty.length ? src.dev('loyalty', dev.loyalty) : null,
  ].filter(Boolean)));

  put('minPlayerLevel', pick([src.dev('minPlayerLevel', dev.minPlayerLevel)]));
  put('faction', pick([src.dev('faction', dev.faction)]));
  put('requires', pick([src.dev('requires', dev.requires)]));
  put('objectiveMaps', pick([src.dev('objectiveMaps', dev.objectiveMaps)]));

  const dates = Object.values(provenance).map((p) => p.asOf).filter(Boolean).sort();
  quests.push({
    id,
    ...fields,
    modes: modes.map((m) => MODE_PUB[m]),
    kappaRequired: dev.kappaRequired,
    lightkeeperRequired: dev.lightkeeperRequired,
    // NEITHER tarkov.dev's `wikiLink` NOR our own id->page lookup is right for a
    // renumbered line, and for the same reason: both resolve by the name
    // tarkov.dev publishes, while the wiki RENUMBERED ITS PAGES IN PLACE rather
    // than moving them. So the page carrying THIS quest's content is the one
    // titled like the quest's CURRENT name, which is exactly what `fields.name`
    // is, once an observation has supplied it. Linking by id sent
    // "The Punisher - Part 3" to the page for Part 2.
    wikiLink: wikiLinkFor(fields.name, wq),
    // The newest field date on the record, a cheap top-level "is any of this
    // newer than mine?" check before reading `provenance` at all.
    asOf: dates[dates.length - 1] || null,
    confirmedInGame: !!obs,
    // NOT "we could not find it". The wiki banners a removed quest's page
    // {{Historical content}} and keeps the page, so this is a positive statement
    // by a dated source, and it is why a tracker should stop asking for it.
    removedFromGame: removed || undefined,
    removedSaysWiki: removed ? wikiAt : undefined,
    provenance,
  });
}

// Quests the game has that NO source lists, they cannot come from the source
// tables, so they are appended, or the one thing only we know stays invisible.
for (const u of observed.unmatched) {
  const at = day(u.observedAt);
  const f = {
    name: u.name,
    trader: u.trader,
    map: u.location && u.location !== 'Any location' ? u.location : null,
  };
  // Same rule as everywhere else: an unfinished quest's list is a lower bound,
  // so it is not published as the objectives.
  if (u.status === 'completed' && (u.objectives || []).length) f.objectives = u.objectives;
  if (u.availableAtLoyalty != null) f.loyalty = [{ trader: u.trader, level: u.availableAtLoyalty }];
  quests.push({
    id: `observed:${u.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    ...f,
    modes: [MODE_PUB[{ pve: 'pve' }[u.mode] || 'pve'] || 'pve'],
    asOf: at,
    confirmedInGame: true,
    // The interesting bit: no published id exists, because no publisher has it.
    unknownToEverySource: true,
    // Only over the fields actually present, provenance for a field that is not
    // in the record describes nothing, and the guard below rejects it.
    provenance: Object.fromEntries(Object.keys(f).map((k) => [k, { src: 'observed', asOf: at, dating: 'exact' }])),
  });
}

quests.sort((a, b) => String(a.name).localeCompare(String(b.name)));

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  game: { version: '1.1.0', modes: ['pvp', 'pve', 'seasonal'] },
  // How to merge this with data you already hold. Stated in the file itself so
  // it travels with the data instead of living only in a README nobody fetched.
  mergeContract: {
    rule: 'Compare dates per FIELD, not per quest. Keep whichever value is newer.',
    undated: 'dating:"none" means the source cannot say when the value was last true. '
      + 'Never let an undated value overwrite a dated one, in either direction.',
    precedence: ['observed (the game itself)', 'wiki (dated per page)', 'tarkov.dev (undated)'],
    quickCheck: 'Each quest carries a top-level `asOf`, the newest of its field dates. '
      + 'If yours is newer than that, you can skip the whole record.',
  },
  sources: SOURCES,
  counts: {
    quests: quests.length,
    confirmedInGame: quests.filter((q) => q.confirmedInGame).length,
    removedFromGame: removedCount,
    unknownToEverySource: quests.filter((q) => q.unknownToEverySource).length,
  },
  quests,
};

// ---- refuse to publish a file that lies about its own dates
//
// Every other defect here is a wrong value, which a consumer can notice. A wrong
// DATE is worse: it silently wins a merge it should have lost, and the consumer
// has no way to see it happen. So the invariants are checked on every build and
// a failure stops the write. The first run caught two, `Immunity` and
// `Neuanfang` have a wiki index row but no stored page, and were being published
// as `dating: "exact"` with no date on them.
const violations = [];
for (const q of quests) {
  for (const [f, p] of Object.entries(q.provenance || {})) {
    if (p.dating === 'none' && p.asOf) violations.push(`${q.name}.${f}: an undated source carries a date`);
    if (p.dating === 'exact' && !p.asOf) violations.push(`${q.name}.${f}: dating "exact" with no date`);
    if (p.src === 'tarkov.dev' && p.asOf) violations.push(`${q.name}.${f}: tarkov.dev value was given a date`);
    if (q[f] === undefined) violations.push(`${q.name}.${f}: provenance for a field that is not published`);
  }
  const ds = Object.values(q.provenance || {}).map((p) => p.asOf).filter(Boolean).sort();
  const newest = ds[ds.length - 1] || null;
  if ((q.asOf || null) !== newest) violations.push(`${q.name}: asOf ${q.asOf} is not the newest field date (${newest})`);
  if (q.removedFromGame && !q.removedSaysWiki) violations.push(`${q.name}: claimed removed with no date for the claim`);
}
if (violations.length) {
  console.error(`REFUSING TO WRITE, ${violations.length} date invariant(s) broken:`);
  for (const v of violations.slice(0, 20)) console.error('   ' + v);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, 'quests.json');
fs.writeFileSync(file, JSON.stringify(payload, null, 1) + '\n', 'utf8');

const kb = (fs.statSync(file).size / 1024).toFixed(0);
console.log(`api/quests.json, ${quests.length} quests, ${kb} KB`);
const byField = {};
for (const q of quests) for (const [f, p] of Object.entries(q.provenance || {})) {
  byField[p.src] = (byField[p.src] || 0) + 1;
}
console.log('   field values by source: ' + Object.entries(byField).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`   ${payload.counts.confirmedInGame} confirmed in game, ${payload.counts.removedFromGame} removed from the game, `
  + `${payload.counts.unknownToEverySource} in no source but ours`);
const undated = quests.filter((q) => !q.asOf).length;
console.log(`   ${quests.length - undated} quest(s) carry a date, ${undated} carry none (every field came from tarkov.dev)`);
