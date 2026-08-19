import { MODELS } from './models.js';
import { recommend } from './recommend.js';
import { CORPUS } from './corpus.js';

// What it costs to route everything through one model instead of picking per
// task. OpenRouter ranks models by tokens processed, which measures adoption.
// This ranks them by what that adoption costs you when it is the wrong pick.
export function flagshipTax({ monthlyCalls = 10000 } = {}) {
  const optimal = CORPUS.map((c) => recommend(c.p, { monthlyCalls }));
  const optimalTotal = optimal.reduce((s, r) => s + r.economics.perCall, 0);

  const rows = MODELS.filter((m) => !m.seat && m.modes.includes('text')).map((m) => {
    let blended = 0;
    let handled = 0;

    // Standardising on one model does not mean it can do everything. Where it
    // cannot, you fall back to something that can, and you still pay for that.
    // Scoring every model over the whole corpus with that fallback is the only
    // way the multiples compare like for like. Scoring each model only on the
    // work it happens to cover compares different task sets and produces
    // nonsense, such as a mid tier model looking dearer than a frontier one
    // purely because the tasks it can reach have cheap optimal answers.
    CORPUS.forEach((c, i) => {
      const task = optimal[i].task;
      const needed = task.mode === 'repo' ? 'code' : task.mode;
      const canDo = task.mode === 'text' || m.modes.includes(needed);
      if (!canDo || m.tier < task.tier) {
        blended += optimal[i].economics.perCall;
        return;
      }
      handled++;
      const est = task.estimate;
      blended += (est.inTokens / 1e6) * m.in + (est.outTokens / 1e6) * m.out;
    });

    const coverage = Math.round((handled / CORPUS.length) * 100);
    return {
      id: m.id,
      tool: m.tool,
      label: m.label,
      tier: m.tier,
      note: m.note,
      coverage,
      // A model reaching under half the corpus was never a candidate to
      // standardise on, so it is listed but kept out of the headline ranking.
      viable: coverage >= 50,
      multiple: Number((blended / optimalTotal).toFixed(2)),
      monthlyIfEverything: Number(((blended / CORPUS.length) * monthlyCalls).toFixed(2)),
    };
  });

  const viable = rows.filter((r) => r.viable).sort((a, b) => b.multiple - a.multiple);
  const rest = rows.filter((r) => !r.viable).sort((a, b) => b.coverage - a.coverage);

  return {
    monthlyCalls,
    corpusSize: CORPUS.length,
    optimalMonthly: Number(((optimalTotal / CORPUS.length) * monthlyCalls).toFixed(2)),
    rows: [...viable, ...rest],
  };
}

// How often each model wins on a representative spread of work.
export function pickShare({ monthlyCalls = 10000 } = {}) {
  const counts = {};
  for (const c of CORPUS) {
    const r = recommend(c.p, { monthlyCalls });
    counts[r.pick.id] ??= { id: r.pick.id, tool: r.pick.tool, label: r.pick.label, wins: 0, modes: new Set() };
    counts[r.pick.id].wins++;
    counts[r.pick.id].modes.add(r.task.mode);
  }
  return Object.values(counts)
    .map((x) => ({ ...x, modes: [...x.modes], share: Math.round((x.wins / CORPUS.length) * 100) }))
    .sort((a, b) => b.wins - a.wins);
}
