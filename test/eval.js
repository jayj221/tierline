// Scores the classifier against src/corpus.js and prints where it disagrees.
//   npm run eval

import { classify } from '../src/classify.js';
import { CORPUS } from '../src/corpus.js';

let modeHits = 0;
let tierHits = 0;
let tierNear = 0;
const misses = [];

for (const c of CORPUS) {
  const got = classify(c.p);
  const modeOk = got.mode === c.mode;
  const tierOk = got.tier === c.tier;
  if (modeOk) modeHits++;
  if (tierOk) tierHits++;
  if (Math.abs(got.tier - c.tier) <= 1) tierNear++;
  if (!modeOk || !tierOk) {
    misses.push({ p: c.p, want: `${c.mode}/${c.tier}`, got: `${got.mode}/${got.tier}` });
  }
}

const n = CORPUS.length;
const pct = (x) => `${Math.round((x / n) * 100)}%`;

console.log(`\n  corpus       ${n} prompts`);
console.log(`  mode exact   ${pct(modeHits)}  (${modeHits}/${n})`);
console.log(`  tier exact   ${pct(tierHits)}  (${tierHits}/${n})`);
console.log(`  tier +/-1    ${pct(tierNear)}  (${tierNear}/${n})`);

if (misses.length) {
  console.log(`\n  disagreements`);
  for (const m of misses) {
    console.log(`    want ${m.want.padEnd(12)} got ${m.got.padEnd(12)} ${m.p.slice(0, 58)}`);
  }
}
console.log();

// Being one tier high costs money and one tier low costs quality. Both are
// survivable. Two tiers out is a real miss, so that is what CI blocks on.
const wayOff = CORPUS.filter((c) => Math.abs(classify(c.p).tier - c.tier) > 1);
if (wayOff.length) {
  console.log(`  ${wayOff.length} prompt(s) more than one tier out, failing\n`);
  process.exit(1);
}
