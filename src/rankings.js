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
    let mine = 0;
    let best = 0;
    let handled = 0;

    CORPUS.forEach((c, i) => {
      const task = optimal[i].task;
      const needed = task.mode === 'repo' ? 'code' : task.mode;
      const canDo = task.mode === 'text' || m.modes.includes(needed);
      // Under the tier the task needs, or wrong modality, means this model is
      // not a cheap option. It is the wrong answer at any price, so it is
      // excluded from the cost comparison rather than scored as free.
      if (!canDo || m.tier < task.tier) return;
      handled++;
      const est = task.estimate;
      mine += (est.inTokens / 1e6) * m.in + (est.outTokens / 1e6) * m.out;
      best += optimal[i].economics.perCall;
    });

    const coverage = Math.round((handled / CORPUS.length) * 100);
    return {
      id: m.id,
      tool: m.tool,
      label: m.label,
      tier: m.tier,
      note: m.note,
      coverage,
      // Only meaningful for a model that could plausibly serve as the single
      // default, so anything under half the corpus is marked not viable.
      viable: coverage >= 50,
      multiple: best > 0 ? Number((mine / best).toFixed(2)) : null,
      monthlyIfEverything: handled > 0 ? Number(((mine / handled) * monthlyCalls).toFixed(2)) : null,
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
