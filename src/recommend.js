import { MODELS, PRICES_CHECKED } from './models.js';
import { classify } from './classify.js';

function unitCost(model, est) {
  if (model.seat) return { perCall: 0, seat: model.seat, unit: 'seat' };
  switch (model.unit) {
    case 'char': return { perCall: (est.chars / 1000) * model.in, unit: 'per 1k chars' };
    case 'second': return { perCall: est.seconds * model.in, unit: 'per second' };
    case 'image': return { perCall: est.images * model.in, unit: 'per image' };
    case 'minute': return { perCall: est.minutes * model.in, unit: 'per minute' };
    case 'track': return { perCall: est.tracks * model.in, unit: 'per track' };
    default:
      return {
        perCall: (est.inTokens / 1e6) * model.in + (est.outTokens / 1e6) * model.out,
        unit: 'per call',
      };
  }
}

function eligible(task) {
  const wanted = {
    repo: ['repo', 'code'],
    code: ['code'],
    search: ['search', 'text'],
    docs: ['docs', 'text'],
    voice: ['voice'],
    video: ['video'],
    image: ['image'],
    music: ['music'],
    transcribe: ['transcribe'],
    text: ['text'],
  }[task.mode] || ['text'];

  let pool = MODELS.filter((m) => m.modes.some((x) => wanted.includes(x)));
  if (task.mode === 'search') pool = pool.filter((m) => m.modes.includes('search') || m.tier >= 2);
  if (task.signals.needsRepoContext) pool = pool.filter((m) => !m.ctx || m.ctx >= 128000);
  return pool.length ? pool : MODELS.filter((m) => m.modes.includes('text'));
}

export function recommend(prompt, { monthlyCalls = 10000 } = {}) {
  const task = classify(prompt);
  const pool = eligible(task);

  const priced = pool.map((m) => {
    const cost = unitCost(m, task.estimate);
    const gap = m.tier - task.tier;
    // Under tier is disqualifying. Over tier is money burned for nothing.
    const fit = gap < 0 ? -1000 + gap * 50 : 100 - gap * 22;
    return { model: m, cost, gap, fit };
  });

  // Seat priced tools cost nothing per call, which would let them win every
  // comparison on a technicality. They are a different purchase, so they get
  // their own list and only enter the metered ranking if nothing else fits.
  const metered = priced.filter((x) => !x.model.seat);
  const seated = priced.filter((x) => x.model.seat && x.gap >= 0);

  const field = metered.length ? metered : priced;
  const qualified = field.filter((x) => x.gap >= 0);
  const ranked = (qualified.length ? qualified : field).sort((a, b) => b.fit - a.fit || a.cost.perCall - b.cost.perCall);

  const pick = [...(qualified.length ? qualified : field)]
    .sort((a, b) => a.cost.perCall - b.cost.perCall || b.fit - a.fit)[0];
  const flagship = [...field].sort((a, b) => b.cost.perCall - a.cost.perCall || b.model.tier - a.model.tier)[0];

  const perCall = pick.cost.perCall;
  const naive = flagship.cost.perCall;
  const monthly = perCall * monthlyCalls;
  const naiveMonthly = naive * monthlyCalls;

  return {
    task,
    pricesChecked: PRICES_CHECKED,
    pick: {
      ...pick.model,
      costPerCall: round(perCall),
      unit: pick.cost.unit,
      seat: pick.cost.seat || null,
      why: reason(task, pick.model),
    },
    alternatives: ranked
      .filter((x) => x.model.id !== pick.model.id)
      .slice(0, 4)
      .map((x) => ({
        id: x.model.id, tool: x.model.tool, label: x.model.label, tier: x.model.tier,
        costPerCall: round(x.cost.perCall), note: x.model.note,
        delta: round(x.cost.perCall - perCall),
      })),
    subscriptions: seated.map((x) => ({
      id: x.model.id, tool: x.model.tool, label: x.model.label,
      seatUsd: x.model.seat, note: x.model.note,
    })),
    cautions: cautions(task, pick.model),
    economics: {
      monthlyCalls,
      perCall: round(perCall),
      monthly: round(monthly),
      naiveModel: flagship.model.label,
      naivePerCall: round(naive),
      naiveMonthly: round(naiveMonthly),
      savedMonthly: round(naiveMonthly - monthly),
      savedPct: naiveMonthly > 0 ? Math.round(((naiveMonthly - monthly) / naiveMonthly) * 100) : 0,
    },
  };
}

function reason(task, model) {
  const bits = [];
  if (task.signals.highStakes) bits.push('stakes language holds the floor at standard tier or above');
  if (task.signals.highVolume && !task.signals.highStakes) bits.push('volume language caps the tier, this runs too often to overpay');
  if (task.signals.deepReasoning) bits.push('the ask needs real reasoning, not a transform');
  if (task.signals.shallowTransform && !task.signals.deepReasoning) bits.push('this is a transform, a frontier model adds nothing');
  if (task.signals.needsRepoContext) bits.push('repo scope needs a large context window');
  if (task.signals.needsLiveWeb) bits.push('needs live web grounding');
  if (!bits.length) bits.push('no signals pushing it up or down, standard work');
  return `${model.label} is the cheapest ${task.mode} model at ${task.tierName} tier: ${bits.join(', ')}.`;
}

function cautions(task, model) {
  const out = [];
  if (task.signals.highStakes) {
    out.push('This prompt uses high stakes language. Cost is not the only axis here, and the cheapest qualifying model is still the cheapest one. Have a person sign off before this routing goes live.');
  }
  if (task.signals.highStakes && model.tier <= 2) {
    out.push(`${model.label} clears the tier floor but sits at the bottom of it. Consider one tier up for anything with legal or clinical exposure.`);
  }
  if (task.estimate.inTokens > 100000) {
    out.push('The context estimate is large and guessed from wording, not measured. Feed real token counts in before trusting the monthly figure.');
  }
  out.push('Data residency, retention terms and vendor approval are not modelled here. Those rule models out regardless of price.');
  return out;
}

const round = (n) => Math.round(n * 1e6) / 1e6;

export function catalogue() {
  return { pricesChecked: PRICES_CHECKED, models: MODELS };
}
