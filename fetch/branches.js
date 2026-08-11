// Where the quest tree BRANCHES, and the two shapes no consumer reads today.
//
// tarkov.dev's `taskRequirements` is a flat list, and a flat list can only mean
// AND. Everything else about a branch has to be recovered:
//
//   A PREREQUISITE THAT MUST BE FAILED. It is in the data, in a `status` field
//   almost nothing looks at: `["failed"]` rather than `["complete"]`. Four
//   quests are like this, and read as ordinary follow-ups they get listed for
//   every player, when the game offers them to nobody who succeeded.
//
//   "EITHER OF THESE". There is no way to write it in that schema, so where the
//   game branches, tarkov.dev keeps ONE arm and drops the rest. The wiki writes
//   it out, in the infobox, as `|previous =[[A]]<br/>or<br/>[[B]]`.
//
// Shared by build_api.js and build_tree.js rather than copied into both: it is a
// pair of regexes over someone else's formatting, and two copies of that drift
// the moment one of them is fixed.
'use strict';

// One field out of the {{Infobox quest}} block, allowing for a value that wraps
// onto following lines (which stop at the next `|` or the closing `}}`).
function infoboxField(wikiText, name) {
  const box = /\{\{Infobox quest([\s\S]*?)\n\}\}/i.exec(wikiText || '');
  if (!box) return '';
  const re = new RegExp(`^\\s*\\|\\s*${name}\\s*=([^\\n]*(?:\\n(?!\\s*[|}])[^\\n]*)*)`, 'im');
  const m = re.exec(box[1]);
  return m ? m[1].trim() : '';
}

const wikiLinks = (s) => [...String(s || '').matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
  .map((m) => m[1].trim()).filter(Boolean);

// The alternatives named in |previous, or null when it names one path.
//
// The separator has to be the <br>or<br> form. A bare /\bor\b/ matches any title
// with the word in it and would turn one prerequisite into two.
function orPrevious(wikiText) {
  const v = infoboxField(wikiText, 'previous');
  if (!/<br\s*\/?>\s*or\s*<br\s*\/?>/i.test(v)) return null;
  const titles = [...new Set(wikiLinks(v))];
  return titles.length > 1 ? titles : null;
}

// The requirement rows that ONLY a failure satisfies. `["complete","failed"]` is
// a different statement — either outcome will do — and must not count.
const failOnly = (requires) => (requires || [])
  .filter((r) => (r.status || []).includes('failed') && !(r.status || []).includes('complete'));

// What a row means, in one word, for anything that draws or labels an edge.
function edgeKind(status) {
  const s = status || ['complete'];
  if (s.includes('failed') && !s.includes('complete')) return 'failure';
  if (s.includes('failed')) return 'either';
  return 'complete';
}

module.exports = { infoboxField, wikiLinks, orPrevious, failOnly, edgeKind };
