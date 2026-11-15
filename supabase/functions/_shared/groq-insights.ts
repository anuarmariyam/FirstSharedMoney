import { validateSelection, type Insight } from '../../../src/features/financial-insights/summary.ts';

export const QWEN_MODEL = 'qwen/qwen3.8-27b';
export function createGroqAdapter(options: { key?: string; fetcher?: typeof fetch; timeoutMs?: number; now?: () => number }) {
  let nextRequest = 0;
  return async (facts: readonly Insight[], fictionalOnly: boolean): Promise<{ source: 'qwen' | 'fallback'; facts: readonly Insight[]; reason?: string }> => {
    const fallback = (reason: string) => ({ source: 'fallback' as const, facts, reason });
    // This PoC does not implement external-AI consent storage. Real data is denied.
    if (!fictionalOnly) return fallback('EXTERNAL_AI_DISABLED');
    if (!options.key) return fallback('KEY_MISSING');
    const now = (options.now ?? Date.now)();
    if (now < nextRequest) return fallback('RATE_LIMITED');
    nextRequest = now + 60000;
    const ids = facts.map(f => f.id);
    if (!ids.length || ids.length > 16 || ids.some(id => !/^[a-zA-Z_]{1,40}$/.test(id))) return fallback('INVALID_EVIDENCE');
    // Send identifiers only, never amounts, raw answers, identities or untrusted text.
    const body = JSON.stringify({ model: QWEN_MODEL, max_completion_tokens: 512,
      messages: [{ role: 'system', content: 'Order the supplied evidence identifiers. Return JSON only. Do not add identifiers or prose.' }, { role: 'user', content: JSON.stringify({ evidenceIds: ids }) }],
      response_format: { type: 'json_schema', json_schema: { name: 'evidence_selection', strict: true, schema: { type: 'object', properties: { evidenceIds: { type: 'array', items: { type: 'string', enum: ids } } }, required: ['evidenceIds'], additionalProperties: false } } } });
    if (body.length > 8192) return fallback('REQUEST_TOO_LARGE');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    try {
      const response = await (options.fetcher ?? fetch)('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${options.key}`, 'Content-Type': 'application/json' }, body, signal: controller.signal });
      if (!response.ok) { await response.body?.cancel(); return fallback(`HTTP_${response.status}`); }
      const reader = response.body?.getReader();
      if (!reader) return fallback('EMPTY_RESPONSE');
      const decoder = new TextDecoder(); let text = '', size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 16384) { await reader.cancel(); return fallback('RESPONSE_TOO_LARGE'); } text += decoder.decode(part.value, { stream: true }); }
      text += decoder.decode();
      const envelope = JSON.parse(text);
      if (envelope.choices?.[0]?.finish_reason !== 'stop') return fallback('INCOMPLETE_RESPONSE');
      const value = JSON.parse(envelope.choices[0].message.content);
      return { source: 'qwen', facts: validateSelection(value, facts) };
    } catch { return fallback(controller.signal.aborted ? 'TIMEOUT' : 'INVALID_RESPONSE'); }
    finally { clearTimeout(timer); }
  };
}
