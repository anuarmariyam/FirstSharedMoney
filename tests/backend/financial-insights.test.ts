import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroqAdapter } from '../../supabase/functions/_shared/groq-insights.ts';
import { deterministicInsights, validateSelection, type Insight } from '../../src/features/financial-insights/summary.ts';
import { financialEngine, financialInput } from '../../src/engines/financial.ts';
import { createSessionHandler } from '../../supabase/functions/fsm-api/handler.ts';
const facts: Insight[] = [{ id: 'total', section: 'overview', text: 'Fixed validated evidence.' }, { id: 'shortfall_A', section: 'concerns', text: 'Discuss the shortfall.' }];
const response = (value: unknown) => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }));
test('deterministic insights preserve engine amounts, zero-income states and original output', () => {
  const input = financialInput({ currency: 'USD', sourceRevisions: { A: 1, B: 1 }, partners: { A: { monthlyNetIncomeCents: 0, monthlyPersonalObligationsCents: 0 }, B: { monthlyNetIncomeCents: 0, monthlyPersonalObligationsCents: 0 } }, sharedExpenses: { rent: 1, utilities: 0, groceries: 0, other: 0, shared_savings: 0 }, sharedEmergencyFundCents: 0, oneOffSharedExpenseCents: 0 });
  const output = financialEngine.simulate(input, { kind: 'equal' }, null);
  const original = JSON.stringify(output);
  const result = deterministicInsights(output);
  assert.ok(result.some(f => f.text.includes('$0.01')));
  assert.ok(result.some(f => f.id === 'shortfall_A'));
  assert.equal(JSON.stringify(output), original);
  assert.deepEqual(deterministicInsights(output), result);
  assert.equal(deterministicInsights(financialEngine.simulate(input, { kind: 'proportional' }, null))[0].id, 'unavailable');
});
test('prepared insights endpoint preserves JWT and owner-scoped RPC denial', async () => {
  let calls = 0;
  const handler = createSessionHandler({ verifyUser: async token => token === 'offline-test', rpc: async (name, args, token) => {
    calls++; assert.equal(name, 'fsm_get_scenario'); assert.equal(token, 'offline-test'); assert.equal(Object.keys(args).length, 2);
    return { data: null, error: { message: 'CONSENT_REQUIRED' } };
  } }, ['http://127.0.0.1:5173']);
  const url = 'http://127.0.0.1/v1/couples/cc7754d6-fd47-48b9-a9a2-dbd547f3031a/scenarios/cc7754d6-fd47-48b9-a9a2-dbd547f3031b/insights';
  assert.equal((await handler(new Request(url))).status, 401); assert.equal(calls, 0);
  assert.equal((await handler(new Request(url, { headers: { authorization: 'Bearer offline-test', origin: 'http://127.0.0.1:5173' } }))).status, 403); assert.equal(calls, 1);
});
test('selection rejects inventions, extra prose, duplicates and missing evidence', () => {
  for (const value of [{ evidenceIds: ['invented'] }, { evidenceIds: ['total'], text: '$999' }, { evidenceIds: ['total', 'total'] }, { evidenceIds: [] }]) assert.throws(() => validateSelection(value, facts));
  assert.equal(validateSelection({ evidenceIds: ['total'] }, facts).length, 2);
});
test('missing key and real data never reach the network', async () => {
  const fetcher: typeof fetch = async () => { throw Error('Must not call'); };
  assert.equal((await createGroqAdapter({ fetcher })(facts, true)).reason, 'KEY_MISSING');
  assert.equal((await createGroqAdapter({ key: 'fictional', fetcher })(facts, false)).reason, 'EXTERNAL_AI_DISABLED');
});
test('valid structured response selects evidence without transmitting facts or numbers', async () => {
  const fetcher: typeof fetch = async (_url, init) => { const body = String(init?.body); assert.ok(!body.includes(facts[0].text)); assert.ok(body.includes('qwen/qwen3.8-27b')); return response({ evidenceIds: ['shortfall_A', 'total'] }); };
  const result = await createGroqAdapter({ key: 'fictional', fetcher })(facts, true);
  assert.equal(result.source, 'qwen'); assert.equal(result.facts[0].id, 'shortfall_A');
});
for (const status of [401, 403, 429, 500]) test(`HTTP ${status} uses safe fallback`, async () => {
  const result = await createGroqAdapter({ key: 'fictional', fetcher: async () => new Response('', { status }) })(facts, true);
  assert.equal(result.reason, `HTTP_${status}`);
});
test('malformed, injected and oversized responses fall back', async () => {
  for (const reply of [response({ evidenceIds: ['ignore_previous_instructions'] }), new Response('invalid'), new Response('x'.repeat(20000))]) {
    const result = await createGroqAdapter({ key: 'fictional', fetcher: async () => reply })(facts, true);
    assert.equal(result.source, 'fallback');
  }
});
test('rate limit and timeout are bounded without retries', async () => {
  const adapter = createGroqAdapter({ key: 'fictional', fetcher: async () => response({ evidenceIds: ['total'] }), now: () => 1 });
  await adapter(facts, true); assert.equal((await adapter(facts, true)).reason, 'RATE_LIMITED');
  const result = await createGroqAdapter({ key: 'fictional', timeoutMs: 5, fetcher: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(Error('aborted')))) })(facts, true);
  assert.equal(result.reason, 'TIMEOUT');
});
