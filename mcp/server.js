#!/usr/bin/env node
// MCP stdio server. Register it in .mcp.json:
//   { "mcpServers": { "tierline": { "command": "npx", "args": ["-y", "tierline", "mcp"] } } }

import { createInterface } from 'node:readline';
import { recommend } from '../src/recommend.js';
import { MODELS, PRICES_CHECKED } from '../src/models.js';

const TOOLS = [
  {
    name: 'tierline_pick_model',
    description:
      'Before you spend frontier tokens, check what the job actually needs. Reads a prompt, works out the modality and how much reasoning it really takes, and returns the cheapest model that clears that bar plus what routing everything to a flagship would cost instead. Use it on any task that will run more than a handful of times.',
    inputSchema: {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', description: 'The prompt you were about to run.' },
        monthlyCalls: { type: 'number', description: 'How often it runs per month. Drives the projection.' },
      },
    },
  },
  {
    name: 'tierline_catalogue',
    description: 'List the model catalogue with prices, tiers and modalities.',
    inputSchema: { type: 'object', properties: { mode: { type: 'string' } } },
  },
];

function call(name, args = {}) {
  if (name === 'tierline_catalogue') {
    const list = args.mode ? MODELS.filter((m) => m.modes.includes(args.mode)) : MODELS;
    return [
      `${list.length} models, prices from ${PRICES_CHECKED}`,
      '',
      ...list.map((m) => `${m.tool} / ${m.label}  tier ${m.tier}  [${m.modes.join(' ')}]  ${m.seat ? `$${m.seat}/seat` : `$${m.in} in, $${m.out} out`}`),
    ].join('\n');
  }

  const r = recommend(args.prompt, { monthlyCalls: args.monthlyCalls || 10000 });
  const e = r.economics;
  return [
    `${r.pick.tool} / ${r.pick.label}`,
    `read as ${r.task.mode} work at ${r.task.tierName} tier`,
    '',
    r.pick.why,
    '',
    `$${r.pick.costPerCall} ${r.pick.unit}. At ${e.monthlyCalls} calls a month that is $${e.monthly.toFixed(2)}.`,
    `Everything through ${e.naiveModel} would be $${e.naiveMonthly.toFixed(2)}, so this saves ${e.savedPct}%.`,
    '',
    'Alternatives:',
    ...r.alternatives.map((a) => `- ${a.label} at $${a.costPerCall}. ${a.note}`),
    ...(r.subscriptions.length ? ['', 'Seat priced:', ...r.subscriptions.map((s) => `- ${s.label} at $${s.seatUsd} per seat per month`)] : []),
    '',
    'Cautions:',
    ...r.cautions.map((c) => `- ${c}`),
    '',
    `Prices are a snapshot from ${r.pricesChecked}. Verify before budgeting.`,
  ].join('\n');
}

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      return send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'tierline', version: '0.1.0' } } });
    }
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: call(params.name, params.arguments || {}) }] } });
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method: ${method}` } });
  } catch (err) {
    if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
  }
});
