// Which source wins a field, asserted directly on the builder's own rule.
//
// The law is easy to state and easy to break silently, and a build can look
// healthy while deciding nothing: the fields tarkov.dev corrected on 2026-08-15
// are mostly ones the wiki never speaks about, so the day this rule changed it
// altered almost no published value. These cases exercise it anyway.
//
//   node fetch/test_pick.js
'use strict';
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'build_api.js'), 'utf8').replace(/\r\n/g, '\n');
const from = src.indexOf('const pick = (candidates) => {');
const to = src.indexOf('\n};', from);        // the closing brace itself, not past the semicolon
if (from < 0 || to < 0) throw new Error('cannot find pick()');
const body = src.slice(from, to + 2).replace('const pick = ', '');
// eslint-disable-next-line no-eval
const pick = eval('(' + body + ')');
if (typeof pick !== 'function') throw new Error('pick did not come out a function');

const obs = (v, at) => ({ src: 'observed', asOf: at, value: v });
const wiki = (v, at) => ({ src: 'wiki', asOf: at, value: v });
const dev = (v, at) => ({ src: 'tarkov.dev', asOf: at, value: v });

const cases = [
  ['our own record beats a newer wiki',
    [obs('mine', '2026-08-01'), wiki('theirs', '2026-08-15')], 'observed'],
  ['our own record beats a newer tarkov.dev',
    [obs('mine', '2026-08-01'), dev('theirs', '2026-08-15')], 'observed'],
  ['newer tarkov.dev beats older wiki  <- the case that changed',
    [wiki('old', '2026-08-09'), dev('new', '2026-08-15')], 'tarkov.dev'],
  ['newer wiki still beats older tarkov.dev',
    [wiki('new', '2026-08-15'), dev('old', '2026-08-09')], 'wiki'],
  ['a dated source beats an undated one',
    [dev('undated', null), wiki('dated', '2026-08-05')], 'wiki'],
  ['undated tarkov.dev still loses to the wiki, as before',
    [wiki('w', '2026-08-05'), dev('d', null)], 'wiki'],
  ['both undated: the listed order stands',
    [wiki('w', null), dev('d', null)], 'wiki'],
  ['same day: the listed order stands',
    [wiki('w', '2026-08-15'), dev('d', '2026-08-15')], 'wiki'],
  ['an empty value is not an answer',
    [wiki([], '2026-08-15'), dev(['x'], '2026-08-01')], 'tarkov.dev'],
  ['null is not an answer',
    [obs(null, '2026-08-15'), dev('x', null)], 'tarkov.dev'],
];

let bad = 0;
for (const [label, cands, want] of cases) {
  const got = pick(cands);
  const ok = got && got.src === want;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (wanted ${want}, got ${got && got.src})`}`);
}
console.log(bad ? `\n${bad} FAILED` : '\nall pass');
process.exit(bad ? 1 : 0);
