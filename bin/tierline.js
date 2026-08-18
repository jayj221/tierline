#!/usr/bin/env node
import { recommend } from '../src/recommend.js';

const argv = process.argv.slice(2);
const flags = {};
const words = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--calls' || argv[i] === '-n') flags.calls = Number(argv[++i]);
  else if (argv[i] === '--json') flags.json = true;
  else if (argv[i] === '--help' || argv[i] === '-h') flags.help = true;
  else words.push(argv[i]);
}

const prompt = words.join(' ').trim();

if (flags.help || !prompt) {
  console.log(`
  tierline  work out which model should actually run a prompt

  usage
    tierline "<your prompt>" [--calls N] [--json]

  options
    -n, --calls N   how often this runs per month, default 10000
        --json      machine readable output
        --help      this

  examples
    tierline "summarise these support tickets into themes" -n 100000
    tierline "architect a multi region failover and reason through the trade-offs"
    tierline "narrate this 60 second script with a warm tone"
`);
  process.exit(prompt ? 0 : 1);
}

const r = recommend(prompt, { monthlyCalls: flags.calls || 10000 });

if (flags.json) {
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
};
const money = (n) => (n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(2));
const e = r.economics;

console.log();
console.log(`  ${c.b(r.pick.tool + '  ' + r.pick.label)}   ${c.dim(r.task.mode + ' / ' + r.task.tierName + ' tier')}`);
console.log(`  ${c.dim(r.pick.note)}`);
console.log();
console.log(`  ${c.g('$' + r.pick.costPerCall)} ${c.dim(r.pick.unit)}`);
console.log(`  ${c.dim('at ' + e.monthlyCalls.toLocaleString('en-US') + ' calls a month')}  ${c.g('$' + money(e.monthly))}`);
console.log(`  ${c.dim('everything through ' + e.naiveModel)}  ${c.r('$' + money(e.naiveMonthly))}`);
console.log(`  ${c.b('saves $' + money(e.savedMonthly) + ' a month, ' + e.savedPct + '%')}`);
console.log();
console.log(`  ${c.dim('why')}  ${r.pick.why}`);
console.log();
if (r.alternatives.length) {
  console.log(`  ${c.dim('alternatives')}`);
  for (const a of r.alternatives) {
    const name = a.label.toLowerCase().startsWith(a.tool.toLowerCase()) ? a.label : `${a.tool} ${a.label}`;
    console.log(`    ${name.padEnd(26)} ${c.dim('$' + a.costPerCall)}`);
  }
  console.log();
}
if (r.subscriptions.length) {
  console.log(`  ${c.dim('seat priced')}`);
  for (const s of r.subscriptions) console.log(`    ${s.label.padEnd(26)} ${c.dim('$' + s.seatUsd + '/seat/mo')}`);
  console.log();
}
for (const caution of r.cautions) console.log(`  ${c.y('!')} ${c.dim(caution)}`);
console.log();
console.log(`  ${c.dim('prices are a snapshot from ' + r.pricesChecked + ', held in src/models.js')}`);
console.log();
