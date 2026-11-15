import { useState } from 'react';
import type { SimulationOutput } from '../../types/domain';
import { Button } from '../../components/ui';
import { deterministicInsights } from './summary';

export function InsightsPanel({ output }: { output: SimulationOutput }) {
  const [generated, setGenerated] = useState(false);
  const facts = generated ? deterministicInsights(output) : [];
  return <section className="surface scenario-panel" aria-label="Your Financial Insights">
    <h2>Your Financial Insights</h2>
    <p className="field-hint">Understand this budget and find questions to discuss together. No information is sent to an outside AI service.</p>
    <Button onClick={() => setGenerated(true)}>Generate Insights</Button>
    {(['overview', 'observations', 'concerns', 'questions'] as const).map(section => {
      const items = facts.filter(f => f.section === section);
      return items.length ? <div key={section}><h3>{({ overview: 'Financial overview', observations: 'Main observations', concerns: 'Potential concerns', questions: 'Discussion questions' })[section]}</h3><ul>{items.map(f => <li key={f.id}>{f.text}</li>)}</ul></div> : null;
    })}
  </section>;
}
