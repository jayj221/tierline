import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommend } from './src/recommend.js';
import { MODELS, PRICES_CHECKED } from './src/models.js';
import { flagshipTax, pickShare } from './src/rankings.js';
import { classify } from './src/classify.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4180);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' });
  res.end(s);
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
    return res.end();
  }

  if (url.pathname === '/api/recommend' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch { return json(res, 400, { error: 'invalid JSON' }); }
    if (!body.prompt) return json(res, 400, { error: 'prompt required' });
    return json(res, 200, recommend(body.prompt, { monthlyCalls: Number(body.monthlyCalls) || 10000 }));
  }

  if (url.pathname === '/api/models') {
    const mode = url.searchParams.get('mode');
    const tier = url.searchParams.get('tier');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    let list = MODELS;
    if (mode) list = list.filter((m) => m.modes.includes(mode));
    if (tier !== null && tier !== '') list = list.filter((m) => m.tier === Number(tier));
    if (q) list = list.filter((m) => `${m.tool} ${m.label} ${m.note}`.toLowerCase().includes(q));
    return json(res, 200, {
      pricesChecked: PRICES_CHECKED,
      total: MODELS.length,
      modes: [...new Set(MODELS.flatMap((m) => m.modes))].sort(),
      models: list,
    });
  }

  const one = url.pathname.match(/^\/api\/models\/([\w.-]+)$/);
  if (one) {
    const m = MODELS.find((x) => x.id === one[1]);
    if (!m) return json(res, 404, { error: 'unknown model' });
    const tax = flagshipTax().rows.find((r) => r.id === m.id) || null;
    const cheaper = MODELS.filter((x) => !x.seat && !m.seat && x.tier >= m.tier && x.in < m.in && x.modes.some((mm) => m.modes.includes(mm)));
    return json(res, 200, { model: m, tax, cheaper, pricesChecked: PRICES_CHECKED });
  }

  if (url.pathname === '/api/rankings') {
    const calls = Number(url.searchParams.get('calls')) || 10000;
    return json(res, 200, { ...flagshipTax({ monthlyCalls: calls }), share: pickShare({ monthlyCalls: calls }) });
  }

  if (url.pathname === '/api/classify' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    return json(res, 200, classify(body.prompt || ''));
  }

  const file = join(ROOT, 'public', url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, ''));
  if (!file.startsWith(join(ROOT, 'public'))) return json(res, 403, { error: 'forbidden' });
  // Read before writing headers. Doing it the other way round means a missing
  // file (the browser asking for /favicon.ico) throws after the head is sent
  // and takes the process down.
  let buf;
  try {
    buf = await readFile(file);
  } catch {
    return json(res, 404, { error: 'not found' });
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'text/plain' });
  res.end(buf);
}).listen(PORT, () => console.log(`\n  tierline  http://localhost:${PORT}\n  ${MODELS.length} models, prices from ${PRICES_CHECKED}\n`));
