// Builds view/tree.html, one quest tree per trader, laid out and drawn as SVG.
//
// Reads raw/ only. Edges are tarkov.dev's `taskRequirements`; loyalty and level
// badges come from the wiki's Requirements section where it has one and from
// tarkov.dev otherwise. Nothing here is corrected, the tree draws what the
// sources say, which is also the fastest way to SEE where they are wrong.
//
// A full set of trees is built PER GAME MODE, because the modes do not hold the
// same quests. Trader portraits are hoisted to a shared map rather than embedded
// per trader per mode, they are base64 images and would otherwise be the
// largest thing in the file, three times over.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));

const MODES = ['regular', 'pve', 'pvp-season'];
const MODE_LABEL = { regular: 'PvP', pve: 'PvE', 'pvp-season': 'Seasonal' };

const portraits = J('tarkovdev/trader_portraits.json');
const wikiIdx = J('wiki/index.json');
const byQuest = wikiIdx.quests.reduce((a, q) => (a[q.id] = q, a), {});

// In-game records. Where one exists it OUTRANKS both other sources, it is not a
// third opinion, it is what they are describing.
const { loadObserved } = require('./observed_lib.js');
require('./raw_ready.js')(ROOT);
const observed = loadObserved(ROOT);
if (observed.unmatched.length) {
  console.log(`   ${observed.unmatched.length} observation(s) matched no quest: `
    + observed.unmatched.map((u) => u.name).join(', '));
}

const MAP_VARIANT = (n) => (n === 'Night Factory' ? 'Factory' : String(n || '').replace(/\s*21\+\s*$/, ''));
const wikiPage = (title) => {
  try { return fs.readFileSync(path.join(RAW, 'wiki', 'pages', String(title).replace(/[^\w.-]+/g, '_') + '.txt'), 'utf8'); }
  catch { return null; }
};
const strip = (s) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/\{\{[^}]*\}\}/g, '').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// Sub-bullets count, the wiki nests detail under a requirement, and a
// /^\*[^*]/ filter drops it. See the note in build_view.js.
const reqLines = (w) => {
  const m = /==\s*Requirements\s*==\s*\n([\s\S]*?)(?:\n==[^=]|$)/.exec(w || '');
  if (!m) return [];
  return m[1].split('\n').map((l) => l.trim()).filter((l) => /^\*+\s*\S/.test(l)).map((l) => strip(l.replace(/^\*+\s*/, '')));
};

// in-game trader order, which is not the order any API returns them in
const TRADER_ORDER = [
  ['Prapor', 'Therapist', 'Fence', 'Skier', 'Peacekeeper', 'Mechanic', 'Ragman', 'Jaeger', 'Ref'],
  ['BTR Driver', 'Lightkeeper'],
];
const ORDER_FLAT = TRADER_ORDER.flat();

// ---- which modes hold which quest id, so a node can say it is mode-only ------
// Map names, longest first, 'The Lab' is a prefix of 'The Labyrinth', and a
// shortest-first scan would tag every Labyrinth quest as a Lab quest.
const ALL_MAP_NAMES = (() => {
  const names = new Set();
  for (const mode of MODES) {
    const f = path.join(RAW, 'tarkovdev', `${mode}.maps_en.json`);
    if (!fs.existsSync(f)) continue;
    const m = (JSON.parse(fs.readFileSync(f, 'utf8')) || {}).data || {};
    for (const [k, v] of Object.entries(m)) if (/ Name$/.test(k)) names.add(MAP_VARIANT(v));
  }
  return [...names].filter(Boolean).sort((a, b) => b.length - a.length);
})();

// which maps the GAME names, read out of the observed objective text plus the
// header when the header is an actual map
const NOT_A_MAP = new Set(['Any location', 'Transition']);
function mapsNamedIn(obs) {
  const found = new Set();
  if (obs.location && !NOT_A_MAP.has(obs.location)) found.add(MAP_VARIANT(obs.location));
  for (const line of obs.objectives || []) {
    let rest = line;
    for (const n of ALL_MAP_NAMES) {
      if (rest.includes(n)) { found.add(n); rest = rest.split(n).join(' '); }
    }
  }
  return [...found];
}

const idsIn = {};
for (const mode of MODES) {
  idsIn[mode] = new Set(Object.keys((J(`tarkovdev/${mode}.tasks.json`).data || {}).tasks || {}));
}
const modesOf = (id) => MODES.filter((m) => idsIn[m].has(id));

function questsFor(mode) {
  const td = J(`tarkovdev/${mode}.tasks.json`);
  const en = (J(`tarkovdev/${mode}.tasks_en.json`) || {}).data || {};
  const mapsEn = (J(`tarkovdev/${mode}.maps_en.json`) || {}).data || {};
  const tradersEn = (J(`tarkovdev/${mode}.traders_en.json`) || {}).data || {};
  // Trimmed: pve serves "Arena Business\n" where regular serves
  // "Arena Business". Untrimmed it fails the equality against its own wiki
  // title and draws a spurious "was …" line under the name.
  const L = (v) => {
    const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v;
    return typeof r === 'string' ? r.trim() : r;
  };
  const MAPN = (id) => (typeof id === 'string' && mapsEn[`${id} Name`] ? MAP_VARIANT(mapsEn[`${id} Name`]) : null);
  const TRADERN = (id) => (typeof id === 'string' ? (tradersEn[`${id} Nickname`] || '').trim() || null : null);

  const quests = new Map();
  for (const [id, t] of Object.entries((td.data && td.data.tasks) || {})) {
    const wq = byQuest[id] || {};
    const w = wq.page ? wikiPage(wq.page) : null;
    const req = reqLines(w);

    const devName = L(t.name);
    // the wiki's title is the CURRENT name; tarkov.dev still publishes the old
    // one. The [PVP/PVE ZONE] tag is tarkov.dev's, not part of the quest's name
    //, the wiki has one page for both, so it is carried over rather than lost,
    // otherwise the two mode variants render as the same box.
    const zone = ((/\[(?:PVP|PVE) ZONE\]/.exec(devName) || [])[0]) || '';
    const wikiTitle = wq.page && wq.page !== devName ? (zone ? `${wq.page} ${zone}` : wq.page) : null;
    const obs = observed.byId.get(id) || null;
    // The observed name outranks the wiki title, and not only because it is
    // more current: two quests can share ONE wiki page. Both halves of
    // "Glory to CPSU" resolve to the Part 1 page, so titling by the wiki drew two
    // identical boxes in the same tree.
    // BEAR/USEC variants are genuinely two quests with one name, in the game and
    // in every source. On a tree that is two identical boxes, so the faction is
    // part of the label.
    const faction = t.factionName && t.factionName !== 'Any' ? t.factionName : null;
    const base = (obs && obs.name) || wikiTitle || devName;
    const name = faction ? `${base} (${faction})` : base;

    const loyWiki = req.map((l) => /must be loyalty level\s*(\d+)/i.exec(l)).filter(Boolean).map((m) => +m[1]);
    const loyDev = (t.traderRequirements || []).filter((r) => r.requirementType === 'level').map((r) => r.value);
    const lvlWiki = req.map((l) => /must be level\s*(\d+)/i.exec(l)).filter(Boolean).map((m) => +m[1]);

    const mine = modesOf(id);
    // The observation WINS. LL1 is the baseline, so a quest seen at LL1 has no
    // loyalty gate and the badge must disappear, not fall back to whatever the
    // wiki or tarkov.dev claims. Shaking Up the Teller is exactly this case:
    // tarkov.dev says LL2, the game offers it at LL1.
    const obsLoy = obs && obs.availableAtLoyalty != null ? obs.availableAtLoyalty : null;
    const srcLoy = (loyWiki[0] ?? loyDev[0]) ?? null;
    const loyalty = obsLoy != null ? (obsLoy > 1 ? obsLoy : null) : srcLoy;

    // The observation outranks for LOCATION too, but THE HEADER IS NOT THE
    // CLAIM. "Any location" and "Transition" are categories, not maps, and
    // comparing them against a map name flags five multi-map quests that agree
    // perfectly. The maps the game actually names are in the OBJECTIVE TEXT.
    // Only a disjoint set is a contradiction: Easy-Breezy names Reserve and
    // Lighthouse where tarkov.dev says Factory.
    const srcMaps = [...new Set([MAPN(t.map),
      ...(t.objectives || []).flatMap((o) => (o.maps || []).map(MAPN))].filter(Boolean))];
    // Not on a line whose name no longer identifies a record. The Punisher's
    // parts were renumbered, so the observation attached to "Part 1" is being
    // compared with the record for a different quest, and that produced three
    // confident "wrong map" tags that were purely an artefact of the mispairing.
    const obsMaps = (obs && !obs.lineSuspect) ? mapsNamedIn(obs) : [];
    const disjoint = obsMaps.length && srcMaps.length && !obsMaps.some((m) => srcMaps.includes(m));
    // keep the source map when they agree, so box widths stay stable; show the
    // game's list only when it is the thing worth reading
    const mapShown = disjoint ? obsMaps.join(', ') : (srcMaps[0] || null);

    const clashes = [];
    if (obsLoy != null && srcLoy != null && srcLoy !== obsLoy && !(obsLoy === 1 && srcLoy <= 1)) {
      clashes.push(`sources said LL${srcLoy}`);
    }
    if (disjoint) clashes.push(`sources said ${srcMaps.join(', ')}`);
    const srcTrader = TRADERN(t.trader);
    if (obs && obs.trader && srcTrader && obs.trader !== srcTrader) clashes.push(`sources file it under ${srcTrader}`);

    quests.set(id, {
      id, name, devName: devName !== name ? devName : null,
      // The GAME decides which trader a quest belongs to. Polikhim Hobo is
      // published under Prapor and listed in game under Skier; filing it by the
      // source drew it in a tree the player will never see it in.
      trader: (obs && obs.trader) || TRADERN(t.trader) || 'Unknown',
      traderId: t.trader,
      map: mapShown,
      level: t.minPlayerLevel || lvlWiki[0] || null,
      loyalty,
      // what the game itself showed, and every source claim it contradicts
      observed: obs ? {
        loyalty: obsLoy, location: obs.location, status: obs.status,
        at: obs.observedAt,
        contradicts: clashes.length ? clashes.join(' · ') : null,
      } : null,
      kappa: !!t.kappaRequired, lightkeeper: !!t.lightkeeperRequired,
      prereq: (t.taskRequirements || []).map((r) => r.task).filter(Boolean),
      // only recorded when it is not in every mode, most quests are
      only: mine.length < MODES.length ? mine : null,
    });
  }
  return quests;
}

// ---- group by trader, layer by prerequisite depth ---------------------------
//
// This emits ORDERED LAYERS, not coordinates. Box width has to fit the longest
// quest name, and the only place a string's rendered width is knowable is the
// browser that renders it, estimating from character counts is how you get a
// box that is right for "Debut" and clips "Gunsmith - Old Friend's Request".
// So the graph work (depth, crossing reduction) happens here and the geometry
// happens in the page, after measuring.
function treesFor(quests) {
  const traders = new Map();
  for (const q of quests.values()) {
    if (!traders.has(q.trader)) traders.set(q.trader, { name: q.trader, id: null, quests: [] });
    traders.get(q.trader).quests.push(q);
  }
  // Take the group's MOST COMMON traderId, not the first quest's. A quest that
  // moved trader keeps the publishing trader's id, so if it happened to be sorted
  // first it would hand Skier's tree Prapor's portrait.
  for (const tr of traders.values()) {
    const votes = new Map();
    for (const q of tr.quests) if (q.traderId) votes.set(q.traderId, (votes.get(q.traderId) || 0) + 1);
    tr.id = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  const out = [];
  for (const tr of traders.values()) {
    const ids = new Set(tr.quests.map((q) => q.id));
    const depth = new Map();
    const dep = (id, seen = new Set()) => {
      if (depth.has(id)) return depth.get(id);
      if (seen.has(id)) return 0;                     // cycle guard; upstream data is not a proof
      seen.add(id);
      const q = quests.get(id);
      const own = (q.prereq || []).filter((p) => ids.has(p));
      const d = own.length ? 1 + Math.max(...own.map((p) => dep(p, seen))) : 0;
      depth.set(id, d);
      return d;
    };
    tr.quests.forEach((q) => dep(q.id));

    const layers = [];
    for (const q of tr.quests) {
      const d = depth.get(q.id) || 0;
      (layers[d] = layers[d] || []).push(q);
    }
    // reduce crossings: order each layer by the average x of its parents
    const pos = new Map();
    layers.forEach((layer, d) => {
      if (d > 0) {
        layer.sort((a, b) => {
          const bary = (q) => {
            const ps = (q.prereq || []).filter((p) => ids.has(p) && pos.has(p));
            return ps.length ? ps.reduce((s, p) => s + pos.get(p), 0) / ps.length : 1e9;
          };
          return bary(a) - bary(b) || a.name.localeCompare(b.name);
        });
      } else layer.sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name));
      layer.forEach((q, i) => pos.set(q.id, i));
    });

    const nodes = [];
    layers.forEach((layer, d) => layer.forEach((q, i) => nodes.push({ ...q, layer: d, slot: i })));

    // edges: within this trader only
    const at = new Map(nodes.map((n) => [n.id, n]));
    const edges = [];
    for (const n of nodes) {
      for (const p of n.prereq || []) {
        if (at.has(p)) edges.push({ from: p, to: n.id });
      }
    }
    // where a quest of THIS trader unlocks one belonging to another
    for (const n of nodes) {
      const onward = [...quests.values()].filter((q) => q.trader !== tr.name && (q.prereq || []).includes(n.id));
      if (onward.length) n.continues = [...new Set(onward.map((q) => q.trader))];
    }
    out.push({
      name: tr.name, id: tr.id,
      count: nodes.length, rows: layers.length,
      widest: Math.max(...layers.map((l) => l.length), 1),
      layerSizes: layers.map((l) => l.length),
      nodes, edges,
    });
  }
  // in-game order, with anything unexpected appended rather than dropped
  out.sort((a, b) => {
    const ia = ORDER_FLAT.indexOf(a.name), ib = ORDER_FLAT.indexOf(b.name);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });
  const unknown = out.filter((t) => !ORDER_FLAT.includes(t.name)).map((t) => t.name);
  if (unknown.length) console.log(`   not in the in-game order list, appended: ${unknown.join(', ')}`);
  // Two INDISTINGUISHABLE boxes in one tree are a real defect, several ids can
  // share one wiki page. The comparison is on everything the box shows, because a
  // shared title that carries a different "was …" line still reads apart; only a
  // full collision is unreadable.
  for (const t of out) {
    const seen = new Map();
    for (const n of t.nodes) {
      // everything the box actually renders - a shared title still reads apart
      // when the level, map or "was ..." line differs
      const label = [n.name, n.devName, n.map, n.loyalty, n.level].join(' | ');
      if (!seen.has(label)) seen.set(label, []);
      seen.get(label).push(n.name);
    }
    for (const [, group] of seen) {
      if (group.length > 1) console.log(`   [dup] ${t.name}: ${group.length} boxes render identically - "${group[0]}"`);
    }
  }
  return out;
}

const byMode = {};
const usedTraders = new Set();
for (const mode of MODES) {
  byMode[mode] = treesFor(questsFor(mode));
  byMode[mode].forEach((t) => usedTraders.add(t.id));
}

const data = {
  generated: new Date().toISOString(),
  modes: MODES, modeLabels: MODE_LABEL, traderRows: TRADER_ORDER,
  portraits: Object.fromEntries([...usedTraders].filter((id) => portraits[id]).map((id) => [id, portraits[id]])),
  byMode,
};
const html = fs.readFileSync(path.join(__dirname, 'tree_template.html'), 'utf8').replace('/*DATA*/', () => JSON.stringify(data));
fs.mkdirSync(path.join(ROOT, 'view'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'view', 'tree.html'), html, 'utf8');

console.log(`view/tree.html  ${(html.length / 1024 / 1024).toFixed(1)} MB  ${MODES.length} mode(s)`);
for (const mode of MODES) {
  const trees = byMode[mode];
  const total = trees.reduce((s, t) => s + t.count, 0);
  const only = trees.reduce((s, t) => s + t.nodes.filter((n) => n.only).length, 0);
  console.log(`\n   ${MODE_LABEL[mode]}, ${total} quests across ${trees.length} traders`
    + (only ? `, ${only} of them in no other mode` : ''));
  for (const t of trees) {
    const cross = t.nodes.filter((n) => n.continues).length;
    const longest = t.nodes.reduce((a, n) => (n.name.length > a.length ? n.name : a), '');
    console.log(`     ${t.name.padEnd(13)} ${String(t.count).padStart(3)} quests, ${t.edges.length} edge(s), `
      + `${t.rows} row(s), widest row ${t.widest}${cross ? `, ${cross} onward` : ''}`
      + `${data.portraits[t.id] ? '' : '  [no portrait]'}   longest: "${longest}"`);
  }
}
