import { BudgetOverview } from "../components/financial/BudgetOverview";
import { useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  EmptyState,
  MoneyInput,
  Notice,
  PageHeading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { BudgetBreakdown } from "../components/financial/BudgetBreakdown";
import { ContributionComparison } from "../components/financial/ContributionComparison";
import { ScenarioComparison } from "../components/financial/ScenarioComparison";
import { FinancialSummary } from "../features/simulator/FinancialSummary";
import {
  baselineFields,
  modelFixtures,
  stressExamples,
} from "../features/simulator/demo-fixtures";
import { parseMoneyInput } from "../lib/money";
import type { SplitPreference } from "../types/domain";

function sampleAmount(value: string) {
  const parsed = parseMoneyInput(value);
  if (!parsed.ok) throw new Error("Invalid supplied sample amount");
  return parsed.value;
}
const sampleExpenses = {
  rent: sampleAmount(baselineFields.rent),
  utilities: sampleAmount(baselineFields.utilities),
  groceries: sampleAmount(baselineFields.groceries),
  other: sampleAmount(baselineFields.other),
  shared_savings: sampleAmount(baselineFields.savings),
};

export default function SimulatorPage() {
  const [model, setModel] = useState<SplitPreference>("proportional");
  const [fields, setFields] = useState({ ...baselineFields });
  const [customShare, setCustomShare] = useState(40);
  const partnerBShare = 100 - customShare;
  const [stress, setStress] = useState<string | null>(null);
  const fixture = modelFixtures[model];
  const baselineMatches = (
    Object.keys(baselineFields) as (keyof typeof baselineFields)[]
  ).every((key) => fields[key] === baselineFields[key]);
  const resultsAvailable =
    baselineMatches && (model !== "custom" || customShare === 40);
  function reset() {
    setFields({ ...baselineFields });
    setCustomShare(40);
    setStress(null);
  }
  function moneyField(key: keyof typeof baselineFields, label: string) {
    const parsed = parseMoneyInput(fields[key]);
    return (
      <MoneyInput
        id={`sim-${key}`}
        key={key}
        label={label}
        value={fields[key]}
        onChange={(value) =>
          setFields((previous) => ({ ...previous, [key]: value }))
        }
        error={parsed.ok ? undefined : parsed.error}
      />
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CLARITY IN THE NUMBERS"
        title="Find a balance that feels workable."
        description="Explore ways to share everyday costs, with room for each person’s circumstances."
      />
      <DemoNotice>
        Sample Data. These fixed examples are independent of your questionnaire.
        Changing demo inputs hides the sample result; use the connected app for
        live calculations.
      </DemoNotice>
      <div className="simulator-grid">
        <section className="surface simulator-inputs">
          <div className="section-title-row">
            <h2>The example budget</h2>
            <Button
              variant="ghost"
              onClick={reset}
              aria-label="Restore example budget"
            >
              <Icon name="refresh" size={15} />
              Reset
            </Button>
          </div>
          <p className="muted small-copy">
            Explore the sample budget below. Edited amounts are not recalculated
            in Demo.
          </p>
          <div className="income-inputs">
            {moneyField("incomeA", "Partner A · take-home income")}
            {moneyField("incomeB", "Partner B · take-home income")}
          </div>
          <div className="input-section-label">
            <Icon name="home" size={16} />
            Shared monthly costs
          </div>
          <div className="expense-inputs">
            {moneyField("rent", "Rent & home")}
            {moneyField("utilities", "Utilities")}
            {moneyField("groceries", "Groceries")}
            {moneyField("other", "Other shared costs")}
            {moneyField("savings", "Shared savings")}
          </div>
          <div className="input-section-label">
            <Icon name="shield" size={16} />
            For the unexpected
          </div>
          {moneyField("reserve", "Shared reserve available now")}
          <p className="field-hint">
            Example personal obligations: A $600/mo · B $300/mo. These are
            separate from shared costs.
          </p>
        </section>
        <div className="simulator-results">
          <section className="surface model-panel">
            <div className="section-title-row">
              <h2>Three ways to share</h2>
              <Badge>Sample Data</Badge>
            </div>
            <div
              className="model-switch"
              role="group"
              aria-label="Expense split model"
            >
              {(["equal", "proportional", "custom"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={model === key}
                  className={model === key ? "selected" : ""}
                  onClick={() => setModel(key)}
                >
                  {key === "equal"
                    ? "Equal"
                    : key === "proportional"
                      ? "Proportional"
                      : "Custom"}
                </button>
              ))}
            </div>
            <div className="model-description">
              <div>
                <h3>{fixture.label}</h3>
                <p>{fixture.description}</p>
              </div>

            </div>
            {model === "custom" && (
              <div className="custom-share">
                <label htmlFor="custom-share">
                  Partner A’s share <strong>{customShare}%</strong>
                </label>
                <input
                  id="custom-share"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={customShare}
                  onChange={(event) =>
                    setCustomShare(Number(event.target.value))
                  }
                />
                <div>
                  <span>Partner A · {customShare}%</span>
                  <span>Partner B · {partnerBShare}%</span>
                </div>
                <p className="field-hint">
                  Only the 40% / 60% fictional result is available in this
                  preview.
                </p>
              </div>
            )}
            {resultsAvailable ? (
              <>
                <BudgetOverview
                  result={fixture.result}
                  sharedSavingsCents={sampleExpenses.shared_savings}
                  reserveCents={sampleAmount(baselineFields.reserve)}
                />
                <BudgetBreakdown
                  expenses={sampleExpenses}
                  monthlyTotalCents={fixture.result.monthlySharedTotalCents}
                />
                <FinancialSummary result={fixture.result} />
                <div className="fixture-caption">
                  <Icon name="info" size={14} />
                  Sample Data · fixed monthly results
                </div>
              </>
            ) : (
              <EmptyState
                icon="sliders"
                title="Live calculations are available in the connected app."
              >
                You changed the demo inputs. Restore Sample Data to see the
                fixed example, or use the connected app to calculate your own
                plan.
                <div className="mt-5">
                  <Button variant="secondary" onClick={reset}>
                    Restore Sample Data
                  </Button>
                </div>
              </EmptyState>
            )}
          </section>
          <section className="surface model-comparison">
            <h2>See the approaches side by side</h2>
            <p className="muted small-copy">
              Read-only comparison of the original $3,200 fictional budget.
            </p>
            <div className="comparison-chart">
              {(["equal", "proportional", "custom"] as const).map((key) => (
                <div className="chart-model" key={key}>
                  <strong>
                    {key === "custom"
                      ? "Custom 40 / 60"
                      : modelFixtures[key].label}
                  </strong>
                  <ContributionComparison result={modelFixtures[key].result} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <section className="stress-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">LIFE DOESN’T ALWAYS FOLLOW THE PLAN</p>
            <h2>Leave room for the what-ifs.</h2>
          </div>
          <Badge tone="neutral">Demo scenarios</Badge>
        </div>
        <div className="stress-grid">
          {stressExamples.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={stress === item.id}
              className={`stress-card ${stress === item.id ? "selected" : ""}`}
              onClick={() => setStress(stress === item.id ? null : item.id)}
            >
              <Icon name={item.icon} size={22} />
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
        {stress && (
          <Notice title="Scenario example only">
            {stress === "rent_increase"
              ? "Explore a $300 increase in monthly rent."
              : stress === "income_reduction"
                ? "Explore a 20% reduction in Partner A’s income."
                : stress === "income_loss"
                  ? "Explore a month without Partner B’s income."
                  : stress === "savings_change"
                    ? "Explore a $500 monthly savings allocation, replacing the existing target."
                    : "Explore a $1,000 one-time bill. The engine uses the reserve before splitting the uncovered cost."}{" "}
            Demo keeps the baseline unchanged. The connected app calculates the
            impact.
          </Notice>
        )}
        {stress && (
          <div className="surface scenario-panel">
            <ScenarioComparison before={null} after={null} />
          </div>
        )}
      </section>
      <div className="next-step-banner">
        <div>
          <p className="eyebrow">FROM POSSIBILITIES TO A SHARED DRAFT</p>
          <h2>Give the conversation a little structure.</h2>
          <p>
            The agreement preview uses the original fictional proportional
            example.
          </p>
        </div>
        <ButtonLink to="/sessions/demo/agreement">Preview agreement</ButtonLink>
      </div>
    </>
  );
}
