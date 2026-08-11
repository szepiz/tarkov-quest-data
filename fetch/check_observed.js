// Grades every collected source against observed/, the in-game records.
//
// This is the first script in the repo that treats one input as MORE TRUE than
// another. Everywhere else the sources are laid side by side and the reader
// decides; here the game itself has spoken, so a source that disagrees with an
// observation is simply wrong and is reported as such.
//
// Writes observed/REPORT.md. Reads raw/ and observed/ only.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const OBS = path.join(ROOT, 'observed');
const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));
require('./raw_ready.js')(ROOT);

const MODES = ['regular', 'pve', 'pvp-season'];
const MODE_LABEL = { regular: 'PvP', pve: 'PvE', 'pvp-season': 'Seasonal' };
const MAP_VARIANT = (n) => (n === 'Night Factory' ? 'Factory' : String(n || '').replace(/\s*21\+\s*$/, ''));

const wikiIdx = J('wiki/index.json');
const spt = J('spt/quests.json');
const ov = J('overlay/dist.overlay.json');
const byId = wikiIdx.quests.reduce((a, q) => (a[q.id] = q, a), {});

function loadMode(mode) {
  const td = J(`tarkovdev/${mode}.tasks.json`);
  const en = (J(`tarkovdev/${mode}.tasks_en.json`) || {}).data || {};
  const mapsEn = (J(`tarkovdev/${mode}.maps_en.json`) || {}).data || {};
  const trEn = (J(`tarkovdev/${mode}.traders_en.json`) || {}).data || {};
  const L = (v) => { const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v; return typeof r === 'string' ? r.trim() : r; };
  const MAPN = (id) => (typeof id === 'string' && mapsEn[`${id} Name`] ? MAP_VARIANT(mapsEn[`${id} Name`]) : null);
  const tasks = (td.data && td.data.tasks) || {};
  const out = new Map();
  for (const [id, t] of Object.entries(tasks)) {
    out.set(id, {
      id,
      devName: L(t.name),
      wikiName: (byId[id] || {}).page || null,
      trader: (trEn[`${t.trader} Nickname`] || '').trim() || null,
      faction: t.factionName && t.factionName !== 'Any' ? t.factionName : null,
      map: MAPN(t.map),
      objMaps: [...new Set((t.objectives || []).flatMap((o) => (o.maps || []).map(MAPN).filter(Boolean)))],
      level: t.minPlayerLevel || null,
      loyalty: (t.traderRequirements || []).filter((r) => r.requirementType === 'level').map((r) => r.value),
      objectives: (t.objectives || []).map((o) => L(o.description)),
      prereq: (t.taskRequirements || []).map((r) => ({ id: r.task, name: tasks[r.task] ? L(tasks[r.task].name) : r.task, status: r.status || [] })),
    });
  }
  return out;
}
const M = Object.fromEntries(MODES.map((m) => [m, loadMode(m)]));

// The quest card's location header is not always a map: "Any location" for
// multi-map quests, "Transition" for transit ones.
const NOT_A_MAP_HEADER = new Set(['Any location', 'Transition']);

// Map names named in a line, matched case-insensitively and longest-first so
// "The Lab" cannot claim a line that says "The Labyrinth".
const mapsIn = (line) => {
  const found = [];
  let rest = String(line || '');
  for (const m of ALL_MAPS) {
    const i = rest.toLowerCase().indexOf(m.toLowerCase());
    if (i < 0) continue;
    found.push(m);
    rest = rest.slice(0, i) + ' '.repeat(m.length) + rest.slice(i + m.length);
  }
  return found;
};

// Map names, longest first, 'The Lab' is a prefix of 'The Labyrinth', so a
// shortest-first scan tags every Labyrinth line as a Lab line.
const ALL_MAPS = (() => {
  const names = new Set();
  for (const mode of MODES) {
    const f = path.join(RAW, 'tarkovdev', `${mode}.maps_en.json`);
    if (!fs.existsSync(f)) continue;
    const m = (JSON.parse(fs.readFileSync(f, 'utf8')) || {}).data || {};
    for (const [k, v] of Object.entries(m)) if (/ Name$/.test(k)) names.add(MAP_VARIANT(v));
  }
  return [...names].filter(Boolean).sort((a, b) => b.length - a.length);
})();

// ---- wiki text for the observed quest, by its CURRENT title
const wikiPage = (title) => {
  try { return fs.readFileSync(path.join(RAW, 'wiki', 'pages', String(title).replace(/[^\w.-]+/g, '_') + '.txt'), 'utf8'); }
  catch { return null; }
};
const strip = (s) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/\{\{[^}]*\}\}/g, '').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// SUB-BULLETS COUNT. The wiki writes optional objectives as second-level
// bullets ("** (''Optional'') …"), and a filter of /^\*[^*]/ drops every one of
// them, which then reads as the WIKI being short of objectives when it is the
// reader discarding lines. Bad Rep Evidence lost 2 of its 5 that way.
const section = (w, name) => {
  const m = new RegExp(`==\\s*${name}\\s*==\\s*\\n([\\s\\S]*?)(?:\\n==[^=]|$)`).exec(w || '');
  if (!m) return null;
  return m[1].split('\n').map((l) => l.trim()).filter((l) => /^\*+\s*\S/.test(l)).map((l) => strip(l.replace(/^\*+\s*/, '')));
};

// THE WIKI SAYS OUT LOUD WHICH QUESTS ARE GONE, and nothing here was asking.
// A removed quest keeps its page and gets a {{Historical content}} banner, 33
// pages carry it. Without reading it, a quest tarkov.dev still publishes but the
// owner has never seen reads as an open question, when the wiki settled it.
// Same class of miss as "the overlay is silent": a field in the cache, unread.
const wikiHistorical = (title) => /\{\{\s*Historical content/i.test(wikiPage(title) || '');
// Event-map quests are a second reason a live quest is invisible: Icebreaker is
// not in the normal rotation, so its quests never appear on a normal profile.
const wikiEventMap = (title) => {
  const m = /^\s*\|\s*location\s*=\s*(.+)$/im.exec(wikiPage(title) || '');
  const loc = m ? strip(m[1]) : '';
  return /Icebreaker/i.test(loc) ? loc : null;
};

// Match an observation to a quest id. The observed name is the CURRENT name, so
// the wiki title is tried first, tarkov.dev is still publishing pre-1.1.0 names
// and matching on those alone would report a live quest as "no source has it".
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// A PARTIAL NAME MATCH MUST NEVER PICK A WINNER ON ITS OWN. "Glory to CPSU"
// is a substring of BOTH "Glory to CPSU - Part 1" and "- Part 2"; taking the
// first hit chose Part 1, which then reported the wiki as wrong about a name it
// had right. An observation that cannot be resolved to exactly one quest is
// UNRESOLVED, and the fix is a `questId` on the record, not a cleverer guess.
function findId(o, trader) {
  if (o.questId) {
    const q = M.regular.get(o.questId) || M.pve.get(o.questId) || M['pvp-season'].get(o.questId);
    if (q) return { id: o.questId, matchedOn: 'questId stated on the observation' };
    return { ambiguous: [], missingId: o.questId };
  }
  const k = key(o.name);
  for (const mode of MODES) {
    for (const q of M[mode].values()) {
      if (key(q.wikiName) === k || key(q.devName) === k) {
        return { id: q.id, matchedOn: key(q.wikiName) === k ? 'wiki title' : 'tarkov.dev name' };
      }
    }
  }
  // near-misses, of the same trader. ALL of them, so ambiguity is visible
  const near = [];
  for (const q of M.regular.values()) {
    if (q.trader !== trader) continue;
    const a = key(q.devName), b = key(q.wikiName);
    if ((a && (a.includes(k) || k.includes(a))) || (b && (b.includes(k) || k.includes(b)))) near.push(q);
  }
  if (near.length === 1) return { id: near[0].id, matchedOn: 'partial name match. VERIFY' };
  if (near.length > 1) return { ambiguous: near };
  return null;
}

// ---- compare
const files = fs.readdirSync(OBS).filter((f) => f.endsWith('.json'));
const allDocs = files.map((f) => JSON.parse(fs.readFileSync(path.join(OBS, f), 'utf8')));

// Every observation, by quest id, so a prerequisite can be looked up by what the
// GAME says about it rather than by what a source claims.
const obsById = new Map();
for (const doc of allDocs) {
  for (const q of doc.quests) {
    const hit = findId(q, doc.trader);
    if (hit && hit.id) obsById.set(hit.id, { ...q, trader: doc.trader });
  }
}

// A prerequisite is printed under its CURRENT name, not the one tarkov.dev still
// publishes, with the loyalty level the game actually lists it at.
function prereqLine(r) {
  const parts = r.prereq.map((p) => {
    const q = M.regular.get(p.id) || M.pve.get(p.id);
    const now = (q && q.wikiName) || p.name;
    const renamed = now !== p.name ? ` (tarkov.dev: ${p.name})` : '';
    const st = (p.status || []).join(' or ') || '?';
    const po = obsById.get(p.id);
    // A quest is filed under a loyalty level OR a category, never both, so
    // this printed "seen in game at LLundefined" for every essential-group
    // prerequisite from the moment categories were introduced.
    const where = po
      ? (po.availableAtLoyalty != null ? `LL${po.availableAtLoyalty}` : (po.category || 'uncategorised'))
      : null;
    const seen = where ? `, seen in game at ${where}` : ', not observed yet';
    return `${now}${renamed} [${st}]${seen}`;
  });
  return `tarkov.dev also gates it behind: ${parts.join('; ')}`;
}

// AN EXACT NAME MATCH IS NOT PROOF OF IDENTITY. 1.1.0 RENUMBERED quest lines:
// the card the game calls "The Punisher - Part 1" carries the objectives
// tarkov.dev publishes under Part 3, Part 2's are under Part 1, and so on. The
// name matches perfectly, so nothing looked wrong, and the mismatched pair then
// produced three confident "tarkov.dev has the wrong map" findings that were
// entirely my own doing.
//
// So every match is checked against CONTENT. If a different quest of the same
// trader fits the observed objectives clearly better, the match is suspect and
// the fields derived from it (map, objective count) are not graded.
// Compare on DISTINCTIVE words only. Raw word overlap says "Debut" and
// "Shootout Picnic" are the same quest, because both read "Eliminate ... on
// Woods, Ground Zero, Interchange, or Customs" and that vocabulary is shared by
// half the trader's quests. What actually identifies a quest is its rare tokens
//, "aks", "74u", "akm", so words common across the trader are dropped first.
const words = (s) => String(s).toLowerCase().match(/[a-z0-9]+/g) || [];
const sigOf = (arr) => new Set(arr.flatMap(words));
const overlap = (a, b) => {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / (a.size + b.size - hit);
};

// ONLY COMPARE WITHIN A NUMBERED LINE. Scoring an observation against every
// quest of the trader produces confident nonsense, two earlier versions of this
// check "found" that Debut is really Shootout Picnic, and then that both are
// really Test Drive - Part 2, because Prapor's kill quests share almost all their
// vocabulary. Renumbering and merging happen INSIDE a line by definition, so the
// candidates are the other parts of that line and nothing else. That is a rule
// with no false-positive surface rather than a threshold that needs luck.
const lineOf = (name) => {
  const m = /^(.*?)\s*[-–]\s*Part\s+(\d+)\s*$/i.exec(String(name || ''));
  return m ? { base: m[1].trim().toLowerCase(), part: +m[2] } : { base: String(name || '').trim().toLowerCase(), part: null };
};

function contentCheck(o, r, trader) {
  if (!o.objectives || !o.objectives.length) return null;
  const mineLine = lineOf(o.name);
  const obs = sigOf(o.objectives);
  const mine = overlap(obs, sigOf(r.objectives));
  let best = null, bestScore = mine;
  for (const q of M.regular.values()) {
    if (q.id === r.id || q.trader !== trader) continue;
    // same line only, a different part of the same story, under either name
    const a = lineOf(q.devName), b = lineOf(q.wikiName);
    if (a.base !== mineLine.base && b.base !== mineLine.base) continue;
    const s = overlap(obs, sigOf(q.objectives));
    if (s > bestScore) { bestScore = s; best = q; }
  }
  if (best && bestScore > mine + 0.15) {
    return { better: best, betterScore: bestScore, matchedScore: mine, base: mineLine.base };
  }
  return null;
}

// If ANY part of a line is shuffled, no part of that line can be trusted to the
// record its name points at, including the ones with nothing captured to
// compare. The Punisher shows this: Part 3's objectives were never in frame, so
// content proves nothing about it, yet Parts 1 and 2 demonstrably moved, which
// makes Part 3's name→record pairing worthless too.
const shuffledLines = new Set();
const suspects = new Map();
for (const doc of allDocs) {
  for (const q of doc.quests) {
    // A HAND PIN ENDS THE ARGUMENT. The detector's job is to notice that a
    // name no longer identifies a record; a `questId` in observed/ is that
    // noticing already acted on, read off the objective text. Re-flagging a
    // pinned record only suppresses grading that now works, and because ONE
    // suspect part poisons its whole line, a single unpinned part would undo
    // every pin beside it.
    if (q.questId) continue;
    const hit = findId(q, doc.trader);
    if (!hit || !hit.id) continue;
    const rec = M.regular.get(hit.id) || M.pve.get(hit.id);
    if (!rec) continue;
    const s = contentCheck(q, rec, doc.trader);
    if (s) { suspects.set(q.name, s); shuffledLines.add(s.base); }
  }
}

// THE TEST THAT SETTLES WHETHER THE PUBLISHED CHAIN GATES ANYTHING.
// If tarkov.dev says quest A requires quest B, and the game lists A at a LOWER
// loyalty level than B, then A is reachable before B can be, so the chain
// cannot be what unlocks A. One such pair is a contradiction; several is a
// mechanism.
const chainBreaks = [];
function checkChain(o, r) {
  if (o.availableAtLoyalty == null) return;
  for (const p of r.prereq) {
    const po = obsById.get(p.id);
    if (!po || po.availableAtLoyalty == null) continue;
    if (po.availableAtLoyalty > o.availableAtLoyalty) {
      chainBreaks.push({ quest: o.name, at: o.availableAtLoyalty,
        prereq: po.name, prereqAt: po.availableAtLoyalty, status: (p.status || []).join(' or ') });
    }
  }
}
const lines = [];
const say = (s = '') => lines.push(s);
const findings = [];
let checked = 0, unmatched = 0;

// Per-source scorecard. A source is graded only on fields the observation
// actually pins down, and `silent` is kept separate from `wrong`, saying
// nothing is a gap, saying the wrong thing is an error, and collapsing the two
// flatters whichever source publishes least.
const SOURCES = ['tarkov.dev', 'overlay', 'wiki', 'SPT'];
const score = Object.fromEntries(SOURCES.map((s) => [s, { right: 0, wrong: 0, silent: 0 }]));
const grade = (src, verdict) => { if (score[src]) score[src][verdict]++; };

// The unverifiable stay out of the scorecard entirely, and are listed at the end
// so they are visible without being counted as either right or wrong.
const unverified = [];

// Quests whose list is short only because the game has not revealed the rest yet.
// Not an error on anyone's part, recorded so the shortfall is visible and so a
// later capture of the same quest, completed, can be checked against it.
const progressive = [];

say('# The sources, graded against the game');
say('');
say('Generated by `fetch/check_observed.js` from `observed/`. Every line under a');
say('quest is a source contradicting something read off the in-game quest screen.');
say('');
say('**Loyalty level 1 is the baseline every trader starts at**, so "available at');
say('LL1" means *no loyalty gate*, and a source publishing none is CORRECT rather');
say('than silent. Only a published requirement of LL2 or higher contradicts it.');
say('');

for (const doc of allDocs) {
  say(`## ${doc.trader}`);
  say(`_observed ${doc.observedAt}, game version ${doc.gameVersion}_`);
  say(``);
  say('');
  for (const o of doc.quests) {
    checked++;
    const hit = findId(o, doc.trader);
    if (!hit || !hit.id) {
      unmatched++;
      say(`### ${o.name}`);
      if (hit && hit.missingId) {
        findings.push({ q: o.name, what: `questId ${hit.missingId} is not in any source` });
        say(`- ⛔ the \`questId\` on this record (\`${hit.missingId}\`) matches no quest in any source`);
      } else if (hit && hit.ambiguous && hit.ambiguous.length) {
        findings.push({ q: o.name, what: `AMBIGUOUS, ${hit.ambiguous.length} candidates, needs a questId` });
        say(`- ⛔ **ambiguous**, the name matches ${hit.ambiguous.length} quests. Add a \`questId\` to resolve it:`);
        for (const c of hit.ambiguous) say(`  - \`${c.id}\`, ${c.devName}${c.wikiName && c.wikiName !== c.devName ? ` (wiki: ${c.wikiName})` : ''}`);
      } else {
        findings.push({ q: o.name, what: 'NO SOURCE HAS THIS QUEST under any name' });
        say('- ⛔ **no source has a quest by this name**, under either the tarkov.dev name or a wiki title');
      }
      say('');
      continue;
    }
    const r = M.regular.get(hit.id) || M.pve.get(hit.id);
    const w = r.wikiName ? wikiPage(r.wikiName) : null;
    const wObj = section(w, 'Objectives') || [];
    const wReq = section(w, 'Requirements') || [];
    const s = spt[hit.id];
    const ovName = (ov.tasks && ov.tasks[hit.id] && ov.tasks[hit.id].name) || null;

    const bad = [];

    // ---- name
    // The [PVE ZONE] / [PVP ZONE] tag is a MODE MARKER, not part of the quest's
    // name. The wiki keeps one page for both variants and titles it without the
    // tag, which is why fetch_wiki strips the tag to look pages up in the first
    // place. Comparing with the tag left on scores the wiki wrong for being
    // consistent with itself. Stripped here for GRADING only: the matcher must
    // keep it, or the PvE card would match the PvP id.
    const nameKey = (n) => key(String(n || '').replace(/\s*\[(?:PVP|PVE) ZONE\]\s*/gi, ' '));
    const nameSays = { 'tarkov.dev': r.devName, overlay: ovName, wiki: r.wikiName, SPT: s ? s.QuestName : null };
    for (const [src, said] of Object.entries(nameSays)) {
      if (!said) { grade(src, 'silent'); continue; }
      if (nameKey(said) === nameKey(o.name)) { grade(src, 'right'); continue; }
      grade(src, 'wrong');
      bad.push(`**name**, ${src} says \`${said}\``);
      if (src === 'tarkov.dev') findings.push({ q: o.name, what: `tarkov.dev still calls it "${said}"` });
    }

    // ---- trader
    if (r.trader) {
      grade('tarkov.dev', r.trader === doc.trader ? 'right' : 'wrong');
      if (r.trader !== doc.trader) {
        bad.push(`**trader**, tarkov.dev says \`${r.trader}\`, game says \`${doc.trader}\``);
        findings.push({ q: o.name, what: `trader: tarkov.dev says ${r.trader}, game says ${doc.trader}` });
      }
    } else grade('tarkov.dev', 'silent');
    if (s) {
      const sptTrader = s.traderId ? (M.regular.get(hit.id) || {}).trader : null;
      if (sptTrader) grade('SPT', sptTrader === doc.trader ? 'right' : 'wrong'); else grade('SPT', 'silent');
    } else grade('SPT', 'silent');

    // ---- is this even the same quest?
    const suspect = suspects.get(o.name)
      || (shuffledLines.has(lineOf(o.name).base) ? { sameLine: true } : null);
    if (suspect && suspect.sameLine) {
      bad.push('**not graded on map or objectives.** Another part of this line was'
        + ' matched to the wrong record by name, so the whole line is unreliable until'
        + ' the parts are pinned by id.');
    } else if (suspect) {
      findings.push({ q: o.name, what: `content matches another part of this line, "${suspect.better.devName}"` });
      bad.push(`**this may not be the same quest.** The objectives fit `
        + `\`${suspect.better.devName}\` (${(suspect.betterScore * 100).toFixed(0)}% word overlap) better than the `
        + `same-named \`${r.devName}\` (${(suspect.matchedScore * 100).toFixed(0)}%). 1.1.0 renumbered quest lines, `
        + `so an exact name match can pair the wrong records. **Map and objective count are not graded here.**`);
    }

    // ---- the overlay, on MAPS.
    // It was graded `silent` on every quest for most of this collection, which
    // read as "the overlay contributes nothing". That was the reader's fault: the
    // overlay is a correction layer, so it carries objectives and maps for the
    // handful of tasks it fixes and almost never a name, and name was the only
    // field being asked for. Its `objectives` is a PARTIAL map keyed by objective
    // id, so its length is not an objective count and must not be compared as one.
    // What is comparable is the maps it names.
    const ovEntry = (ov.tasks && ov.tasks[hit.id]) || null;
    if (ovEntry) {
      const ovMaps = [...new Set([
        ...(ovEntry.map && ovEntry.map.name ? [MAP_VARIANT(ovEntry.map.name)] : []),
        ...Object.values(ovEntry.objectives || {}).flatMap((o) => [
          ...(o.maps || []).map((m) => MAP_VARIANT(m && m.name)),
          ...ALL_MAPS.filter((m) => String(o.description || '').includes(m)),
        ]),
      ].filter(Boolean))];
      const gameMaps = [...new Set([
        ...(o.location && !NOT_A_MAP_HEADER.has(o.location) ? [MAP_VARIANT(o.location)] : []),
        ...(o.objectives || []).flatMap((l) => ALL_MAPS.filter((m) => String(l).includes(m))),
      ].filter(Boolean))];
      if (!ovMaps.length || !gameMaps.length) grade('overlay', 'silent');
      else {
        const agrees = ovMaps.some((m) => gameMaps.includes(m));
        grade('overlay', agrees ? 'right' : 'wrong');
        if (!agrees) {
          bad.push(`**map (overlay)**, the overlay names \`${ovMaps.join(', ')}\`, game says \`${gameMaps.join(', ')}\``);
          findings.push({ q: o.name, what: `overlay map: says ${ovMaps.join(', ')}, game says ${gameMaps.join(', ')}` });
        }
      }
    }

    // ---- map, only when the game named ONE MAP.
    // The header is not always a map. "Any location" is the obvious case, but
    // transit quests print "Transition", comparing that against a map list
    // scores every source wrong about a field they got right.
    const single = (!suspect && o.location && !NOT_A_MAP_HEADER.has(o.location)) ? o.location : null;
    if (single) {
      const devMaps = [...new Set([r.map, ...r.objMaps].filter(Boolean))];
      if (!devMaps.length) grade('tarkov.dev', 'silent');
      else {
        grade('tarkov.dev', devMaps.includes(single) ? 'right' : 'wrong');
        if (!devMaps.includes(single)) {
          bad.push(`**map**, game says \`${single}\`, tarkov.dev has \`${devMaps.join(', ')}\``);
          findings.push({ q: o.name, what: `map: game says ${single}, tarkov.dev says ${devMaps.join(', ')}` });
        }
      }
      // Naming NO map is silence, not error. The wiki writes No Swiping's
      // objective as "Eliminate any 10 enemies in the base area", it does not
      // claim a map at all, so it cannot be wrong about which one. Only a line
      // naming a DIFFERENT map is a contradiction.
      // Case-INSENSITIVE. The wiki writes "on reserve" in lowercase, and the
      // game itself writes "Streets of tarkov", a case-sensitive scan finds no
      // map, grades the source `silent`, and quietly under-reports it. That is how
      // the wiki's Reserve claim for The Huntsman Path - Administrator went
      // unnoticed while the game says Lighthouse and tarkov.dev says Streets.
      const wikiMaps = [...new Set(wObj.flatMap((l) => mapsIn(l)))];
      if (!wObj.length || !wikiMaps.length) grade('wiki', 'silent');
      else {
        const wikiHasMap = wikiMaps.includes(single);
        grade('wiki', wikiHasMap ? 'right' : 'wrong');
        if (!wikiHasMap) bad.push(`**map (wiki)**, wiki objectives name \`${wikiMaps.join(', ')}\`, game says \`${single}\``);
      }
    }

    // ---- objective count. Wording differs legitimately between sources; the
    // NUMBER of objectives does not.
    // Only when the whole list was actually seen. A screenshot cut off at the
    // bottom yields a LOWER BOUND, and grading a source against it manufactures
    // errors out of the crop.
    // AND ONLY ON A COMPLETED QUEST. The game reveals objectives progressively:
    // a step that depends on an earlier one is not printed until the earlier one
    // is done, which is why an active quest's hand-over line is missing until the
    // item is picked up (owner, 2026-08-11. Supply Plans and Paramedic are the
    // worked examples). So an unfinished quest's list is a lower bound for exactly
    // the same reason a cropped screenshot is, and grading it invents source
    // errors. Three statistical tests failed to find this rule in the data before
    // the answer came from the game itself.
    const partialByProgress = o.status !== 'completed';
    if (suspect) {
      unverified.push(`- **${o.name}**, objective count not graded: the record it was matched to`
        + ` (\`${r.devName}\`) may be a different quest. See the entry above.`);
    } else if (o.status === 'locked') {
      // NOT a gap in the capture. A locked quest prints a TASK UNLOCK
      // REQUIREMENTS panel where the objectives would go, so there is no list to
      // read and none to grade. Saying "re-shoot the full card" here sends the
      // owner after a screenshot that cannot exist.
      unverified.push(`- **${o.name}**. LOCKED, so the card shows unlock requirements instead of objectives.`
        + ` Nothing to grade until it unlocks.`);
    } else if (o.objectivesComplete === false) {
      unverified.push(`- **${o.name}**, objective list was cut off in the screenshot`
        + ` (${o.objectives.length} seen). Not graded; re-shoot the full card to settle it.`);
    } else if (partialByProgress) {
      if (wObj.length > o.objectives.length || r.objectives.length > o.objectives.length) {
        progressive.push(`- **${o.name}** (${doc.trader}, ${o.status}), game shows ${o.objectives.length}`
          + `, tarkov.dev ${r.objectives.length}${wObj.length ? `, wiki ${wObj.length}` : ''}`
          + `${(o.objectivesHidden || []).length ? `, hidden: ${o.objectivesHidden.join(', ')}` : ''}.`);
      }
    } else {
      grade('tarkov.dev', r.objectives.length === o.objectives.length ? 'right' : 'wrong');
      if (r.objectives.length !== o.objectives.length) {
        bad.push(`**objective count**, game shows ${o.objectives.length}, tarkov.dev has ${r.objectives.length}`
          + (wObj.length ? `, wiki ${wObj.length}${wObj.length === o.objectives.length ? ' ✔' : ''}` : ''));
        findings.push({ q: o.name, what: `objectives: game ${o.objectives.length}, tarkov.dev ${r.objectives.length}${wObj.length ? `, wiki ${wObj.length}` : ''}` });
      }
      if (!wObj.length) grade('wiki', 'silent');
      else {
        grade('wiki', wObj.length === o.objectives.length ? 'right' : 'wrong');
        if (wObj.length !== o.objectives.length) {
          bad.push(`**objective count (wiki)**, game shows ${o.objectives.length}, wiki has ${wObj.length}`);
        }
      }
    }

    // ---- loyalty. LL1 is the baseline: no gate is the CORRECT answer for it.
    if (o.availableAtLoyalty != null) {
      const obs = o.availableAtLoyalty;
      const pub = r.loyalty.length ? Math.max(...r.loyalty) : null;
      if (obs === 1) {
        if (pub == null || pub <= 1) grade('tarkov.dev', 'right');
        else {
          grade('tarkov.dev', 'wrong');
          bad.push(`**loyalty**, tarkov.dev requires \`LL${pub}\`, but the game had it available at LL1`);
          findings.push({ q: o.name, what: `loyalty: tarkov.dev says LL${pub}, game says LL1` });
        }
      } else if (pub == null) {
        grade('tarkov.dev', 'silent');
        bad.push(`**loyalty**, observed at LL${obs}; tarkov.dev publishes no loyalty requirement`);
      } else grade('tarkov.dev', pub === obs ? 'right' : 'wrong');

      const wLoy = wReq.map((l) => /loyalty level\s*(\d+)/i.exec(l)).filter(Boolean).map((m) => +m[1]);
      const wMax = wLoy.length ? Math.max(...wLoy) : null;
      if (obs === 1) {
        grade('wiki', wMax != null && wMax > 1 ? 'wrong' : 'right');
        if (wMax != null && wMax > 1) bad.push(`**loyalty (wiki)**, wiki requires \`LL${wMax}\`, game had it at LL1`);
      } else if (wMax == null) grade('wiki', 'silent');
      else {
        grade('wiki', wMax === obs ? 'right' : 'wrong');
        if (wMax !== obs) bad.push(`**loyalty (wiki)**, wiki says \`LL${wMax}\`, game lists it at LL${obs}`);
      }
    }

    // ---- claims this batch cannot settle either way
    if (r.level) {
      unverified.push(`- **${o.name}**, tarkov.dev claims minimum player level **${r.level}**.`
        + ' Not contradicted: the observation only proves the quest was reachable, and the'
        + ' profile was well above any of these levels.');
    }

    // What the game showed is stated on EVERY quest, agreement or not. A record
    // that only appears when something is wrong is not a record.
    // A quest is filed EITHER under a loyalty level or under a named category
    // (Prapor's "essential" group). Printing "LL null" for the latter would read
    // as missing data rather than as a different kind of filing.
    const filed = o.availableAtLoyalty != null
      ? `**${doc.trader} LL${o.availableAtLoyalty}**`
      : `**${doc.trader} ${o.category || 'uncategorised'}**`;
    const seen = [filed, o.status, o.location].filter(Boolean).join(' · ');

    checkChain(o, r);

    if (!bad.length) { say(`### ${o.name}`); say(`_every source agrees_`); say(`> in game: ${seen}`); say(''); continue; }
    say(`### ${o.name}`);
    say(`> in game: ${seen}`);
    say(`\`${hit.id}\` · matched on ${hit.matchedOn}`);
    for (const b of bad) say(`- ${b}`);
    if (r.prereq.length) say(`- ${prereqLine(r)}`);
    say('');
  }
}

if (chainBreaks.length) {
  say('## The published prerequisite chain does not gate these quests');
  say('');
  say('Each row is a quest the game offers at a loyalty level BELOW the one its');
  say('supposed prerequisite is offered at. You cannot have finished the');
  say('prerequisite before the quest becomes available, so the requirement cannot');
  say('be what unlocks it. This is what patch 1.1.0 changed, measured rather than');
  say('assumed.');
  say('');
  say('| quest | offered at | tarkov.dev requires | which is offered at |');
  say('|---|---|---|---|');
  for (const c of chainBreaks) {
    say(`| ${c.quest} | **LL${c.at}** | ${c.prereq} (${c.status}) | **LL${c.prereqAt}** |`);
  }
  say('');
}

say('## Scorecard');
say('');
say('Graded only on what the observations actually pin down. `silent` is not a');
say('mark against a source, it is a gap someone else has to fill.');
say('');
say('| source | right | wrong | silent | accuracy where it speaks |');
say('|---|---|---|---|---|');
for (const s of SOURCES) {
  const v = score[s], spoke = v.right + v.wrong;
  say(`| ${s} | ${v.right} | ${v.wrong} | ${v.silent} | ${spoke ? Math.round(100 * v.right / spoke) + '%' : ', '} |`);
}
say('');
say(`${checked} observed quest(s) checked, ${unmatched} matched no source at all.`);
if (unverified.length) {
  say('');
  say('## Claims this batch cannot settle');
  say('');
  for (const u of unverified) say(u);
}

fs.writeFileSync(path.join(OBS, 'REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log(`observed/REPORT.md written`);

// ---- observed/OPEN.md ------------------------------------------------------
// The register of everything still unresolved, to be worked through once the
// collection is complete. GENERATED, never hand-maintained: a list of open
// questions that has to be remembered to update is a list that quietly goes
// stale, and stale is worse than absent because it reads as settled.
const open = [];
const O = (s = '') => open.push(s);
O('# Open questions');
O('');
O('Generated by `fetch/check_observed.js`, do not edit by hand, it is rewritten');
O('on every run. Each item is something the collection cannot currently settle.');
O('');

const sectionOf = (title, items, empty, preamble) => {
  O(`## ${title}`);
  O('');
  if (!items.length) { O(`_${empty}_`); O(''); return; }
  // a preamble is prose, not a list item, bulleting it produced "- - **quest**"
  if (preamble) { O(preamble); O(''); }
  for (const i of items) O(`- ${i}`);
  O('');
};

// 1. quests no source has
sectionOf('Quests the game has and no source does',
  allDocs.flatMap((d) => d.quests.filter((q) => q.unknownToEverySource)
    .map((q) => `**${q.name}** (${d.trader}${q.availableAtLoyalty != null ? ` LL${q.availableAtLoyalty}` : ''}), ${q.unknownToEverySource}`)),
  'none');

// 2. lines whose name -> record pairing cannot be trusted
sectionOf('Quest lines where a name no longer identifies a record',
  [...shuffledLines].map((base) => {
    const s = [...suspects.entries()].filter(([, v]) => v.base === base);
    return `**${base}**, ${s.map(([n, v]) => `"${n}" fits \`${v.better.devName}\``).join('; ')}.`
      + ' Map and objective count are not graded for any part of this line until the parts are pinned by id.';
  }),
  'none');

// 3. records pinned by hand
sectionOf('Records pinned by hand with an explicit questId',
  allDocs.flatMap((d) => d.quests.filter((q) => q.questId)
    .map((q) => `**${q.name}** (${d.trader}) -> \`${q.questId}\`. ${q.questIdReason || 'No reason recorded.'}`)),
  'none');

// 4. questions written into the records themselves
sectionOf('Recorded open questions',
  allDocs.flatMap((d) => d.quests.flatMap((q) => [q.openQuestion, q.openQuestion2]
    .filter(Boolean).map((t) => `**${q.name}** (${d.trader}), ${t}`))),
  'none');

// captures the game itself marked as partial, a locked quest shows its unlock
// requirements instead of objectives, and that list can be longer than the frame
// Not open questions, the opposite. Kept in the register because each one is a
// quest whose full list is still worth capturing once it is finished.
sectionOf('Objectives the game has not revealed yet (NOT a source error)',
  progressive.map((s) => s.replace(/^- /, '')),
  'none, every unfinished quest shows as many objectives as the sources publish',
  '_The game prints a step only once the step it depends on is done, so an unfinished quest\'s list is a LOWER BOUND.'
  + ' None of these is graded. Re-capture any of them after completing it and the count becomes gradeable._');

sectionOf('Unlock requirements captured only in part',
  allDocs.flatMap((d) => d.quests.filter((q) => q.unlockRequirementsPartial)
    .map((q) => `**${q.name}** (${d.trader}, ${q.status}), ${(q.unlockRequirements || []).length} of an unknown total seen: `
      + (q.unlockRequirements || []).map((r) => `${r.trader} LL${r.level}${r.met ? ' ✓' : ''}`).join(', ')
      + '. The rest scrolled out of frame.')),
  'none');

// 5. merges, which are findings but still want a second look
sectionOf('Merges found (confirmed by content, but no source reflects them)',
  allDocs.flatMap((d) => d.quests.filter((q) => q.merged)
    .map((q) => `**${q.name}** (${d.trader}), ${q.merged}`)),
  'none');

// 5b. exclusive choices, a failed quest that is failed BY DESIGN
sectionOf('Mutually exclusive quests (a failure that is not a mistake)',
  allDocs.flatMap((d) => d.quests.filter((q) => q.mutuallyExclusive)
    .map((q) => `**${q.name}** (${d.trader}, ${q.status}), ${q.mutuallyExclusive}`)),
  'none found yet');

// 6. changed in ways a count or a name comparison cannot see
sectionOf('Changed beyond a rename: the correction layer must override content',
  allDocs.flatMap((d) => d.quests.filter((q) => q.itemChanged)
    .map((q) => `**${q.name}** (${d.trader}), ${q.itemChanged}`)),
  'none found yet');

// 6b. For a trader whose VISIBLE list was captured in full, anything a source
// still files under that trader is unseen for some reason. The commonest reason
// is simply that it is not unlocked yet, no trader's list is complete in the
// absolute sense, only complete as far as this profile can see. So this is a
// question, never an accusation of deletion.
// Compare against the mode the PROFILE plays. These records are PvE, and every
// Arena crossover quest exists once per mode under a different id, so reading the
// regular list accuses tarkov.dev of publishing "Easy Money - Part 1 [PVP ZONE]"
// for a trader whose visible PvE list was fully captured, when that card belongs to the
// other mode and could never appear.
const seenIds = new Set([...obsById.keys()]);
const stragglers = [];
const removedByWiki = [];
const eventOnly = [];
for (const doc of allDocs.filter((d) => d.allVisibleCaptured)) {
  const t = doc.trader;
  const modeKey = (doc.profile && doc.profile.mode) === 'pve' ? 'pve'
    : (doc.profile && doc.profile.mode) === 'seasonal' ? 'pvp-season' : 'regular';
  const table = M[modeKey] || M.regular;
  const extra = [];
  const myFaction = (doc.profile && doc.profile.faction) || null;
  for (const q of table.values()) {
    if (q.trader !== t || seenIds.has(q.id)) continue;
    // The other faction's quests can NEVER appear, so listing them as unseen
    // accuses tarkov.dev of publishing something for a trader whose list was
    // captured in full, when the profile simply cannot be offered them. Four
    // quests are faction-exclusive outright, and eight more are twins.
    if (myFaction && q.faction && q.faction.toUpperCase() !== myFaction.toUpperCase()) continue;
    const label = (q.wikiName && q.wikiName !== q.devName) ? `${q.wikiName} (tarkov.dev: ${q.devName})` : q.devName;
    // The wiki already answered this one, it is not an open question.
    if (q.wikiName && wikiHistorical(q.wikiName)) { removedByWiki.push(`**${label}** (${t})`); continue; }
    const ev = q.wikiName && wikiEventMap(q.wikiName);
    if (ev) { eventOnly.push(`**${label}** (${t}), the wiki gives its location as ${ev}`); continue; }
    extra.push(label);
  }
  if (extra.length) {
    stragglers.push(`**${t}**, every quest VISIBLE to this profile was captured, yet tarkov.dev files ${extra.length} more quest(s) `
      + `under this trader: ${extra.sort().join('; ')}.`);
  }
}
// Traders whose list is knowingly partial, and why. Without this the piles above
// look like the whole picture, and a trader with 1 record reads the same as a
// trader with 45.
sectionOf('Traders where even the VISIBLE list could not be captured, and why',
  allDocs.filter((d) => d.allVisibleCaptured === false)
    .map((d) => `**${d.trader}**, ${d.quests.length} record(s). ${d.allVisibleCapturedNote || 'No reason recorded.'}`),
  'every trader collected so far had its visible list captured in full');

// Not open questions, the wiki settled these and nothing was reading its answer.
sectionOf('Removed from the game (tarkov.dev still publishes them)',
  removedByWiki.sort(),
  'none',
  '_The wiki banners a removed quest\'s page with `{{Historical content}}` and keeps the page. Every quest below'
  + ' carries that banner, is still in tarkov.dev\'s task list, and was never seen by a profile whose list for that'
  + ' trader was captured in full, three independent statements of the same fact. A tracker that follows'
  + ' tarkov.dev alone will keep asking the player to finish quests that no longer exist._');

sectionOf('Event-map quests, invisible on a normal profile',
  eventOnly.sort(),
  'none',
  '_Icebreaker is not in the normal map rotation, so its quests never appear outside the event. Published, real,'
  + ' and correctly absent._');

O('## Published, but never seen on this profile');
O('');
O('Read these as a QUESTION, not as proof anything was deleted, the two');
O('sections above have already taken out everything the wiki settles. What remains');
O('has four explanations, and all four are in evidence:');
O('');
O('1. **Not unlocked yet.** `Wet Job - Part 2` … `Part 6` sit here only because');
O('   Part 1 is still active on this profile. Sequels of an unfinished quest cannot');
O('   appear, and they are the largest single cause.');
O('2. **Moved trader.** `Polikhim Hobo` was in Prapor\'s list until Skier\'s arrived;');
O('   `Metal Birds` was in Skier\'s until Peacekeeper\'s did.');
O('3. **Absorbed by a merge.** `The Bunker - Part 2`, `Easy Job - Part 2`,');
O('   `Glory to CPSU - Part 1` and `Pets Won\'t Need It - Part 2` no longer exist');
O('   separately, confirmed by objective content.');
O('4. **Conditional on something other than progress.** Fence\'s five');
O('   `Compensation for Damage` quests appear only on NEGATIVE Fence reputation');
O('   (owner, 2026-08-11), so a profile in good standing never sees them.');
O('');
if (!stragglers.length) { O('_no trader confirmed complete yet_'); O(''); }
else { for (const s of stragglers) O(`- ${s}`); O(''); }

// 7. captures that could not be graded
sectionOf('Not graded, and why',
  unverified.filter((u) => !/minimum player level/.test(u)).map((u) => u.replace(/^- /, '')),
  'nothing outstanding');

// 7. the level claims, counted rather than listed, 50 near-identical lines is
// noise, and the shape of the problem is the number, not the names
const lvlClaims = unverified.filter((u) => /minimum player level/.test(u));
O('## Level requirements nobody has had to meet');
O('');
O(`${lvlClaims.length} observed quest(s) carry a tarkov.dev minimum player level that these`);
O('observations can neither confirm nor deny, the profile was well above all of');
O('them, so reaching the quest proves nothing about the gate. Settling these needs');
O('a low-level profile, not more screenshots from this one.');
O('');

fs.writeFileSync(path.join(OBS, 'OPEN.md'), open.join('\n') + '\n', 'utf8');
console.log(`observed/OPEN.md written`);
console.log(`  ${checked} checked, ${unmatched} unmatched`);
for (const s of SOURCES) {
  const v = score[s], spoke = v.right + v.wrong;
  console.log(`    ${s.padEnd(11)} right ${String(v.right).padStart(3)}  wrong ${String(v.wrong).padStart(3)}  silent ${String(v.silent).padStart(3)}`
    + `   ${spoke ? Math.round(100 * v.right / spoke) + '% where it speaks' : ''}`);
}
for (const f of findings) console.log(`  → ${f.q}: ${f.what}`);
