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
// where a branch is written down, and in whose words — see fetch/branches.js
const { orPrevious, failOnly } = require('./branches.js');
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

// ---- the wiki's ==Requirements== section
//
// This is where the loyalty gates live. 1.1.0 re-hung much of the quest tree off
// trader loyalty, and tarkov.dev publishes FIVE such gates in the whole dataset
// while 62 wiki pages state one. Reading only tarkov.dev means publishing a
// quest as available when the game will not offer it.
const reqLines = (w) => {
  const m = /==\s*Requirements\s*==\s*\n([\s\S]*?)(?:\n==[^=]|$)/.exec(w || '');
  if (!m) return null;                       // no section at all: says nothing
  return m[1].split('\n').map((l) => l.trimEnd()).filter((l) => l.trim().startsWith('*'))
    .map((l) => strip(l.trim().replace(/^\**\s*/, ''))).filter(Boolean);
};

// The wiki says the same thing four ways, and matching one of them is how a
// generator ends up covering 13 quests instead of 40:
//   "Obtain level 2 loyalty with Skier"
//   "Must be Loyalty Level 3 to start this quest"      <- trader not named
//   "Reach Loyalty Level 2 with Ragman"
//   "Must reach Loyalty Level 2 with Peacekeeper to obtain this quest."
// So: find the number either way round, then look for a REAL trader name in the
// rest of the line rather than carving one out with punctuation. With no trader
// named, the line means the quest's OWN trader, which is what "to start this
// quest" refers to.
const loyaltyFrom = (text, ownTrader, traderNames) => {
  const m = /loyalty level\s*(\d+)|level\s*(\d+)\s*loyalty/i.exec(text);
  if (!m) return null;
  const value = Number(m[1] || m[2]);
  if (!(value >= 1 && value <= 4)) return null;
  const tail = text.slice(m.index);
  const named = traderNames.find((n) => new RegExp(`\\b${n}\\b`, 'i').test(tail));
  if (!named && !ownTrader) return null;
  return { trader: named || ownTrader, kind: 'loyalty', compareMethod: '>=', value };
};

// tarkov.dev's text is double-encoded UTF-8 in places: a right single quote
// arrives as the bytes of "a€™" re-encoded. Repair is attempted only when every
// character is <= U+00FF and at least one is >= U+0080, so a correctly encoded
// string can never match and cannot be corrupted by the repair.
function clean(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  if (/[-ÿ]/.test(out) && !/[Ā-￿]/.test(out)) {
    const repaired = Buffer.from(out, 'latin1').toString('utf8');
    if (!repaired.includes('�')) out = repaired;
  }
  return out.trim();
}

function loadMode(mode) {
  const td = J(`tarkovdev/${mode}.tasks.json`);
  const en = (J(`tarkovdev/${mode}.tasks_en.json`) || {}).data || {};
  const mapsEn = (J(`tarkovdev/${mode}.maps_en.json`) || {}).data || {};
  const trEn = (J(`tarkovdev/${mode}.traders_en.json`) || {}).data || {};
  // Fetched once, under `regular`, because item names do not vary by mode.
  const itEn = (() => { try { return (J('tarkovdev/regular.items_en.json') || {}).data || {}; } catch { return {}; } })();
  const L = (v) => { const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v; return typeof r === 'string' ? clean(r) : r; };
  const MAPN = (id) => (typeof id === 'string' && mapsEn[`${id} Name`] ? MAP_VARIANT(clean(mapsEn[`${id} Name`])) : null);
  const TRN = (id) => (typeof id === 'string' ? clean(trEn[`${id} Nickname`] || '') || null : null);
  const ITN = (id) => (typeof id === 'string' ? (clean(itEn[`${id} Name`] || '') || id) : null);
  const tasks = (td.data && td.data.tasks) || {};
  const qItems = (td.data && td.data.questItems) || {};
  const QIN = (id) => {
    const q = qItems[id];
    const n = q && typeof q.name === 'string' ? L(q.name) : null;
    return n || ITN(id);
  };
  const pos = (p) => (p && typeof p.x === 'number' ? { x: p.x, y: p.y, z: p.z } : null);

  // The FULL objective, not just its text. This is what a tracker needs and what
  // no other published source carries: a stable id to tick against, a type, the
  // maps and zone coordinates that place a pin, the keys the player must bring.
  // 465 objectives have zone coordinates and 116 have possible item locations,
  // and all of it is lost the moment an objective is reduced to a sentence.
  const objectiveOf = (o) => {
    const out = {
      id: o.id,
      type: o.type,
      description: L(o.description),
      optional: !!o.optional,
      maps: (o.maps || []).map(MAPN).filter(Boolean),
    };
    // requiredKeys is a list of alternative key SETS, nested on purpose: bring
    // every key in any one set. Flattening it would say the wrong thing.
    if (Array.isArray(o.requiredKeys) && o.requiredKeys.length) {
      out.requiredKeys = o.requiredKeys.map((set) => (Array.isArray(set) ? set.map(ITN) : [ITN(set)]));
    }
    const zones = (o.zones || []).map((z) => ({ map: MAPN(z.map), position: pos(z.position) }))
      .filter((z) => z.position || z.map);
    if (zones.length) out.zones = zones;
    if (o.count != null) out.count = o.count;
    if (o.foundInRaid) out.foundInRaid = true;
    if (Array.isArray(o.items) && o.items.length) out.items = o.items.map(ITN);
    if (o.questItem != null) out.questItem = QIN(o.questItem);
    if (Array.isArray(o.possibleLocations) && o.possibleLocations.length) {
      out.possibleLocations = o.possibleLocations.map((pl) => ({
        map: MAPN(pl.map),
        positions: (pl.positions || []).map(pos).filter(Boolean),
      }));
    }
    if (o.exitName != null) out.exitName = o.exitName;
    if (o.markerItem != null) out.markerItem = ITN(o.markerItem);
    if (Array.isArray(o.useAny) && o.useAny.length) out.useAny = o.useAny.map(ITN);
    if (o.item != null) out.item = ITN(o.item);
    return out;
  };

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
      restartable: !!t.restartable,
      loyalty: (t.traderRequirements || []).filter((r) => r.requirementType === 'level')
        .map((r) => ({ trader: TRN(r.trader), level: r.value })),
      // Both kinds, kept apart. `reputation` is the decimal standing (Fence
      // karma); `level` is the trader's loyalty level. A tracker needs both, and
      // they gate in completely different ways.
      traderRequirements: (t.traderRequirements || [])
        .filter((r) => r && (r.requirementType === 'reputation' || r.requirementType === 'level'))
        .map((r) => ({
          trader: TRN(r.trader),
          kind: r.requirementType === 'level' ? 'loyalty' : 'reputation',
          compareMethod: r.compareMethod || '>=',
          value: typeof r.value === 'number' ? r.value : 0,
        })),
      objectiveText: (t.objectives || []).map((o) => L(o.description)),
      objectives: (t.objectives || []).map(objectiveOf),
      requires: (t.taskRequirements || []).map((r) => ({ task: r.task, status: r.status || ['complete'] })),
      // Completing any quest named here FAILS this one. It is how the game
      // encodes an exclusive choice, and reading only `requires` misses it.
      failedBy: [...new Set((t.failConditions || [])
        .filter((c) => c && c.task).map((c) => c.task))],
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
let wikiGates = 0;
let droppedLevels = 0;
let failGated = 0;
// { id, titles, at } — resolved after the loop, when every published name is
// known. The wiki names an alternative by its CURRENT title, and the current
// title of a renamed quest is only settled once its own record has been built.
const pendingAnyOf = [];

// Trader names, longest first, so "Prapor" cannot claim a line naming someone
// whose name contains it.
const TRADER_NAMES = [...new Set(MODES.flatMap((m) => [...M[m].values()].map((t) => t.trader).filter(Boolean)))]
  .sort((x, y) => y.length - x.length);

for (const id of allIds) {
  const modes = MODES.filter((m) => M[m].has(id));
  const dev = M[modes[0]].get(id);
  const wq = wikiRec[id] || null;

  // WHICH WIKI PAGE DESCRIBES THIS QUEST, which is not the same question as
  // which page the index filed under its id.
  //
  // The index resolves by the name tarkov.dev publishes, and the wiki RENUMBERED
  // its pages in place. So for a reshuffled line the id-mapped page is a
  // different quest: the id tarkov.dev calls "The Tarkov Shooter - Part 6" is
  // the game's Part 5, and taking its id-mapped page published Part 6's
  // objectives under Part 5's name. `wikiLink` was already resolved by the
  // current name for exactly this reason; the TEXT was not, which is worse,
  // because a wrong link is visibly wrong and wrong objectives are not.
  //
  // So when an observation gives the current name and a page exists under it,
  // that page wins. Only for observed records: without one there is nothing
  // better than the index.
  const obsName = observed.byId.get(id) ? observed.byId.get(id).name : null;
  const byCurrentName = obsName && storedPages.has(pageKey(obsName)) ? obsName : null;
  const wikiTitle = byCurrentName || (wq && wq.page) || null;
  const wpage = wikiTitle ? wikiPage(wikiTitle) : null;
  const wikiAt = byCurrentName
    ? day((wikiIdx.quests.find((r) => r.page === byCurrentName) || {}).edited) || (wq ? day(wq.edited) : null)
    : (wq ? day(wq.edited) : null);
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

  // TWO VIEWS OF THE OBJECTIVES, on purpose, because no single one can serve
  // both readers.
  //
  //   `objectives`     the structured list: a stable id to tick against, a type,
  //                    maps, zone coordinates, item names, the keys to bring.
  //                    Only tarkov.dev has any of it, so it is undated.
  //   `objectiveText`  the WORDING, from the best-dated source that has it.
  //
  // They are kept apart rather than merged because merging needs the two lists
  // to line up positionally, and they routinely do not: 1.1.0 rewrote quests to
  // different objective COUNTS, so pairing by index would attach one quest's
  // coordinates to another quest's sentence. A consumer ticks against
  // `objectives` and displays `objectiveText`.
  const obsObjUsable = obs && obs.status === 'completed' && (obs.objectives || []).length;
  put('objectiveText', pick([
    obsObjUsable ? src.obs('objectiveText', obs.objectives) : null,
    wikiSays && wObj.length ? src.wiki('objectiveText', wObj) : null,
    src.dev('objectiveText', dev.objectiveText),
  ].filter(Boolean)));
  if (obs && !obsObjUsable && (obs.objectives || []).length) {
    provenance.objectiveText = provenance.objectiveText || {};
    provenance.objectiveText.note = `The in-game capture shows ${obs.objectives.length} objective(s), but the quest was `
      + `${obs.status} when seen and the game hides steps behind unfinished ones, so it is a lower bound, not the list.`;
  }
  put('objectives', pick([src.dev('objectives', dev.objectives)]));

  put('loyalty', pick([
    obs && obs.availableAtLoyalty != null && obs.trader
      ? src.obs('loyalty', [{ trader: obs.trader, level: obs.availableAtLoyalty }]) : null,
    dev.loyalty.length ? src.dev('loyalty', dev.loyalty) : null,
  ].filter(Boolean)));

  put('minPlayerLevel', pick([src.dev('minPlayerLevel', dev.minPlayerLevel)]));
  put('faction', pick([src.dev('faction', dev.faction)]));
  put('requires', pick([src.dev('requires', dev.requires)]));
  put('objectiveMaps', pick([src.dev('objectiveMaps', dev.objectiveMaps)]));
  // LOYALTY GATES, from the wiki's Requirements section, on top of the five
  // tarkov.dev publishes. The wiki is never allowed to contradict tarkov.dev
  // here, only to add a trader it says nothing about: two sources disagreeing
  // about the same trader is a finding for OPEN.md, not something to silently
  // resolve in the published file.
  const wReq = wikiSays ? reqLines(wpage) : null;
  const devTR = dev.traderRequirements || [];
  const addedTR = [];
  for (const line of wReq || []) {
    const row = loyaltyFrom(line, fields.trader || dev.trader, TRADER_NAMES);
    if (!row) continue;
    if (devTR.some((r) => r.trader === row.trader)) continue;        // already stated
    if (addedTR.some((r) => r.trader === row.trader)) continue;
    addedTR.push(row);
  }
  if (addedTR.length) {
    fields.traderRequirements = [...devTR, ...addedTR];
    provenance.traderRequirements = { src: 'wiki', asOf: wikiAt, dating: 'exact',
      note: `${addedTR.length} loyalty gate(s) read off the wiki's Requirements section; tarkov.dev states ${devTR.length}.` };
    wikiGates += addedTR.length;
  } else {
    put('traderRequirements', pick([src.dev('traderRequirements', dev.traderRequirements)]));
  }

  // A LEVEL REQUIREMENT THE WIKI SAYS IS GONE. 1.1.0 replaced a lot of "Must be
  // level 10 to start this quest" with "Must be Loyalty Level 2", and tarkov.dev
  // still publishes the old number.
  //
  // Only on a page that HAS a filled Requirements section. Most pages have none,
  // and silence there is silence, not a claim. Where a section exists, the wiki
  // keeps BOTH lines when both apply (Counteraction states a level AND a loyalty
  // level), so a missing level line inside a populated section is a statement.
  if ((dev.minPlayerLevel || 0) > 0 && wReq && wReq.length
      && !wReq.some((l) => /must be level\s*\d+/i.test(l))) {
    fields.minPlayerLevel = null;
    provenance.minPlayerLevel = { src: 'wiki', asOf: wikiAt, dating: 'exact',
      note: `tarkov.dev requires level ${dev.minPlayerLevel}; the wiki's Requirements section lists no level.` };
    droppedLevels++;
  }

  if (dev.failedBy.length) put('failedBy', pick([src.dev('failedBy', dev.failedBy)]));

  // A SECOND CHANCE, NOT A NEXT STEP. Four quests exist only once another has
  // been FAILED — Hot Wheels - Let's Try Again after Hot Wheels, and the three
  // make-amends quests a trader offers once you have taken a rival's side. Their
  // requirement row says so, in a `status` field almost nothing reads, so they
  // publish as ordinary follow-ups and every tracker lists them for players who
  // will never be offered them. Stated outright so a consumer can hide them
  // without having to know the rule.
  if (failOnly(fields.requires).length) {
    fields.onlyAfterFailure = true;
    failGated++;
  }

  // "Complete either of these", which only the wiki can say. Held for the
  // post-pass below: these are page TITLES and have to become ids.
  const alts = wikiSays ? orPrevious(wpage) : null;
  if (alts) pendingAnyOf.push({ id, titles: alts, at: wikiAt });

  // The three modes are near-identical, but "near" is not "identical": one quest
  // carries a different level and a different prerequisite in PvP than in the
  // other two. Publishing the first mode's values for all three would be right
  // 537 times out of 538 and silently wrong once, which is the worst kind of
  // wrong. Recorded only where a mode actually disagrees.
  const MODE_CHECK = ['minPlayerLevel', 'map', 'trader', 'requires', 'traderRequirements', 'kappaRequired', 'lightkeeperRequired'];
  const modeOverrides = {};
  for (const m of modes.slice(1)) {
    const other = M[m].get(id);
    const diff = {};
    for (const f of MODE_CHECK) {
      if (JSON.stringify(other[f]) !== JSON.stringify(dev[f])) diff[f] = other[f];
    }
    if (Object.keys(diff).length) modeOverrides[MODE_PUB[m]] = diff;
  }

  const dates = Object.values(provenance).map((p) => p.asOf).filter(Boolean).sort();
  quests.push({
    id,
    ...fields,
    modeOverrides: Object.keys(modeOverrides).length ? modeOverrides : undefined,
    modes: modes.map((m) => MODE_PUB[m]),
    kappaRequired: dev.kappaRequired,
    lightkeeperRequired: dev.lightkeeperRequired,
    restartable: dev.restartable,
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

// ---- resolve the OR-groups, and name the failure each retry quest waits on
//
// By title first, because that is what the wiki wrote, then by the name we
// published (an observation may have renamed the quest since), then by the
// index. A title that resolves to nothing is REPORTED AND DROPPED: publishing a
// group with a hole in it would read as "these are the alternatives" while
// naming fewer than there are, which is worse than not publishing it.
{
  const key = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const byKey = new Map();
  for (const q of quests) {
    for (const k of [key(q.name)]) if (k && !byKey.has(k)) byKey.set(k, q.id);
  }
  for (const r of wikiIdx.quests) {
    const k = key(r.page);
    if (k && r.id && !byKey.has(k)) byKey.set(k, r.id);
  }
  const byId = new Map(quests.map((q) => [q.id, q]));
  const nameOf = (qid) => (byId.get(qid) ? byId.get(qid).name : qid);

  let groups = 0;
  const unresolved = [];
  for (const p of pendingAnyOf) {
    const q = byId.get(p.id);
    if (!q) continue;
    const ids = [];
    for (const t of p.titles) {
      const hit = byKey.get(key(t));
      if (hit && hit !== p.id && !ids.includes(hit)) ids.push(hit);
      else if (!hit) unresolved.push(`${q.name}: "${t}"`);
    }
    if (ids.length < 2) continue;
    q.requiresAnyOf = ids;
    q.provenance.requiresAnyOf = { src: 'wiki', asOf: p.at, dating: 'exact',
      note: `Any ONE of these opens it: ${ids.map(nameOf).join(', ')}. `
        + `tarkov.dev's \`requires\` cannot express a choice and names ${(q.requires || []).length} of them.` };
    groups++;
  }

  // and the retry quests, now that the prerequisite has a name
  for (const q of quests) {
    if (!q.onlyAfterFailure) continue;
    const after = failOnly(q.requires).map((r) => nameOf(r.task));
    q.provenance.onlyAfterFailure = { src: 'tarkov.dev', asOf: null, dating: 'none',
      note: `Derived from \`requires\`: offered only once ${after.join(' and ')} has been FAILED. `
        + 'Completing it does not open this quest; nothing does.' };
  }
  // ---- the same quest, published once per arm
  //
  // "Either A or B" is not a shape tarkov.dev's schema has, and BSG's own data
  // does not have it either. What both actually hold is N SEPARATE QUESTS with
  // the same name and identical objectives, one per arm, each requiring its own
  // arm: Make Amends is three ids, Battery Change two. The player is offered
  // exactly one, and anything listing them by id lists one quest three times.
  //
  // Only where the wiki INDEPENDENTLY writes the same split as an "or" and the
  // arms it names are exactly the group's prerequisites. Same name and the same
  // objectives is not enough on its own: The Tarkov Shooter - Part 5 is two ids
  // with identical objectives too, and that is tarkov.dev's stale numbering
  // against the wiki's renumbering, a different thing entirely.
  let sibSets = 0;
  {
    const byName = new Map();
    for (const q of quests) {
      if (!q.name || !(q.requires || []).length) continue;
      if (!byName.has(q.name)) byName.set(q.name, []);
      byName.get(q.name).push(q);
    }
    for (const [, group] of byName) {
      if (group.length < 2) continue;
      if (new Set(group.map((q) => JSON.stringify(q.objectiveText || []))).size !== 1) continue;
      const sets = group.map((q) => q.requires.map((r) => r.task).sort().join('+'));
      if (new Set(sets).size !== group.length) continue;              // arms must differ
      const union = [...new Set(group.flatMap((q) => q.requires.map((r) => r.task)))].sort();
      // the wiki's own "or", from whichever member carries it
      const said = group.map((q) => q.requiresAnyOf).find(Boolean);
      if (!said || [...said].sort().join('+') !== union.join('+')) continue;
      for (const q of group) {
        q.sameQuestAs = group.filter((o) => o.id !== q.id).map((o) => o.id);
        q.provenance.sameQuestAs = { src: 'wiki', asOf: q.provenance.requiresAnyOf ? q.provenance.requiresAnyOf.asOf : null,
          dating: q.provenance.requiresAnyOf ? 'exact' : 'none',
          note: `One quest published as ${group.length} ids, one per branch arm, identical objectives. `
            + 'The player is offered exactly one; the others are unreachable. '
            + "Held together by the wiki's own \"or\" over the same arms." };
      }
      sibSets++;
    }
  }

  console.log(`   ${failGated} quest(s) open only after a FAILURE; ${groups} opened by ANY ONE of several`
    + `; ${sibSets} quest(s) published once per arm`);
  if (unresolved.length) console.log(`   alternative(s) the wiki names that no source has: ${unresolved.join('; ')}`);
}

quests.sort((a, b) => String(a.name).localeCompare(String(b.name)));

const payload = {
  // 2 added the full objective structure (ids, types, zones, coordinates,
  // items, required keys), traderRequirements, failedBy, restartable and
  // modeOverrides, so a tracker can consume this file INSTEAD of tarkov.dev
  // rather than alongside it. In 1, `objectives` was a list of sentences; it is
  // now a list of objects and the sentences live in `objectiveText`.
  schemaVersion: 2,
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
console.log(`   ${wikiGates} loyalty gate(s) added from the wiki, ${droppedLevels} stale level requirement(s) dropped`);
