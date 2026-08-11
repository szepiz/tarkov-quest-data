// Shared loader + matcher for observed/, the in-game records.
//
// Every consumer needs the same two things: read the observation files, and work
// out which quest id each one is. Both are done here so there is exactly ONE
// matcher. Two matchers drift, and a name matcher that drifts silently reports a
// live quest as "no source has it".
'use strict';
const fs = require('fs');
const path = require('path');

const MODES = ['regular', 'pve', 'pvp-season'];
const key = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function loadObserved(ROOT) {
  const RAW = path.join(ROOT, 'raw');
  const OBS = path.join(ROOT, 'observed');
  if (!fs.existsSync(OBS)) return { docs: [], byId: new Map(), unmatched: [] };

  const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));
  const wikiIdx = J('wiki/index.json');
  const wikiById = wikiIdx.quests.reduce((a, q) => (a[q.id] = q.page, a), {});

  // name -> id, from every mode, under BOTH the current wiki title and the name
  // tarkov.dev still publishes. The observation carries the CURRENT name, which
  // tarkov.dev often does not have, so the wiki title has to be in the index or
  // about 91 renamed quests match nothing.
  const nameToId = new Map();
  const traderOf = new Map();
  const objsOf = new Map();
  const devNameOf = new Map();
  const wikiNameOf = new Map();
  for (const mode of MODES) {
    const f = path.join(RAW, 'tarkovdev', `${mode}.tasks.json`);
    if (!fs.existsSync(f)) continue;
    const td = JSON.parse(fs.readFileSync(f, 'utf8'));
    const en = (JSON.parse(fs.readFileSync(path.join(RAW, 'tarkovdev', `${mode}.tasks_en.json`), 'utf8')) || {}).data || {};
    const trEn = (JSON.parse(fs.readFileSync(path.join(RAW, 'tarkovdev', `${mode}.traders_en.json`), 'utf8')) || {}).data || {};
    const L = (v) => { const r = (typeof v === 'string' && en[v] !== undefined) ? en[v] : v; return typeof r === 'string' ? r.trim() : r; };
    for (const [id, t] of Object.entries((td.data && td.data.tasks) || {})) {
      const dev = L(t.name), wiki = wikiById[id];
      if (dev && !nameToId.has(key(dev))) nameToId.set(key(dev), id);
      if (wiki && !nameToId.has(key(wiki))) nameToId.set(key(wiki), id);
      if (!traderOf.has(id)) traderOf.set(id, (trEn[`${t.trader} Nickname`] || '').trim() || null);
      if (!objsOf.has(id)) objsOf.set(id, (t.objectives || []).map((o) => L(o.description) || ''));
      if (!devNameOf.has(id)) devNameOf.set(id, dev);
      if (!wikiNameOf.has(id)) wikiNameOf.set(id, wiki);
    }
  }

  const docs = fs.readdirSync(OBS).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(OBS, f), 'utf8')));

  const byId = new Map();
  const unmatched = [];
  for (const doc of docs) {
    for (const q of doc.quests) {
      // an explicit questId always wins, it is there because the name alone was
      // ambiguous, and re-guessing would undo the decision it records
      // The same near-miss fallback the grader uses, or the two disagree, // which is exactly what this shared module exists to prevent. "The Huntsman
      // Path - Control" is a rename EVERY source missed (all three still say
      // "Controller"), so it has no exact match; the grader found it by near-miss
      // while the viewers dropped it as unmatched. One candidate only: ambiguity
      // stays unresolved rather than being guessed.
      let id = q.questId || nameToId.get(key(q.name));
      if (!id) {
        const k = key(q.name);
        const near = [];
        for (const [nk, cand] of nameToId) {
          if (traderOf.get(cand) !== doc.trader) continue;
          if (nk && (nk.includes(k) || k.includes(nk))) near.push(cand);
        }
        const uniq = [...new Set(near)];
        if (uniq.length === 1) id = uniq[0];
      }
      if (!id) {
        // the WHOLE record, not just its name, a quest no source has is the most
        // interesting thing in the folder, and a consumer needs it in full
        unmatched.push({ ...q, trader: doc.trader, observedAt: doc.observedAt, gameVersion: doc.gameVersion,
          mode: (doc.profile && doc.profile.mode) || 'unconfirmed' });
        continue;
      }
      byId.set(id, {
        ...q,
        questId: id,
        questIdPinned: !!q.questId,
        trader: doc.trader,
        observedAt: doc.observedAt,
        gameVersion: doc.gameVersion,
        mode: (doc.profile && doc.profile.mode) || 'unconfirmed',
      });
    }
  }
  // WHICH MATCHES CANNOT BE TRUSTED. 1.1.0 renumbered quest lines, so the card
  // the game calls "The Punisher - Part 1" carries the objectives published under
  // Part 3. The name matches perfectly, so every consumer would happily compare
  // the wrong pair and report confident nonsense about maps. Computed HERE so the
  // grader and the viewers share one answer instead of two that drift.
  const words = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9]+/g) || []);
  const sig = (arr) => new Set(arr.flatMap((s) => [...words(s)]));
  const overlap = (a, b) => {
    if (!a.size || !b.size) return 0;
    let hit = 0; for (const t of a) if (b.has(t)) hit++;
    return hit / (a.size + b.size - hit);
  };
  const lineOf = (n) => {
    const m = /^(.*?)\s*[-–]\s*Part\s+(\d+)\s*$/i.exec(String(n || ''));
    return m ? m[1].trim().toLowerCase() : String(n || '').trim().toLowerCase();
  };

  const suspectLines = new Set();
  for (const [id, o] of byId) {
    if (!(o.objectives || []).length) continue;
    // A HAND PIN IS THE ANSWER, NOT A GUESS TO BE SECOND-GUESSED. The detector
    // exists to notice that a name no longer identifies a record; once the record
    // carries an explicit questId, read off the objective text, the question is
    // settled and re-flagging its line only suppresses grading that now works.
    if (o.questIdPinned) continue;
    const base = lineOf(o.name);
    const mine = overlap(sig(o.objectives), sig(objsOf.get(id) || []));
    let best = mine;
    for (const [other, objs] of objsOf) {
      if (other === id) continue;
      if (traderOf.get(other) !== traderOf.get(id)) continue;
      // same numbered line only, comparing across a trader's whole catalogue
      // matches quests that merely share vocabulary
      if (lineOf(devNameOf.get(other)) !== base && lineOf(wikiNameOf.get(other)) !== base) continue;
      const s = overlap(sig(o.objectives), sig(objs));
      if (s > best) best = s;
    }
    if (best > mine + 0.15) suspectLines.add(base);
  }
  // if ANY part of a line is mispaired, no part of that line can be trusted, // including parts with nothing captured to compare
  for (const o of byId.values()) if (suspectLines.has(lineOf(o.name))) o.lineSuspect = true;

  return { docs, byId, unmatched, nameToId, traderOf, suspectLines };
}

module.exports = { loadObserved, key, MODES };
