import type { SimulationOutput } from '../../types/domain.ts';
import { formatMoney } from '../../lib/money.ts';

export interface Insight { id: string; section: 'overview' | 'observations' | 'concerns' | 'questions'; text: string }
/** Only engine results supply money. No private notes, identities or external data. */
export function deterministicInsights(output: SimulationOutput): readonly Insight[] {
  const split = output.split;
  if (split.status !== 'available') return [{ id: 'unavailable', section: 'concerns', text: 'Proportional sharing is unavailable when both incomes are zero.' }];
  const facts: Insight[] = [{ id: 'total', section: 'overview', text: `Your shared monthly plan is ${formatMoney(split.monthlySharedTotalCents)}, including savings.` }];
  const costs = output.effectiveInput.sharedExpenses;
  const largest = Object.entries(costs).sort((a, b) => b[1] - a[1])[0];
  if (largest && largest[1] > 0) facts.push({ id: 'largest', section: 'observations', text: `${largest[0].replaceAll('_', ' ')} is the largest monthly allocation: ${formatMoney(largest[1])}.` });
  for (const slot of ['A', 'B'] as const) {
    const allocation = split.allocations[slot];
    facts.push({ id: `contribution_${slot}`, section: 'observations', text: `Partner ${slot} contributes ${formatMoney(allocation.monthlyContributionCents)} monthly and has ${formatMoney(allocation.availableAfterObligationsCents)} remaining after modeled costs and personal obligations.` });
    if (allocation.availableAfterObligationsCents < 0) facts.push({ id: `shortfall_${slot}`, section: 'concerns', text: `Partner ${slot} has a shortfall in this scenario. Discuss which costs or targets could change.` });
  }
  if (split.oneOffSharedTotalCents || output.reserveUsedCents) facts.push({ id: 'reserve', section: 'observations', text: `This scenario uses ${formatMoney(output.reserveUsedCents)} of the reserve and leaves ${formatMoney(split.oneOffSharedTotalCents)} in uncovered one-time costs.` });
  facts.push({ id: 'discuss', section: 'questions', text: 'Does this split leave each of you enough room for personal commitments and unexpected costs?' });
  return facts;
}

/** AI may select existing evidence only; it cannot supply prose or numeric claims. */
export function validateSelection(value: unknown, facts: readonly Insight[]): readonly Insight[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'evidenceIds') throw Error('INVALID_AI_RESPONSE');
  const ids = (value as { evidenceIds: unknown }).evidenceIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > facts.length || new Set(ids).size !== ids.length) throw Error('INVALID_AI_RESPONSE');
  const selected = ids.map(id => {
    const fact = facts.find(f => f.id === id);
    if (!fact) throw Error('INVALID_AI_RESPONSE');
    return fact;
  });
  // Keep complete deterministic coverage; optional ordering cannot suppress concerns.
  return [...selected, ...facts.filter(f => !ids.includes(f.id))];
}
