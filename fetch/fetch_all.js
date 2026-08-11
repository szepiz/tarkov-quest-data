// Collect every publicly available source of Escape from Tarkov quest data into
// raw/, untouched, with provenance. This is the FOUNDATION: nothing here is our
// own data, nothing is corrected, nothing is merged. Each file lands exactly as
// its source served it, and MANIFEST.json records where it came from, when, how
// big it was and how many records it held.
//
//   node fetch/fetch_all.js            fetch everything
//   node fetch/fetch_all.js --only=wiki,spt
//
// SOURCES, and why each one is here:
//   tarkovdev  json.tarkov.dev, what almost every tool builds on. Three game
//              modes; string fields are locale KEYS, resolved by the _en files.
//   overlay    tarkovtracker-org/tarkov-data-overlay, the community correction
//              layer. BOTH the published dist AND the src/ files, because the
//              source runs ahead of the build (renames merged 2026-08-09 are
//              not in a dist generated 2026-08-04).
//   wiki       escapefromtarkov.fandom.com, the only source that tracks patch
//              1.1.0 in anything like real time, because people edit it.
//   spt        sp-tarkov/server, carries BSG's OWN condition schema
//              (conditionType: TraderLoyalty / Level / Quest / TraderStanding),
//              which no public API exposes. Its quests.json has not been
//              touched since March 2025, so it is a SCHEMA reference and a
//              historical baseline, not current data. Recorded, not trusted.
//
// TarkovTracker itself is deliberately absent: its public API serves a user's
// own PROGRESS behind a token and publishes no quest data, theirs is
// tarkov.dev plus the overlay, both already collected here.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const UA = 'tarkov-quest-data collector (+https://github.com/szepiz/tarkov-quest-data)';

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (name) => !only.length || only.includes(name);

const manifest = { generated: new Date().toISOString(), sources: {} };
const failures = [];

// A FAILED FETCH MUST NEVER BE WRITTEN AS THOUGH IT WERE AN ANSWER. An empty
// file is indistinguishable from "this exists and is empty", and once on disk it
// is believed forever. Non-200, a MediaWiki `error` object (which arrives with
// HTTP **200**), and an empty body are all failures: reported, never saved.
async function get(url, { json = true, tries = 3 } = {}) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.status !== 200) { if (i === tries) throw new Error(`HTTP ${r.status}`); continue; }
      const text = await r.text();
      if (!text) { if (i === tries) throw new Error('empty body'); continue; }
      if (!json) return text;
      const j = JSON.parse(text);
      if (j && j.error) throw new Error(`API error ${j.error.code || ''}`.trim());
      return j;
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((res) => setTimeout(res, 400 * i));
    }
  }
  throw new Error('unreachable');
}

function save(source, file, data, meta) {
  const dir = path.join(RAW, source);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, file);
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  fs.writeFileSync(p, body, 'utf8');
  (manifest.sources[source] = manifest.sources[source] || { files: [] }).files.push({
    file, bytes: body.length, fetchedAt: new Date().toISOString(), ...meta,
  });
  console.log(`   ${(body.length / 1024).toFixed(0).padStart(6)} KB  ${source}/${file}`
    + (meta && meta.records != null ? `   ${meta.records} record(s)` : ''));
}

// ---------------------------------------------------------------- tarkov.dev
async function fetchTarkovDev() {
  console.log('\ntarkov.dev (json.tarkov.dev)');
  const base = 'https://json.tarkov.dev/';
  const modes = ['regular', 'pve', 'pvp-season'];
  for (const mode of modes) {
    const tasks = await get(base + `${mode}/tasks`);
    const n = Object.keys((tasks.data && tasks.data.tasks) || {}).length;
    save('tarkovdev', `${mode}.tasks.json`, tasks, { url: base + `${mode}/tasks`, records: n });
    for (const f of ['tasks_en', 'maps_en', 'traders_en']) {
      const j = await get(base + `${mode}/${f}`);
      save('tarkovdev', `${mode}.${f}.json`, j, { url: base + `${mode}/${f}`, records: Object.keys(j).length });
    }
  }
  // trader portraits, by id. Stored as base64 so anything built from raw/ stays
  // a single self-contained file that works offline.
  const traders = (JSON.parse(fs.readFileSync(path.join(RAW, 'tarkovdev', 'regular.traders_en.json'), 'utf8')) || {}).data || {};
  const ids = [...new Set(Object.keys(traders).filter((k) => / Nickname$/.test(k)).map((k) => k.split(' ')[0]))];
  const portraits = {};
  for (const id of ids) {
    try {
      const r = await fetch(`https://assets.tarkov.dev/${id}.webp`, { headers: { 'User-Agent': UA } });
      if (r.status !== 200) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length) portraits[id] = `data:image/webp;base64,${buf.toString('base64')}`;
    } catch { /* a missing portrait is cosmetic; never fail the run for one */ }
  }
  save('tarkovdev', 'trader_portraits.json', portraits, {
    url: 'https://assets.tarkov.dev/<traderId>.webp', records: Object.keys(portraits).length,
  });

  // the map catalogue the whole ecosystem uses for artwork + coordinate frames
  const maps = await get('https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json');
  save('tarkovdev', 'maps.json', maps, {
    url: 'https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json',
    records: Array.isArray(maps) ? maps.length : Object.keys(maps).length,
  });
}

// ------------------------------------------------------------------- overlay
async function fetchOverlay() {
  console.log('\ntarkov-data-overlay (tarkovtracker-org)');
  const gh = 'https://raw.githubusercontent.com/tarkovtracker-org/tarkov-data-overlay/main/';
  const dist = await get(gh + 'dist/overlay.json');
  save('overlay', 'dist.overlay.json', dist, {
    url: gh + 'dist/overlay.json',
    records: Object.keys(dist.tasks || {}).length,
    note: `built ${(dist.$meta || {}).generated || '?'}, the SOURCE below runs ahead of this`,
  });
  // the source of truth for that build, which is more current than the build
  const tree = await get('https://api.github.com/repos/tarkovtracker-org/tarkov-data-overlay/git/trees/main?recursive=1');
  const srcFiles = (tree.tree || []).filter((f) => f.type === 'blob' && /^src\/.*\.json5?$/.test(f.path));
  for (const f of srcFiles) {
    const txt = await get(gh + f.path, { json: false });
    save('overlay', 'src.' + f.path.replace(/^src\//, '').replace(/\//g, '.'), txt, { url: gh + f.path });
  }
  const commits = await get('https://api.github.com/repos/tarkovtracker-org/tarkov-data-overlay/commits?per_page=30');
  save('overlay', 'commits.json', commits.map((c) => ({
    sha: c.sha, date: c.commit.author.date, message: c.commit.message.split('\n')[0],
  })), { url: 'github api: commits', records: commits.length });
}

// ----------------------------------------------------------------------- spt
async function fetchSpt() {
  console.log('\nSPT (sp-tarkov/server). BSG condition schema, historical');
  const u = 'https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/templates/quests.json';
  const q = await get(u);
  save('spt', 'quests.json', q, { url: u, records: Object.keys(q).length });
  const c = await get('https://api.github.com/repos/sp-tarkov/server/commits?path=project/assets/database/templates/quests.json&per_page=5');
  save('spt', 'commits.json', c.map((x) => ({ date: x.commit.author.date, message: x.commit.message.split('\n')[0] })),
    { url: 'github api: commits for quests.json', records: c.length,
      note: `last touched ${c[0] ? c[0].commit.author.date : '?'}, treat as a schema reference, not current data` });
}

module.exports = { get, save, manifest, failures, RAW, want, UA };

if (require.main === module) {
  (async () => {
    fs.mkdirSync(RAW, { recursive: true });
    const jobs = [['tarkovdev', fetchTarkovDev], ['overlay', fetchOverlay], ['spt', fetchSpt]];
    for (const [name, fn] of jobs) {
      if (!want(name)) continue;
      try { await fn(); } catch (e) { failures.push(`${name}: ${e.message}`); console.log(`   !! ${name} FAILED, ${e.message}`); }
    }
    if (want('wiki')) {
      try { await require('./fetch_wiki.js').run({ get, save, RAW }); }
      catch (e) { failures.push(`wiki: ${e.message}`); console.log(`   !! wiki FAILED, ${e.message}`); }
    }
    manifest.failures = failures;
    fs.writeFileSync(path.join(RAW, 'MANIFEST.json'), JSON.stringify(manifest, null, 1), 'utf8');
    console.log(`\nwrote raw/MANIFEST.json`);
    if (failures.length) { console.log(`\n!! ${failures.length} source(s) failed:`); failures.forEach((f) => console.log('   ' + f)); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
