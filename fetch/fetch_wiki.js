// The wiki half of the collector. Two things make this more than "download 510
// pages":
//
// 1. BATCHED. MediaWiki takes up to 50 titles per query, so this is about 11
//    requests instead of 510. Politer, faster, and far less likely to be rate
//    limited into writing junk.
//
// 2. IT RECOVERS DELETED REDIRECTS. Patch 1.1.0 renamed about 91 quests and
//    tarkov.dev still publishes every OLD name, so a lookup by the name the API
//    gives you lands on a redirect. `redirects=1` follows the ones that still
//    exist, but editors are DELETING them (21 gone by 2026-08-07, 24 by
//    08-10), and a deleted redirect is just a missing page. MediaWiki records
//    what a page held when it was blanked, so the change log still carries
//    `content was: "#REDIRECT [[New Name]]"`. That log is queried for every
//    title that came back missing, and the new title fetched instead.
//
//    This matters for the foundation: without it the 24 renamed-and-deleted
//    quests contribute nothing, and those are exactly the ones 1.1.0 changed
//    most. It is also all WIKI data, the wiki's own move history, so nothing
//    of ours leaks into the baseline.
'use strict';
const fs = require('fs');
const path = require('path');

const API = 'https://escapefromtarkov.fandom.com/api.php';
const safe = (n) => n.replace(/[^\w.-]+/g, '_');
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function run({ get, save, RAW }) {
  console.log('\nwiki (escapefromtarkov.fandom.com)');

  // Titles come from tarkov.dev's task list, an external source, not ours.
  //
  // From ALL THREE game modes, not just regular. The modes do not hold the
  // same quests: the 23 Arena crossover quests exist once per mode under
  // DIFFERENT ids ("… [PVP ZONE]" in regular, "… [PVE ZONE]" in pve), so an
  // index built from regular alone leaves every PvE-only id with no wiki page, // which reads as "the wiki does not cover this quest" when in truth nobody
  // ever asked. The zone tag is stripped, so both ids land on the one page the
  // wiki actually has, and the fetch cost is unchanged.
  const modes = ['regular', 'pve', 'pvp-season'];
  const titles = [];
  const unresolved = [];
  const seen = new Set();
  for (const mode of modes) {
    const tdPath = path.join(RAW, 'tarkovdev', `${mode}.tasks.json`);
    const enPath = path.join(RAW, 'tarkovdev', `${mode}.tasks_en.json`);
    if (!fs.existsSync(tdPath) || !fs.existsSync(enPath)) {
      if (mode === 'regular') throw new Error('run the tarkovdev source first, wiki titles come from its task list');
      console.log(`   (no ${mode} task list on disk, skipping it for titles)`);
      continue;
    }
    const tasks = JSON.parse(fs.readFileSync(tdPath, 'utf8'));
    // The locale file nests under `data`, and its key is the whole placeholder
    // ("<id> name"), not the bare id, `t.name` IS that placeholder. Reading the
    // file's top level instead hands back 510 unresolved keys, which then look
    // like 510 quests with no wiki page.
    const en = (JSON.parse(fs.readFileSync(enPath, 'utf8')) || {}).data || {};
    for (const [id, t] of Object.entries((tasks.data && tasks.data.tasks) || {})) {
      if (seen.has(id)) continue;
      seen.add(id);
      const nm = en[t.name];
      if (!nm) { unresolved.push(id); continue; }
      titles.push({ id, mode, title: String(nm).replace(/\s*\[(PVP|PVE) ZONE\]\s*/gi, '').trim() });
    }
  }
  if (unresolved.length) console.log(`   ${unresolved.length} task name(s) did not resolve to English, skipped`);
  if (!titles.length) throw new Error('no quest titles resolved, the locale lookup is wrong, refusing to record an empty wiki');
  const distinct = new Set(titles.map((t) => t.title));
  console.log(`   ${titles.length} quest id(s) across ${modes.length} mode(s) -> ${distinct.size} distinct title(s) to look up`);

  const pages = new Map();          // resolved title -> wikitext
  const edited = new Map();         // resolved title -> ISO date of its last edit
  const resolved = {};              // asked title -> what it actually resolved to
  const missing = [];
  const notAQuest = [];             // titles that exist but belong to a map/skill

  const fetchTitles = async (list) => {
    for (const group of chunk(list, 50)) {
      // `timestamp` rides along in the SAME request as the content, the last
      // edit date is what decides a wiki-vs-tarkov.dev tie, and asking for it
      // separately would double the round trips for nothing.
      const url = `${API}?action=query&prop=revisions&rvslots=main&rvprop=content|timestamp`
        + `&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(group.join('|'))}`;
      const j = await get(url);
      const q = j.query || {};
      for (const r of q.redirects || []) resolved[r.from] = r.to;
      for (const n of q.normalized || []) resolved[n.from] = resolved[n.from] || n.to;
      for (const p of q.pages || []) {
        if (p.missing) { missing.push(p.title); continue; }
        const rev = (p.revisions || [])[0] || {};
        const txt = (rev.slots || {}).main;
        const body = txt && typeof txt.content === 'string' ? txt.content : null;
        if (!body) { missing.push(p.title); continue; }   // never store an empty page
        // A QUEST CAN SHARE ITS NAME WITH A MAP OR A SKILL, and the wiki hands
        // back whichever page owns the title. Three got in this way: "Reserve"
        // (the map), "Immunity" (a skill) and "First Aid (skill)". A page with no
        // {{Infobox quest}} is not this quest's page, and storing it is worse
        // than storing nothing, it makes the wiki look stale or wrong about a
        // quest it was never asked about. Immunity's "last edited 2026-05-18"
        // read as a stale quest page when it is a perfectly current skill page.
        if (!/\{\{\s*Infobox quest/i.test(body)) { notAQuest.push(p.title); continue; }
        pages.set(p.title, body);
        if (rev.timestamp) edited.set(p.title, rev.timestamp);
      }
      await new Promise((res) => setTimeout(res, 250));
    }
  };

  await fetchTitles([...distinct]);
  console.log(`   ${pages.size} page(s) fetched, ${missing.length} missing after following live redirects`);

  // ---- recover renames from the wiki's own history, two ways
  //
  // The MOVE LOG is the better source and is tried first: it states old -> new
  // explicitly, it is what a rename actually is, and it reaches back as far as
  // the wiki keeps logs. The deletion-comment trick below only reaches about 30 days
  // (recentchanges) and depends on a comment format, so it is the fallback for
  // moves whose log entry has aged out.
  let recovered = 0;
  if (missing.length) {
    const deleted = new Map();      // old title -> what it points at now
    let lecont = null;
    for (let i = 0; i < 12; i++) {
      const url = `${API}?action=query&list=logevents&letype=move&lelimit=500`
        + `&leprop=title|details|timestamp&format=json&formatversion=2`
        + (lecont ? `&lecontinue=${encodeURIComponent(lecont)}` : '');
      const j = await get(url);
      for (const e of (j.query || {}).logevents || []) {
        const to = (e.params && (e.params.target_title || e.params.new_title)) || null;
        if (e.title && to && !deleted.has(e.title)) deleted.set(e.title, to);
      }
      lecont = ((j.continue || {}).lecontinue) || null;
      if (!lecont) break;
    }
    console.log(`   move log holds ${deleted.size} rename(s)`);
    let cont = null;
    for (let i = 0; i < 12; i++) {
      const url = `${API}?action=query&list=recentchanges&rcnamespace=0&rclimit=500`
        + `&rcprop=title|timestamp|comment&format=json&formatversion=2`
        + (cont ? `&rccontinue=${encodeURIComponent(cont)}` : '');
      const j = await get(url);
      for (const c of (j.query || {}).recentchanges || []) {
        const m = /content was:\s*"?#\s*REDIRECT\s*\[\[([^\]|#]+)/i.exec(c.comment || '');
        if (m && !deleted.has(c.title)) deleted.set(c.title, m[1].trim());
      }
      cont = ((j.continue || {}).rccontinue) || null;
      if (!cont) break;
    }
    console.log(`   change log holds ${deleted.size} deleted redirect(s)`);
    // Follow chains: "Spa Tour. Part 1" -> "Spa Tour - Part 1" -> "One-Way Ticket".
    //
    // BUT DO NOT RUN TO THE END OF THE CHAIN. The move log records EVERY page
    // move, so a chain can hop from one page's move onto a different page's. The
    // quest "Ambulance" was renamed to "First Aid"; separately, the SKILL page
    // "First Aid" was moved to "First Aid (skill)" to make room for it. Chasing to
    // the end took the quest all the way to the skill page, and we cached
    // {{Infobox skill}} as a quest's wiki data, wrong name, wrong objectives,
    // silently. Every hop is fetched and the NEAREST one that actually exists wins.
    const chainOf = (t) => {
      const out = [];
      let cur = t;
      for (let i = 0; i < 5 && deleted.has(cur); i++) {
        cur = deleted.get(cur);
        if (!cur || out.includes(cur)) break;
        out.push(cur);
      }
      return out;
    };
    const chains = new Map();
    const retry = [];
    for (const t of missing) {
      const c = chainOf(t);
      if (c.length) { chains.set(t, c); retry.push(...c); }
    }
    if (retry.length) {
      const before = pages.size;
      await fetchTitles([...new Set(retry)]);
      recovered = pages.size - before;
      let nearer = 0;
      for (const [t, c] of chains) {
        const hit = c.find((x) => pages.has(resolved[x] || x));
        if (!hit) continue;
        if (hit !== c[c.length - 1]) nearer++;
        resolved[t] = resolved[hit] || hit;
      }
      console.log(`   recovered ${recovered} page(s) via deleted redirects`);
      if (nearer) console.log(`   ${nearer} title(s) stopped at a NEARER hop than the end of their chain`);
    }
  }

  // Same rule as every other fetch: a run that collected nothing is a failure,
  // not a result. Writing an index saying "0 pages" would look like an answer.
  if (!pages.size) throw new Error(`fetched 0 pages from ${titles.length} titles, refusing to write an empty wiki index`);

  const dir = path.join(RAW, 'wiki', 'pages');
  fs.mkdirSync(dir, { recursive: true });
  // A rejected page that was stored by an earlier run is still on disk, and every
  // reader finds it by filename, so rejecting it here without deleting it there
  // changes nothing at all.
  for (const t of notAQuest) { try { fs.unlinkSync(path.join(dir, safe(t) + '.txt')); } catch {} }
  for (const [title, body] of pages) fs.writeFileSync(path.join(dir, safe(title) + '.txt'), body, 'utf8');

  const stillMissing = [...new Set(titles.filter((t) => !pages.has(resolved[t.title] || t.title)).map((t) => t.title))];
  save('wiki', 'index.json', {
    fetchedAt: new Date().toISOString(),
    askedFor: distinct.size,
    askedForIds: titles.length,
    pagesStored: pages.size,
    // the wiki's own answer to "what is this quest called now"
    resolvedTitles: resolved,
    recoveredFromDeletedRedirects: recovered,
    stillMissing,
    // `mode` is the first game mode this id was seen in, kept so it is obvious
    // why an id exists at all when it is absent from the regular task list
    // `edited` is the page's last revision date. It is the tiebreak when the wiki
    // and tarkov.dev disagree and there is no observation to settle it: the
    // more recently touched source wins. tarkov.dev publishes no per-task date at
    // all, so this is the only real date in the project.
    quests: titles.map((t) => {
      const page = resolved[t.title] || t.title;
      return { id: t.id, mode: t.mode, asked: t.title, page, edited: edited.get(page) || null };
    }),
  }, { url: API, records: pages.size, note: `${stillMissing.length} title(s) have no page at all` });

  console.log(`   stored ${pages.size} page(s) in raw/wiki/pages/`);
  if (notAQuest.length) console.log(`   ${notAQuest.length} title(s) resolved to a NON-QUEST page and were rejected: ${notAQuest.join(', ')}`);
  if (stillMissing.length) console.log(`   ${stillMissing.length} quest(s) still have no page: ${stillMissing.slice(0, 6).join(', ')}${stillMissing.length > 6 ? '…' : ''}`);
}

module.exports = { run };
