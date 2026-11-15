import { existsSync } from 'node:fs';
import { financialEngine, financialInput } from '../src/engines/financial.ts';
import { deterministicInsights } from '../src/features/financial-insights/summary.ts';
import { createGroqAdapter } from '../supabase/functions/_shared/groq-insights.ts';
if (existsSync('.env.groq.local')) process.loadEnvFile('.env.groq.local');
const output = financialEngine.simulate(financialInput({ currency: 'USD', sourceRevisions: { A: 1, B: 1 }, partners: { A: { monthlyNetIncomeCents: 500000, monthlyPersonalObligationsCents: 60000 }, B: { monthlyNetIncomeCents: 300000, monthlyPersonalObligationsCents: 30000 } }, sharedExpenses: { rent: 220000, utilities: 30000, groceries: 50000, other: 20000, shared_savings: 50000 }, sharedEmergencyFundCents: 100000, oneOffSharedExpenseCents: 0 }), { kind: 'proportional' }, null);
const key = process.env.FSM_GROQ_FREE_POC === '1' ? process.env.GROQ_API_KEY : undefined;
const result = await createGroqAdapter({ key })(deterministicInsights(output), true);
console.log(JSON.stringify({ fictionalOnly: true, model: 'qwen/qwen3.8-27b', ...result }, null, 2));
