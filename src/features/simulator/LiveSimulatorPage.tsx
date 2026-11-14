import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  LoadingState,
  MoneyInput,
  Notice,
  PageHeading,
} from "../../components/ui";
import { FinancialSummary } from "./FinancialSummary";
import { useSharedResource } from "../../hooks/useSharedResource";
import { fsmClient } from "../../services/fsm-client";
import { sessionError } from "../../services/session-error";
import { parseMoneyInput, formatMoney } from "../../lib/money";
import {
  expenseKeys,
  financialEngine,
  financialInput,
  splitModel,
  stressTest,
} from "../../engines/financial";
import type {
  CoupleSession,
  FinancialInput,
  FinancialScenario,
  RequestId,
  SplitCalculation,
  SplitModel,
  StressTestScenario,
} from "../../types/domain";
import type { CreateScenarioRequest } from "../../types/api";

const labels = {
  rent: "Rent & home",
  utilities: "Utilities",
  groceries: "Groceries",
  other: "Other shared costs",
  shared_savings: "Shared savings",
};
const dollars = (n: number) =>
  `${Math.floor(n / 100)}.${String(n % 100).padStart(2, "0")}`;
function keyOf(
  input: FinancialInput,
  model: SplitModel,
  stress: StressTestScenario | null,
) {
  return JSON.stringify({
    expectedRevisions: input.sourceRevisions,
    sharedExpenses: input.sharedExpenses,
    sharedEmergencyFundCents: input.sharedEmergencyFundCents,
    model,
    stressTest: stress,
  });
}
function barWidth(
  result: Extract<SplitCalculation, { status: "available" }>,
  slot: "A" | "B",
) {
  return result.monthlySharedTotalCents === 0
    ? 0
    : (result.allocations[slot].monthlyContributionCents /
        result.monthlySharedTotalCents) *
        100;
}
function warningText(code: string, slot: string | null) {
  return code === "reserve_exhausted"
    ? "The shared emergency reserve is exhausted in this scenario."
    : code === "zero_income"
      ? `Partner ${slot} has no income in this scenario.`
      : `Partner ${slot}'s modeled costs exceed available income.`;
}

export function LiveSimulatorPage() {
  const { session } = useOutletContext<{ session: CoupleSession }>();
  return (
    <SimulatorLoader
      key={`${session.id}/${session.viewerPartnerId}`}
      coupleId={session.id}
    />
  );
}
function SimulatorLoader({ coupleId }: { coupleId: string }) {
  const inputs = useSharedResource("getFinancialInputs", coupleId);
  const [params] = useSearchParams();
  const [initialId, setInitialId] = useState(() => params.get("scenario"));
  const [restored, setRestored] = useState<{
    id: string;
    value: FinancialScenario | null;
    error: string;
  } | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!initialId) return;
    const controller = new AbortController();
    void fsmClient
      .request(
        "getScenario",
        null,
        { coupleId, scenarioId: initialId },
        { signal: controller.signal },
      )
      .then((value) => {
        if (!controller.signal.aborted)
          setRestored({ id: initialId, value, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setRestored({
            id: initialId,
            value: null,
            error: sessionError(error).message,
          });
      });
    return () => controller.abort();
  }, [coupleId, initialId]);
  if (inputs.loading || (initialId && restored?.id !== initialId))
    return <LoadingState />;
  if (!inputs.data)
    return (
      <EmptyState title="Your shared budget is not ready.">
        {inputs.error?.message}
        <div className="mt-6 flex gap-3">
          <ButtonLink to={`/sessions/${coupleId}/questionnaire/consent`}>
            My sharing choices
          </ButtonLink>
          <Button variant="secondary" onClick={inputs.reload}>
            Refresh
          </Button>
        </div>
      </EmptyState>
    );
  if (initialId && restored?.error)
    return (
      <EmptyState title="This saved scenario is unavailable.">
        {restored.error}
        <div className="mt-6">
          <Button
            onClick={() => {
              setInitialId(null);
              navigate(`/sessions/${coupleId}/simulator`, { replace: true });
            }}
          >
            Start a new scenario
          </Button>
        </div>
      </EmptyState>
    );
  return (
    <SimulatorForm
      coupleId={coupleId}
      source={inputs.data}
      initial={initialId ? (restored?.value ?? null) : null}
    />
  );
}
function SimulatorForm({
  coupleId,
  source,
  initial,
}: {
  coupleId: string;
  source: FinancialInput;
  initial: FinancialScenario | null;
}) {
  const [fields, setFields] = useState(
    () =>
      Object.fromEntries(
        expenseKeys.map((key) => [
          key,
          dollars(initial?.input.sharedExpenses[key] ?? 0),
        ]),
      ) as Record<(typeof expenseKeys)[number], string>,
  );
  const [reserve, setReserve] = useState(() =>
    dollars(initial?.input.sharedEmergencyFundCents ?? 0),
  );
  const [modelKind, setModel] = useState<SplitModel["kind"]>(
    () => initial?.model.kind ?? "proportional",
  );
  const [customShare, setCustomShare] = useState(() =>
    initial?.model.kind === "custom"
      ? initial.model.partnerAShareBasisPoints
      : 5000,
  );
  const [stressKind, setStress] = useState<StressTestScenario["kind"] | null>(
    () => initial?.stressTest?.kind ?? null,
  );
  const [stressPartner, setPartner] = useState<"A" | "B">(() =>
    initial?.stressTest && "partnerSlot" in initial.stressTest
      ? initial.stressTest.partnerSlot
      : "A",
  );
  const [newSavings, setNewSavings] = useState(() =>
    dollars(
      initial?.stressTest?.kind === "savings_change"
        ? initial.stressTest.monthlyTargetCents
        : 0,
    ),
  );
  const [saved, setSaved] = useState(() =>
    initial
      ? {
          key: keyOf(initial.input, initial.model, initial.stressTest),
          value: initial,
        }
      : null,
  );
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [retry, refresh] = useReducer((n) => n + 1, 0);
  const ids = useRef(new Map<string, RequestId>());
  const navigate = useNavigate();
  const sourceKey = JSON.stringify(source);
  const calculation = useMemo(() => {
    try {
      const parse = (text: string) => {
        const result = parseMoneyInput(text);
        if (!result.ok) throw new Error("INVALID_INPUT");
        return result.value;
      };
      const costs = Object.fromEntries(
        expenseKeys.map((key) => [key, parse(fields[key])]),
      ) as FinancialInput["sharedExpenses"];
      const input = financialInput({
        ...JSON.parse(sourceKey),
        sharedExpenses: costs,
        sharedEmergencyFundCents: parse(reserve),
      });
      const model = splitModel(
        modelKind === "custom"
          ? { kind: modelKind, partnerAShareBasisPoints: customShare }
          : { kind: modelKind },
      );
      const stress = stressTest(
        stressKind === null
          ? null
          : stressKind === "rent_increase"
            ? { kind: stressKind, increaseCents: 30000 }
            : stressKind === "income_reduction"
              ? {
                  kind: stressKind,
                  partnerSlot: stressPartner,
                  reductionBasisPoints: 2000,
                }
              : stressKind === "income_loss"
                ? { kind: stressKind, partnerSlot: stressPartner }
                : stressKind === "unexpected_expense"
                  ? { kind: stressKind, amountCents: 100000 }
                  : { kind: stressKind, monthlyTargetCents: parse(newSavings) },
      );
      const models = (["equal", "proportional", "custom"] as const).map(
        (kind) => ({
          kind,
          output: financialEngine.simulate(
            input,
            splitModel(
              kind === "custom"
                ? { kind, partnerAShareBasisPoints: customShare }
                : { kind },
            ),
            stress,
          ),
        }),
      );
      return { input, model, stress, models, key: keyOf(input, model, stress) };
    } catch {
      return null;
    }
  }, [
    sourceKey,
    fields,
    reserve,
    modelKind,
    customShare,
    stressKind,
    stressPartner,
    newSavings,
  ]);
  useEffect(() => {
    if (!calculation || saved?.key === calculation.key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const { input, model, stress, key } = calculation;
      let requestId = ids.current.get(key);
      if (!requestId) {
        requestId = crypto.randomUUID() as RequestId;
        ids.current.set(key, requestId);
      }
      const body: CreateScenarioRequest = {
        requestId,
        expectedRevisions: input.sourceRevisions,
        sharedExpenses: input.sharedExpenses,
        sharedEmergencyFundCents: input.sharedEmergencyFundCents,
        model,
        stressTest: stress,
      };
      void fsmClient
        .request(
          "createScenario",
          body,
          { coupleId },
          { signal: controller.signal },
        )
        .then((value) => {
          if (!controller.signal.aborted) {
            setSaved({ key, value });
            setFailure(null);
            navigate(`/sessions/${coupleId}/simulator?scenario=${value.id}`, {
              replace: true,
            });
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setFailure({ key, message: sessionError(error).message });
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [calculation, coupleId, navigate, saved?.key, retry]);
  const current =
    calculation && saved?.key === calculation.key ? saved.value : null;
  const error = failure?.key === calculation?.key ? failure?.message : null;
  const result = current?.output.split;
  const stateLabel = !calculation
    ? "Check the amounts"
    : error
      ? "Could not save"
      : current
        ? "Saved scenario"
        : "Updating…";
  return (
    <>
      <PageHeading
        eyebrow="YOUR SHARED BUDGET"
        title="Find a balance that feels workable."
        description="Compare ways to share costs using your submitted income and obligations."
      />
      <div className="simulator-grid">
        <section className="surface simulator-inputs">
          <h2>Your household budget</h2>
          <div className="income-inputs">
            {(["A", "B"] as const).map((slot) => (
              <div key={slot}>
                <strong>Partner {slot}</strong>
                <p>
                  Take-home income:{" "}
                  {formatMoney(source.partners[slot].monthlyNetIncomeCents)}
                </p>
                <p className="field-hint">
                  Personal obligations:{" "}
                  {formatMoney(
                    source.partners[slot].monthlyPersonalObligationsCents,
                  )}
                </p>
              </div>
            ))}
          </div>
          <p className="field-hint">
            Each partner updates income in their own questionnaire.
          </p>
          <div className="expense-inputs">
            {expenseKeys.map((key) => (
              <MoneyInput
                key={key}
                id={`live-${key}`}
                label={labels[key]}
                value={fields[key]}
                onChange={(value) =>
                  setFields((old) => ({ ...old, [key]: value }))
                }
                error={
                  parseMoneyInput(fields[key]).ok
                    ? undefined
                    : "Enter a nonnegative dollar amount."
                }
              />
            ))}
          </div>
          <MoneyInput
            id="live-reserve"
            label="Shared reserve available now"
            value={reserve}
            onChange={setReserve}
          />
        </section>
        <div className="simulator-results">
          <section className="surface model-panel">
            <div className="section-title-row">
              <h2>Three ways to share</h2>
              <Badge>{stateLabel}</Badge>
            </div>
            <div
              className="model-switch"
              role="group"
              aria-label="Expense split model"
            >
              {(["equal", "proportional", "custom"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={modelKind === kind}
                  className={modelKind === kind ? "selected" : ""}
                  onClick={() => setModel(kind)}
                >
                  {kind === "equal"
                    ? "Equal"
                    : kind === "proportional"
                      ? "Proportional"
                      : "Custom"}
                </button>
              ))}
            </div>
            {modelKind === "custom" && (
              <div className="custom-share">
                <label htmlFor="live-share">
                  Partner A’s share <strong>{customShare / 100}%</strong>
                </label>
                <input
                  id="live-share"
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={customShare}
                  onChange={(event) =>
                    setCustomShare(Number(event.target.value))
                  }
                />
              </div>
            )}
            {error && (
              <div role="alert">
                <Notice tone="warning">{error}</Notice>
                <Button variant="secondary" onClick={refresh}>
                  Retry
                </Button>
              </div>
            )}
            {!calculation ? (
              <Notice tone="warning">
                Check the amounts and combined spending limit.
              </Notice>
            ) : !current && !error ? (
              <LoadingState />
            ) : null}
            {result?.status === "unavailable" && (
              <EmptyState title="This proportional split needs income.">
                Both submitted incomes are zero. Compare Equal or Custom
                instead.
              </EmptyState>
            )}
            {result?.status === "available" && (
              <>
                <div className="model-total">
                  <span>Shared monthly total</span>
                  <strong>{formatMoney(result.monthlySharedTotalCents)}</strong>
                </div>
                <FinancialSummary result={result} />
                <p>
                  Shared savings included:{" "}
                  {formatMoney(
                    current!.output.effectiveInput.sharedExpenses
                      .shared_savings,
                  )}
                </p>
                <p>
                  Uncovered one-off expense:{" "}
                  {formatMoney(result.oneOffSharedTotalCents)} · A{" "}
                  {formatMoney(result.allocations.A.oneOffContributionCents)} ·
                  B {formatMoney(result.allocations.B.oneOffContributionCents)}
                </p>
                <p>
                  Reserve used: {formatMoney(current!.output.reserveUsedCents)}{" "}
                  · Remaining reserve:{" "}
                  {formatMoney(
                    current!.output.effectiveInput.sharedEmergencyFundCents,
                  )}
                </p>
                {result.warnings.map((warning, i) => (
                  <Notice key={i} tone="warning">
                    {warningText(warning.code, warning.partnerSlot)}
                  </Notice>
                ))}
              </>
            )}
          </section>
          {calculation && (
            <section className="surface model-comparison">
              <h2>Compare the approaches</h2>
              <p className="field-hint">
                Same inputs for every model. The server saves the selected
                scenario.
              </p>
              <div className="comparison-chart">
                {calculation.models.map(({ kind, output }) => (
                  <div className="chart-model" key={kind}>
                    <strong>
                      {kind === "equal"
                        ? "Equal"
                        : kind === "proportional"
                          ? "Proportional"
                          : "Custom"}
                    </strong>
                    {output.split.status === "available" ? (
                      (["A", "B"] as const).map((slot) => {
                        const split = output.split;
                        return split.status === "available" ? (
                          <div
                            className={`chart-bar-row ${slot === "B" ? "bar-b" : ""}`}
                            key={slot}
                          >
                            <span>{slot}</span>
                            <div>
                              <i
                                style={{ width: `${barWidth(split, slot)}%` }}
                              />
                            </div>
                            <strong>
                              {formatMoney(
                                split.allocations[slot]
                                  .monthlyContributionCents,
                              )}
                            </strong>
                          </div>
                        ) : null;
                      })
                    ) : (
                      <p>N/A — both incomes are zero.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <section className="stress-section">
        <h2>Leave room for the what-ifs.</h2>
        <div className="stress-grid">
          {(
            [
              ["rent_increase", "Rent +$300"],
              ["income_reduction", "Income −20%"],
              ["unexpected_expense", "$1,000 unexpected cost"],
              ["income_loss", "Temporary income loss"],
              ["savings_change", "Change savings"],
            ] as const
          ).map(([kind, label]) => (
            <button
              type="button"
              key={kind}
              className={`stress-card ${stressKind === kind ? "selected" : ""}`}
              aria-pressed={stressKind === kind}
              onClick={() => setStress(stressKind === kind ? null : kind)}
            >
              <strong>{label}</strong>
            </button>
          ))}
        </div>
        {(stressKind === "income_reduction" ||
          stressKind === "income_loss") && (
          <label>
            Income change applies to{" "}
            <select
              aria-label="Income change applies to"
              value={stressPartner}
              onChange={(event) => setPartner(event.target.value as "A" | "B")}
            >
              <option value="A">Partner A</option>
              <option value="B">Partner B</option>
            </select>
          </label>
        )}
        {stressKind === "savings_change" && (
          <MoneyInput
            id="live-new-savings"
            label="New monthly savings target"
            value={newSavings}
            onChange={setNewSavings}
          />
        )}
      </section>
      <div className="next-step-banner">
        {current&&current.stressTest===null&&current.output.split.status==='available'&&<ButtonLink to={`/sessions/${coupleId}/agreement?scenario=${current.id}`}>Create money agreement</ButtonLink>}
        <p>
          Scenarios explore choices. They do not change private answers or
          approve an agreement.
        </p>
        <ButtonLink
          to={`/sessions/${coupleId}/questionnaire/consent`}
          variant="secondary"
        >
          My sharing choices
        </ButtonLink>
      </div>
    </>
  );
}
