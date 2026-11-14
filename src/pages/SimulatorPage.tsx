import { useState } from "react";
import { useParams } from "react-router";
import { LiveSimulatorPage } from "../features/simulator/LiveSimulatorPage";
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
import { FinancialSummary } from "../features/simulator/FinancialSummary";
import {
  baselineFields,
  modelFixtures,
  stressExamples,
} from "../features/simulator/demo-fixtures";
import { formatMoney, parseMoneyInput } from "../lib/money";
import type { SplitPreference } from "../types/domain";

export default function SimulatorPage() {
  const { coupleId } = useParams();
  return coupleId === "demo" ? <DemoSimulatorPage /> : <LiveSimulatorPage />;
}
function DemoSimulatorPage() {
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
        All results below are hand-authored fictional fixtures. No calculation
        engine is connected, and your questionnaire answers are not used.
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
            Edit the fields to preview input states. New results require the
            future calculation engine.
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
              <Badge>Fixed example</Badge>
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
              {resultsAvailable && (
                <div className="model-total">
                  <span>Shared total</span>
                  <strong>
                    $3,200<span>/mo</span>
                  </strong>
                </div>
              )}
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
                <div
                  className="split-bar result-split"
                  aria-label={`Example contribution split: A ${fixture.shares[0]}, B ${fixture.shares[1]}`}
                >
                  <span style={{ width: `${fixture.bars[0]}%` }} />
                  <span style={{ width: `${fixture.bars[1]}%` }} />
                </div>
                <FinancialSummary result={fixture.result} />
                <div className="fixture-caption">
                  <Icon name="info" size={14} />
                  Static example amounts, not live calculations.
                </div>
              </>
            ) : (
              <EmptyState
                icon="sliders"
                title="Your draft inputs are ready for an engine."
              >
                The example result is hidden because you changed the inputs. New
                calculations are not connected yet.
                <div className="mt-5">
                  <Button variant="secondary" onClick={reset}>
                    Restore the fictional example
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
                  <div className="chart-bar-row">
                    <span>A</span>
                    <div>
                      <i style={{ width: `${modelFixtures[key].bars[0]}%` }} />
                    </div>
                    <strong>
                      {formatMoney(
                        modelFixtures[key].result.allocations.A
                          .monthlyContributionCents,
                      )}
                    </strong>
                  </div>
                  <div className="chart-bar-row bar-b">
                    <span>B</span>
                    <div>
                      <i style={{ width: `${modelFixtures[key].bars[1]}%` }} />
                    </div>
                    <strong>
                      {formatMoney(
                        modelFixtures[key].result.allocations.B
                          .monthlyContributionCents,
                      )}
                    </strong>
                  </div>
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
          <Badge tone="neutral">Scenario controls preview</Badge>
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
          <Notice title="Stress calculation not connected">
            {stressExamples.find((item) => item.id === stress)?.explanation}{" "}
            Selecting this control does not change the fixed baseline charts
            above.
          </Notice>
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
        <ButtonLink to="/sessions/demo/agreement">
          Preview our agreement <Icon name="arrow" />
        </ButtonLink>
      </div>
    </>
  );
}
