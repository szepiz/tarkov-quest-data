// What did we actually collect, and what does each source know? Reads raw/
// only, no corrections, no merging, no opinions. Writes raw/SUMMARY.md so the
// foundation describes itself.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'raw');
const J = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), 'utf8'));

const out = [];
const say = (s = '') => { out.push(s); console.log(s); };

const man = J('MANIFEST.json');
say(`# Foundation snapshot`);
say(`\nCollected ${man.generated}. Raw only, nothing corrected, nothing merged.`);

// ---- tarkov.dev
const td = J('tarkovdev/regular.tasks.json');
const tdEn = (J('tarkovdev/regular.tasks_en.json') || {}).data || {};
const tasks = Object.values((td.data && td.data.tasks) || {});
let tdLoyalty = 0, tdRep = 0, tdLevel = 0, tdChain = 0, tdObjectives = 0, tdPinned = 0;
for (const t of tasks) {
  for (const r of t.traderRequirements || []) {
    if (r.requirementType === 'level') tdLoyalty++;
    if (r.requirementType === 'reputation') tdRep++;
  }
  if (t.minPlayerLevel) tdLevel++;
  tdChain += (t.taskRequirements || []).length;
  for (const o of t.objectives || []) {
    tdObjectives++;
    const pins = (o.zones || []).filter((z) => z && z.position).length
      + (o.possibleLocations || []).reduce((a, l) => a + (l.positions || []).length, 0);
    if (pins) tdPinned++;
  }
}
say(`\n## tarkov.dev (json.tarkov.dev)`);
say(`- ${tasks.length} quests (regular); ${Object.keys(J('tarkovdev/pve.tasks.json').data.tasks).length} pve, `
  + `${Object.keys(J('tarkovdev/pvp-season.tasks.json').data.tasks).length} seasonal`);
say(`- ${tdObjectives} objectives, ${tdPinned} of them carrying map coordinates`);
say(`- ${tdLevel} quests with a player level, ${tdChain} prerequisite edges`);
say(`- **${tdLoyalty} trader loyalty requirement(s)**, ${tdRep} reputation requirement(s)`);
say(`- string fields are locale keys; \`*.tasks_en.json\` resolves them (key is \`"<id> name"\`, nested under \`data\`)`);

// ---- overlay
const ov = J('overlay/dist.overlay.json');
const ovCommits = J('overlay/commits.json');
const srcTasks = fs.readFileSync(path.join(RAW, 'overlay/src.overrides.tasks.json5'), 'utf8');
const srcNames = (srcTasks.match(/name\s*:/g) || []).length;
say(`\n## tarkov-data-overlay (tarkovtracker-org)`);
say(`- published build v${(ov.$meta || {}).version || '?'}, generated ${(ov.$meta || {}).generated || '?'}`);
say(`- ${Object.keys(ov.tasks || {}).length} task corrections shipped, ${Object.keys(ov.tasksAdd || {}).length} added quests`);
say(`- **the SOURCE runs ahead of the build**: \`src/overrides/tasks.json5\` carries ~${srcNames} name fields`);
say(`- newest commit ${ovCommits[0] ? ovCommits[0].date : '?'}, "${ovCommits[0] ? ovCommits[0].message : ''}"`);
say(`- schemas for every override type are published in \`src/schemas/\`, worth following rather than inventing`);

// ---- wiki
const wi = J('wiki/index.json');
const pages = fs.readdirSync(path.join(RAW, 'wiki/pages'));
let withReq = 0, withObj = 0, withLoyalty = 0;
for (const f of pages) {
  const w = fs.readFileSync(path.join(RAW, 'wiki/pages', f), 'utf8');
  if (/==\s*Requirements\s*==/.test(w)) withReq++;
  if (/==\s*Objectives\s*==/.test(w)) withObj++;
  if (/Loyalty Level/i.test(w)) withLoyalty++;
}
say(`\n## escapefromtarkov.fandom.com`);
// askedFor counts distinct TITLES; askedForIds counts quest ids across all three
// game modes, and the two differ because the Arena quests share one wiki page
say(`- ${wi.pagesStored} pages stored for ${wi.askedFor} distinct titles`
  + `${wi.askedForIds ? `, covering ${wi.askedForIds} quest ids across all game modes` : ''}`
  + ` (${wi.stillMissing.length} title(s) with no page)`);
say(`- **${wi.recoveredFromDeletedRedirects} recovered through the wiki's own rename history**, 1.1.0 renamed about 91 quests`);
say(`  and editors are deleting the redirects, so a lookup by the name tarkov.dev publishes now misses`);
say(`- ${withReq} pages have a Requirements section, ${withObj} an Objectives section`);
say(`- **${withLoyalty} pages mention a Loyalty Level**, the mechanism 1.1.0 replaced the quest chain with`);
say(`- \`index.json\` records asked-title -> resolved-page for every quest, which is the wiki's own rename map`);

// ---- spt
const spt = J('spt/quests.json');
const sptC = J('spt/commits.json');
const cond = {};
for (const q of Object.values(spt)) {
  for (const c of ((q.conditions || {}).AvailableForStart) || []) {
    const k = c.conditionType || '?';
    cond[k] = (cond[k] || 0) + 1;
  }
}
say(`\n## SPT (sp-tarkov/server), schema reference, NOT current`);
say(`- ${Object.keys(spt).length} quests, last updated **${sptC[0] ? sptC[0].date.slice(0, 10) : '?'}**`);
say(`- carries BSG's own condition shape: ${JSON.stringify(cond)}`);
say(`- that \`TraderLoyalty\` type is the structure the live game uses and no public API exposes;`);
say(`  the DATA is a year old, so treat this as the schema and a historical baseline`);

say(`\n## What nobody has`);
say(`- coordinates for BattlePass documents (no source carries an item record at all)`);
say(`- the 1.1.0 renames as data (tarkov.dev publishes 0; only the wiki's move history has them)`);
say(`- trader loyalty gates at any scale (tarkov.dev ${tdLoyalty}, overlay 0, SPT ${cond.TraderLoyalty || 0})`);

say(`\n## Licensing`);
say(`- wiki text is CC BY-SA (Fandom), attribution and share-alike apply to anything derived from it`);
say(`- tarkov.dev and the overlay carry their own repository licences; check before redistributing`);
say(`- \`raw/\` is a cache of other people's work, kept verbatim so provenance is never in doubt`);

fs.writeFileSync(path.join(RAW, 'SUMMARY.md'), out.join('\n') + '\n', 'utf8');
console.log(`\nwrote raw/SUMMARY.md`);
