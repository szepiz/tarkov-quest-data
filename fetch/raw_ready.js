// A clean clone has no raw/, it is gitignored, because redistributing four
// projects' data is theirs to license and a stale mirror helps nobody.
//
// Without this, a builder run before the fetcher fails on a missing module,
// which looks like a broken repository rather than a missing step.
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function rawReady(ROOT, needed = ['tarkovdev', 'wiki']) {
  const RAW = path.join(ROOT, 'raw');
  const missing = needed.filter((d) => !fs.existsSync(path.join(RAW, d)));
  if (!missing.length) return;
  console.error(`\nraw/ is missing: ${missing.join(', ')}`);
  console.error('');
  console.error('  raw/ is a local cache of the upstream sources and is not committed.');
  console.error('  Fetch it first, then run this again:');
  console.error('');
  console.error('      node fetch/fetch_all.js');
  console.error('');
  process.exit(1);
};
