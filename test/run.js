import { classify } from '../src/classify.js';
import { recommend } from '../src/recommend.js';
import { MODELS } from '../src/models.js';
import { flagshipTax, pickShare } from '../src/rankings.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok  ${name}`); }
  catch (err) { fail++; console.log(`  FAIL ${name}\n       ${err.message}`); }
};
const eq = (a, b, msg) => { if (a !== b) throw new Error(msg || `expected ${b}, got ${a}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

console.log('\nclassify');
t('reads voice work', () => eq(classify('narrate this script').mode, 'voice'));
t('reads video work', () => eq(classify('generate b-roll for each beat').mode, 'video'));
t('reads image work', () => eq(classify('make a thumbnail for this').mode, 'image'));
t('reads transcription', () => eq(classify('transcribe this recording').mode, 'transcribe'));
t('reads repo scope', () => eq(classify('refactor this across the whole monorepo, the api is broken').mode, 'repo'));
t('does not read classify as code', () => eq(classify('classify every inbound email').mode, 'text'));
t('deep reasoning lifts the tier', () => ok(classify('architect a system and reason through the trade-offs').tier >= 3));
t('transforms drop the tier', () => ok(classify('summarise this paragraph').tier <= 1));
t('stakes set a floor', () => ok(classify('review this contract for liability before we sign').tier >= 2));
t('volume caps the ceiling', () => ok(classify('tag every one of our 90000 records nightly').tier <= 1));
t('stakes beat volume', () => ok(classify('review every patient record for clinical risk daily').tier >= 2));

console.log('\nrecommend');
t('never picks below the required tier', () => {
  const r = recommend('architect a distributed system and prove the consistency guarantees');
  ok(r.pick.tier >= r.task.tier, `picked tier ${r.pick.tier} for a tier ${r.task.tier} task`);
});
t('picks a voice model for voice work', () => {
  ok(recommend('narrate this 60 second script').pick.modes.includes('voice'));
});
t('seat priced tools stay out of the per call ranking', () => {
  const r = recommend('summarise these tickets every night for every ticket');
  ok(!r.pick.seat, `picked seat priced ${r.pick.label} as a metered winner`);
});
t('seat priced tools still surface separately', () => {
  const r = recommend('summarise these tickets every night for every ticket');
  ok(Array.isArray(r.subscriptions));
});
t('cheap work is cheaper than deep work', () => {
  const cheap = recommend('summarise this').economics.perCall;
  const deep = recommend('architect a multi region failover and reason through the trade-offs').economics.perCall;
  ok(deep > cheap, `deep ${deep} was not dearer than cheap ${cheap}`);
});
t('savings are never negative', () => {
  for (const p of ['summarise this', 'architect a system', 'narrate this', 'make an image']) {
    ok(recommend(p).economics.savedMonthly >= 0, `negative saving on "${p}"`);
  }
});
t('monthly scales with call count', () => {
  const a = recommend('summarise this', { monthlyCalls: 1000 }).economics.monthly;
  const b = recommend('summarise this', { monthlyCalls: 2000 }).economics.monthly;
  ok(Math.abs(b - a * 2) < 1e-6, `${b} is not double ${a}`);
});
t('high stakes always carries a caution', () => {
  ok(recommend('review this contract for liability exposure').cautions.length >= 2);
});
t('every prompt returns a pick', () => {
  for (const p of ['', 'hi', 'x'.repeat(3000), 'make me a song about databases']) {
    ok(recommend(p).pick.id, `no pick for "${p.slice(0, 20)}"`);
  }
});

console.log('\nrankings');
t('no model beats optimal routing', () => {
  for (const r of flagshipTax().rows) ok(r.multiple >= 1, `${r.label} scored ${r.multiple}x, below optimal`);
});
t('frontier models cost more than mid tier ones as a default', () => {
  const rows = flagshipTax().rows;
  const opus = rows.find((r) => r.id === 'claude-opus-5');
  const sonnet = rows.find((r) => r.id === 'claude-sonnet-5');
  ok(opus.multiple > sonnet.multiple, `opus ${opus.multiple}x was not above sonnet ${sonnet.multiple}x`);
});
t('coverage is a percentage', () => {
  for (const r of flagshipTax().rows) ok(r.coverage >= 0 && r.coverage <= 100, `${r.label} coverage ${r.coverage}`);
});
t('viable means at least half the corpus', () => {
  for (const r of flagshipTax().rows) eq(r.viable, r.coverage >= 50, `${r.label} viability disagrees with coverage`);
});
t('monthly scales with calls', () => {
  const a = flagshipTax({ monthlyCalls: 1000 }).optimalMonthly;
  const b = flagshipTax({ monthlyCalls: 2000 }).optimalMonthly;
  ok(Math.abs(b - a * 2) < 0.02, `${b} is not double ${a}`);
});
t('pick share sums to about 100', () => {
  const total = pickShare().reduce((s, x) => s + x.share, 0);
  ok(Math.abs(total - 100) <= 3, `shares summed to ${total}`);
});

console.log('\ncatalogue');
t('every model has a price or a seat', () => {
  for (const m of MODELS) ok(m.in > 0 || m.out > 0 || m.seat > 0, `${m.id} has no price`);
});
t('every model declares at least one mode', () => {
  for (const m of MODELS) ok(m.modes?.length, `${m.id} has no modes`);
});
t('tiers are within range', () => {
  for (const m of MODELS) ok(m.tier >= 0 && m.tier <= 3, `${m.id} tier ${m.tier}`);
});
t('model ids are unique', () => {
  eq(new Set(MODELS.map((m) => m.id)).size, MODELS.length);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
