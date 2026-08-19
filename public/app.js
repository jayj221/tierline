const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => (n == null ? '-' : n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(2));
const nameOf = (t, l) => (l.toLowerCase().startsWith(t.toLowerCase()) ? l : `${t} ${l}`);
const get = (u) => fetch(u).then((r) => r.json());
const post = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

const TIER = ['minimal', 'light', 'standard', 'frontier'];
const tierPill = (t) => `<span class="pill t${t}">${TIER[t]}</span>`;
const priceOf = (m) => (m.seat ? `$${m.seat}/seat` : m.unit ? `$${m.in} / ${m.unit}` : `$${m.in} in &middot; $${m.out} out`);

const SAMPLES = [
  ['Bulk transform', 'Summarise these 4000 support tickets into themes. We run this nightly for every ticket.', 100000],
  ['Deep reasoning', 'Architect a multi region failover for our payment service and reason through the trade-offs.', 2000],
  ['Repo work', 'Debug a race condition across our monorepo. It only shows up in production.', 1000],
  ['Narration', 'Narrate this 60 second script with a warm, measured tone.', 5000],
  ['High stakes', 'Review this vendor contract for liability exposure before we sign.', 300],
];

const state = { prompt: '', calls: 10000, result: null, busy: false };

function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'pick';
  const [page, arg] = hash.split('/');
  document.querySelectorAll('nav a').forEach((a) => a.classList.toggle('on', a.dataset.page === page));
  if (page === 'models' && arg) return modelPage(arg);
  if (page === 'models') return catalogue();
  if (page === 'rankings') return rankings();
  return pick();
}

// pick

function pick() {
  $('#view').innerHTML = `
    <div class="head">
      <h1>Which model should run this</h1>
      <p>Paste the prompt you were about to send. tierline reads what the job needs, picks the cheapest model that clears that bar, and prices it against routing everything to a flagship.</p>
    </div>
    <textarea id="p" placeholder="Summarise these 4000 support tickets into themes. We run this nightly for every ticket.">${esc(state.prompt)}</textarea>
    <div class="bar">
      <input id="n" type="number" min="1" value="${state.calls}">
      <span class="dim">calls per month</span>
      <button class="btn go" id="go" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Reading' : 'Pick a model'}</button>
    </div>
    <div class="chips">${SAMPLES.map((s, i) => `<button class="chip" data-s="${i}">${esc(s[0])}</button>`).join('')}</div>
    <div id="out">${state.result ? resultView(state.result) : ''}</div>`;
  $('#go').onclick = run;
  $('#p').oninput = (e) => { state.prompt = e.target.value; };
  document.querySelectorAll('[data-s]').forEach((b) => {
    b.onclick = () => {
      const [, prompt, calls] = SAMPLES[+b.dataset.s];
      state.prompt = prompt; state.calls = calls;
      $('#p').value = prompt; $('#n').value = calls;
      run();
    };
  });
}

async function run() {
  const prompt = $('#p').value.trim();
  if (!prompt) return;
  state.prompt = prompt; state.calls = +$('#n').value || 10000; state.busy = true;
  $('#go').disabled = true; $('#go').textContent = 'Reading';
  state.result = await post('/api/recommend', { prompt, monthlyCalls: state.calls });
  state.busy = false;
  $('#out').innerHTML = resultView(state.result);
  $('#go').disabled = false; $('#go').textContent = 'Pick a model';
}

function resultView(r) {
  const e = r.economics;
  const sig = Object.entries(r.task.signals).filter(([, v]) => v).map(([k]) => k.replace(/([A-Z])/g, ' $1').toLowerCase());
  return `
    <div class="card">
      <div class="card-h">${esc(r.task.mode)} work ${tierPill(r.task.tier)}</div>
      <div class="pad">
        <div class="pick">
          <div class="grow">
            <a class="big" href="#/models/${esc(r.pick.id)}">${esc(nameOf(r.pick.tool, r.pick.label))}</a>
            <div class="dim sm">${esc(r.pick.note)}</div>
          </div>
          <div class="cost"><b>$${r.pick.costPerCall}</b><s>${esc(r.pick.unit)}</s></div>
        </div>
        <p class="why">${esc(r.pick.why)}</p>
        <div class="chips tight">${sig.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}</div>
      </div>
      <div class="kpis">
        <div><span class="k">This routing</span><span class="v ok">$${money(e.monthly)}</span></div>
        <div><span class="k">${esc(e.naiveModel)} only</span><span class="v bad">$${money(e.naiveMonthly)}</span></div>
        <div><span class="k">Saved</span><span class="v">$${money(e.savedMonthly)}</span></div>
        <div><span class="k">Reduction</span><span class="v">${e.savedPct}%</span></div>
      </div>
    </div>
    <div class="card">
      <div class="card-h">Alternatives</div>
      ${r.alternatives.map((a) => `<a class="row" href="#/models/${esc(a.id)}"><b>${esc(nameOf(a.tool, a.label))}</b><span class="dim grow">${esc(a.note)}</span><span class="num">$${a.costPerCall}</span></a>`).join('')}
      ${r.subscriptions.map((s) => `<div class="row"><b>${esc(s.label)}</b><span class="dim grow">${esc(s.note)} Seat priced, so it stays out of the per call comparison.</span><span class="num">$${s.seatUsd}/seat</span></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-h">Before you route production traffic through this</div>
      ${r.cautions.map((c) => `<div class="warn">${esc(c)}</div>`).join('')}
    </div>`;
}

// catalogue

let catFilters = { mode: '', tier: '', q: '' };

async function catalogue() {
  const qs = new URLSearchParams(Object.entries(catFilters).filter(([, v]) => v)).toString();
  const d = await get('/api/models?' + qs);
  $('#view').innerHTML = `
    <div class="head">
      <h1>Models</h1>
      <p>${d.models.length} of ${d.total} models. Prices are a snapshot from ${esc(d.pricesChecked)}, held in src/models.js.</p>
    </div>
    <div class="filters">
      <input id="q" placeholder="Search models" value="${esc(catFilters.q)}">
      <select id="mode"><option value="">All modalities</option>${d.modes.map((m) => `<option value="${m}" ${catFilters.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
      <select id="tier"><option value="">All tiers</option>${TIER.map((t, i) => `<option value="${i}" ${catFilters.tier === String(i) ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="card">
      ${d.models.length ? d.models.map((m) => `
        <a class="row model" href="#/models/${esc(m.id)}">
          <div class="grow">
            <b>${esc(nameOf(m.tool, m.label))}</b> ${tierPill(m.tier)}
            <div class="dim sm">${esc(m.note)}</div>
            <div class="chips tight">${m.modes.map((x) => `<span class="pill mini">${esc(x)}</span>`).join('')}</div>
          </div>
          <span class="num">${priceOf(m)}</span>
        </a>`).join('') : '<div class="warn">Nothing matches those filters.</div>'}
    </div>`;
  $('#q').oninput = debounce((e) => { catFilters.q = e.target.value; catalogue(); }, 220);
  $('#mode').onchange = (e) => { catFilters.mode = e.target.value; catalogue(); };
  $('#tier').onchange = (e) => { catFilters.tier = e.target.value; catalogue(); };
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// model detail

async function modelPage(id) {
  const d = await get('/api/models/' + encodeURIComponent(id));
  if (d.error) { $('#view').innerHTML = `<div class="head"><h1>Not found</h1><p>No model called ${esc(id)}.</p></div>`; return; }
  const m = d.model;
  $('#view').innerHTML = `
    <a class="back" href="#/models">All models</a>
    <div class="head">
      <h1>${esc(nameOf(m.tool, m.label))} ${tierPill(m.tier)}</h1>
      <p>${esc(m.note)}</p>
    </div>
    <div class="card">
      <div class="card-h">Pricing and reach</div>
      <div class="kpis">
        <div><span class="k">${m.seat ? 'Per seat' : m.unit ? 'Per ' + m.unit : 'Input, per Mtok'}</span><span class="v">$${m.seat || m.in}</span></div>
        ${m.seat || m.unit ? '' : `<div><span class="k">Output, per Mtok</span><span class="v">$${m.out}</span></div>`}
        <div><span class="k">Context</span><span class="v">${m.ctx ? (m.ctx / 1000) + 'k' : '-'}</span></div>
        <div><span class="k">Modalities</span><span class="v">${m.modes.length}</span></div>
      </div>
    </div>
    ${d.tax ? `
    <div class="card">
      <div class="card-h">As your only model</div>
      <div class="kpis">
        <div><span class="k">Flagship tax</span><span class="v ${d.tax.multiple > 3 ? 'bad' : 'ok'}">${d.tax.multiple}x</span></div>
        <div><span class="k">Covers</span><span class="v">${d.tax.coverage}%</span></div>
        <div><span class="k">Viable alone</span><span class="v">${d.tax.viable ? 'yes' : 'no'}</span></div>
      </div>
      <div class="warn">Measured across the ${39} task corpus in src/corpus.js. The multiple counts only work this model can actually take, so coverage has to be read alongside it.</div>
    </div>` : ''}
    <div class="card">
      <div class="card-h">Cheaper and still clears the same tier</div>
      ${d.cheaper.length
        ? d.cheaper.map((c) => `<a class="row" href="#/models/${esc(c.id)}"><b>${esc(nameOf(c.tool, c.label))}</b> ${tierPill(c.tier)}<span class="dim grow">${esc(c.note)}</span><span class="num">$${c.in} in</span></a>`).join('')
        : '<div class="warn">Nothing cheaper clears this tier. This is the floor for the work it does.</div>'}
    </div>`;
}

// rankings

async function rankings() {
  const d = await get('/api/rankings?calls=100000');
  const max = Math.max(...d.rows.filter((r) => r.viable).map((r) => r.multiple), 1);
  $('#view').innerHTML = `
    <div class="head">
      <h1>Flagship tax</h1>
      <p>Adoption rankings tell you what everyone else is buying. This tells you what buying it costs. If you made each model your single default across ${d.corpusSize} representative tasks, this is the multiple of the optimal bill you would pay, at ${d.monthlyCalls.toLocaleString('en-US')} calls a month.</p>
    </div>
    <div class="card">
      <div class="card-h">Optimal routing costs $${money(d.optimalMonthly)} a month</div>
      ${d.rows.filter((r) => r.viable).map((r) => `
        <a class="row rank" href="#/models/${esc(r.id)}">
          <div class="grow">
            <b>${esc(nameOf(r.tool, r.label))}</b> ${tierPill(r.tier)}
            <div class="meter"><i style="width:${(r.multiple / max) * 100}%"></i></div>
          </div>
          <span class="num big ${r.multiple > 3 ? 'bad' : 'ok'}">${r.multiple}x</span>
          <span class="num">$${money(r.monthlyIfEverything)}</span>
          <span class="num dim">${r.coverage}%</span>
        </a>`).join('')}
    </div>
    <div class="card">
      <div class="card-h">Not viable as a sole default <span class="dim">covers under half the corpus</span></div>
      ${d.rows.filter((r) => !r.viable).map((r) => `
        <a class="row" href="#/models/${esc(r.id)}"><b>${esc(nameOf(r.tool, r.label))}</b><span class="dim grow">${esc(r.note)}</span><span class="num dim">covers ${r.coverage}%</span></a>`).join('')}
    </div>
    <div class="card">
      <div class="card-h">Pick share <span class="dim">how often each model wins outright</span></div>
      ${d.share.map((s) => `
        <a class="row" href="#/models/${esc(s.id)}">
          <b>${esc(nameOf(s.tool, s.label))}</b>
          <span class="dim grow">${s.modes.join(', ')}</span>
          <span class="num">${s.share}%</span>
        </a>`).join('')}
    </div>`;
}

window.addEventListener('hashchange', route);
route();
