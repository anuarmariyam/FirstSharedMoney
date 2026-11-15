import { useRef, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router";
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
import { AgreementStatus } from "../../components/AgreementStatus";
import { AgreementConfirmations } from "./presentation/AgreementConfirmations";
import { useSharedResource } from "../../hooks/useSharedResource";
import { fsmClient } from "../../services/fsm-client";
import { sessionError } from "../../services/session-error";
import {
  agreementRules,
  rulesFromAgreement,
} from "../../../supabase/functions/_shared/agreement-contract";
import { formatMoney, parseMoneyInput } from "../../lib/money";
import type {
  AgreementRules,
  AgreementVersion,
  CoupleSession,
  RequestId,
} from "../../types/domain";

export function LiveAgreementPage({ preview = false }: { preview?: boolean }) {
  const { session } = useOutletContext<{ session: CoupleSession }>();
  const agreement = useSharedResource("getCurrentAgreement", session.id);
  const inputs = useSharedResource("getFinancialInputs", session.id);
  const [params] = useSearchParams();
  if (agreement.loading) return <LoadingState />;
  if (agreement.error)
    return (
      <EmptyState title="Your agreement could not be loaded.">
        {agreement.error.message}
        <div className="mt-6">
          <Button onClick={agreement.reload}>Retry</Button>
        </div>
      </EmptyState>
    );
  const v = agreement.data;
  const ready =
    !!inputs.data &&
    (!v ||
      (v.sourceRevisions.A === inputs.data.sourceRevisions.A &&
        v.sourceRevisions.B === inputs.data.sourceRevisions.B));
  return (
    <>
      <PageHeading
        eyebrow="YOUR FIRST MONEY AGREEMENT"
        title={
          v
            ? `Your shared plan, version ${v.versionNumber}.`
            : "Put your shared plan into words."
        }
        description="Review the same terms and confirm independently."
      />
      {!ready && !inputs.loading && (
        <Notice tone="warning">
          {inputs.error?.message ??
            "Financial inputs changed. Save a current baseline scenario before creating and confirming a new version."}
        </Notice>
      )}
      {v ? (
        <AgreementReview
          key={`${v.id}/${v.status}/${preview}`}
          version={v}
          session={session}
          ready={ready}
          reload={agreement.reload}
        />
      ) : preview ? (
        <Notice>Select a saved budget and set your rules to create an agreement.</Notice>
      ) : null}
      {!preview && (
        <AgreementForm
          key={v?.id ?? "new"}
          current={v}
          coupleId={session.id}
          suggestedScenario={params.get("scenario")}
          reload={agreement.reload}
          budgetAllowed={!!inputs.data}
        />
      )}
      {preview && (
        <div className="mt-6">
          <ButtonLink to={`/sessions/${session.id}/agreement`}>
            Back to your agreement
          </ButtonLink>
        </div>
      )}
    </>
  );
}
function AgreementReview({
  version: v,
  session,
  ready,
  reload,
}: {
  version: AgreementVersion;
  session: CoupleSession;
  ready: boolean;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const slot = session.partners.find(
    (p) => p.id === session.viewerPartnerId,
  )!.slot;
  const already = !!v.approvals[slot];
  async function action(
    kind: "proposeAgreement" | "approveAgreement" | "exportAgreement",
  ) {
    setBusy(true);
    setError("");
    try {
      const data = await fsmClient.request(
        kind,
        { expectedHeadVersionId: v.id, expectedContentHash: v.contentHash },
        { coupleId: session.id, versionId: v.id },
      );
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data),
          a = document.createElement("a");
        a.href = url;
        a.download = `First-Money-Agreement-v${v.versionNumber}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else reload();
    } catch (e) {
      setError(sessionError(e).message);
      reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface agreement-section">
      <AgreementStatus status={v.status} />
      <p>
        <Badge>
          {v.status === "under_review"
            ? "Under Review"
            : v.status === "approved"
              ? "Approved"
              : v.status === "proposed"
                ? "Proposed"
                : "Draft"}
        </Badge>{" "}
        Version {v.versionNumber}
      </p>
      <AgreementDetails version={v} />
      {error && (
        <div role="alert">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      {v.status === "draft" ? (
        <Button
          disabled={busy || !ready}
          onClick={() => void action("proposeAgreement")}
        >
          Propose this version
        </Button>
      ) : v.status !== "approved" && !already ? (
        <div className="mt-6">
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            I reviewed version {v.versionNumber} and agree to these terms.
          </label>
          <div className="mt-4">
            <Button
              disabled={busy || !ready || !reviewed}
              onClick={() => void action("approveAgreement")}
            >
              Confirm as Partner {slot}
            </Button>
          </div>
        </div>
      ) : (
        <Notice>
          {v.status === "approved"
            ? "Both partners confirmed this version."
            : `Your confirmation is saved. Partner ${slot === "A" ? "B" : "A"} must confirm independently.`}
        </Notice>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          disabled={busy || !ready || v.status !== "approved"}
          onClick={() => void action("exportAgreement")}
        >
          Download PDF
        </Button>
        <ButtonLink
          variant="secondary"
          to={`/sessions/${session.id}/agreement/preview`}
        >
          View document
        </ButtonLink>
      </div>
      <p className="field-hint">
        Confirmations apply only to this version. Editing creates a new draft
        with no confirmations.
      </p>
    </section>
  );
}
function AgreementDetails({ version: v }: { version: AgreementVersion }) {
  const rules = rulesFromAgreement(v);
  const wording = {
    use_shared_reserve_then_discuss:
      "Use the shared reserve, then discuss next steps.",
    pause_savings_then_discuss: "Pause savings, then discuss next steps.",
    discuss_before_spending: "Discuss the situation before spending.",
  };
  return (
    <article className="agreement-document">
      <h2>First Money Agreement</h2>
      <p>Created {new Date(v.createdAt).toLocaleDateString("en-US")} | USD</p>
      <h3>
        Shared monthly budget:{" "}
        {formatMoney(v.financialSummary.monthlySharedTotalCents)}
      </h3>
      <dl className="document-meta">
        <div><dt>Version</dt><dd>{v.versionNumber}</dd></div>
        <div><dt>Contribution model</dt><dd>{v.financialSummary.splitModel.kind}</dd></div>
        <div><dt>Currency</dt><dd>USD · monthly amounts</dd></div>
      </dl>
      <table className="document-expenses">
        <caption className="sr-only">Agreed monthly shared budget in USD</caption>
        <thead className="sr-only"><tr><th scope="col">Category</th><th scope="col">Monthly amount</th></tr></thead>
        <tbody>
          {v.items.map((item) => "monthlyCents" in item ? (
            <tr key={item.id}>
              <th scope="row">{item.key.replaceAll("_", " ")}</th>
              <td>{formatMoney(item.monthlyCents)}</td>
            </tr>
          ) : null)}
        </tbody>
        <tfoot><tr><th scope="row">Total, including savings</th><td>{formatMoney(v.financialSummary.monthlySharedTotalCents)}</td></tr></tfoot>
      </table>
      <p>
        Contribution model: {v.financialSummary.splitModel.kind}
        {v.financialSummary.splitModel.kind === "custom"
          ? ` (Partner A ${v.financialSummary.splitModel.partnerAShareBasisPoints / 100}%)`
          : ""}
      </p>
      <div className="document-contributions" style={{ flexWrap: "wrap" }}>
        {(["A", "B"] as const).map((slot) => (
          <div key={slot}>
            <span>Partner {slot} contributes</span>
            <strong>
              {formatMoney(v.financialSummary.monthlyContributionsCents[slot])}
              <span> / month</span>
            </strong>
          </div>
        ))}
      </div>
      <p>
        Personal spending:{" "}
        {rules.personalSpending === "independent"
          ? "Independent purchases"
          : "Discuss purchases above the threshold"}
      </p>
      <p>
        Personal debt:{" "}
        {rules.debtExpectation === "individual_responsibility"
          ? "Individual responsibility"
          : "Discuss support before making a commitment"}
      </p>
      <p>
        Large purchase discussion threshold:{" "}
        {formatMoney(rules.largePurchaseThresholdCents)}
      </p>
      <p>Emergency expenses: {wording[rules.emergencyRule]}</p>
      <p>
        Shared reserve:{" "}
        {formatMoney(v.financialSummary.sharedEmergencyFundCents)}
      </p>
      <p>
        Budget reviews: {rules.reviewFrequency.replaceAll("_", " ")}. Next
        review: {rules.nextReviewDate}.
      </p>
      <p className="field-hint">
        This personal financial planning agreement is not legal advice or
        professional financial advice.
      </p>
      <AgreementConfirmations version={v} />
    </article>
  );
}
function AgreementForm({
  current,
  coupleId,
  suggestedScenario,
  reload,
  budgetAllowed,
}: {
  current: AgreementVersion | null;
  coupleId: string;
  suggestedScenario: string | null;
  reload: () => void;
  budgetAllowed: boolean;
}) {
  const defaults = current ? rulesFromAgreement(current) : null;
  const scenario = suggestedScenario ?? current?.sourceScenarioId ?? null;
  const [threshold, setThreshold] = useState(
    defaults ? String(defaults.largePurchaseThresholdCents / 100) : "500",
  );
  const [rules, setRules] = useState(() => ({
    personalSpending: defaults?.personalSpending ?? "independent",
    debtExpectation: defaults?.debtExpectation ?? "individual_responsibility",
    emergencyRule: defaults?.emergencyRule ?? "discuss_before_spending",
    reviewFrequency: defaults?.reviewFrequency ?? "monthly",
    nextReviewDate:
      defaults?.nextReviewDate ??
      new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
  }));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const ids = useRef(new Map<string, RequestId>());
  function select<K extends keyof typeof rules>(
    key: K,
    value: (typeof rules)[K],
  ) {
    setRules((old) => ({ ...old, [key]: value }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const amount = parseMoneyInput(threshold);
      if (!amount.ok) throw new Error(amount.error);
      const validated = agreementRules(
        { ...rules, largePurchaseThresholdCents: amount.value },
        true,
      );
      const content = {
        expectedHeadVersionId: current?.id ?? null,
        sourceScenarioId: scenario as AgreementVersion["sourceScenarioId"],
        rules: validated,
      };
      const key = JSON.stringify(content);
      let requestId = ids.current.get(key);
      if (!requestId) {
        requestId = crypto.randomUUID() as RequestId;
        ids.current.set(key, requestId);
      }
      await fsmClient.request(
        "createAgreementVersion",
        { ...content, requestId },
        { coupleId },
      );
      reload();
    } catch (e) {
      setError(
        e instanceof Error && e.message === "INVALID_INPUT"
          ? "Check your rules, selected budget and a review date within the next year."
          : sessionError(e).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="surface agreement-section agreement-rules-form mt-6" onSubmit={save} noValidate>
      <h2>
        {current ? "Create a revised agreement" : "Create your agreement"}
      </h2>
      <p className="field-hint">
        Use a saved monthly budget. New versions require two fresh
        confirmations.
      </p>
      <Notice>
        {scenario
          ? "Your saved monthly plan is selected."
          : "Choose a saved monthly plan in the simulator to begin."}
      </Notice>
      <p>
        <ButtonLink variant="secondary" to={`/sessions/${coupleId}/simulator`}>
          Select a saved budget
        </ButtonLink>
      </p>
      <fieldset className="agreement-rule-fields" disabled={!scenario || !budgetAllowed}><legend>Set your agreement rules</legend>
      <label className="field">
        Personal spending
        <select
          value={rules.personalSpending}
          onChange={(e) =>
            select(
              "personalSpending",
              e.target.value as AgreementRules["personalSpending"],
            )
          }
        >
          <option value="independent">Independent purchases</option>
          <option value="discuss_above_threshold">
            Discuss purchases above the threshold
          </option>
        </select>
      </label>
      <label className="field">
        Personal debt
        <select
          value={rules.debtExpectation}
          onChange={(e) =>
            select(
              "debtExpectation",
              e.target.value as AgreementRules["debtExpectation"],
            )
          }
        >
          <option value="individual_responsibility">
            Individual responsibility
          </option>
          <option value="discuss_support">Discuss support</option>
        </select>
      </label>
      <MoneyInput
        id="agreement-threshold"
        label="Large purchase discussion threshold"
        value={threshold}
        onChange={setThreshold}
      />
      <label className="field">
        Emergency expenses
        <select
          value={rules.emergencyRule}
          onChange={(e) =>
            select(
              "emergencyRule",
              e.target.value as AgreementRules["emergencyRule"],
            )
          }
        >
          <option value="discuss_before_spending">
            Discuss before spending
          </option>
          <option value="use_shared_reserve_then_discuss">
            Use the reserve, then discuss
          </option>
          <option value="pause_savings_then_discuss">
            Pause savings, then discuss
          </option>
        </select>
      </label>
      <label className="field">
        Budget review frequency
        <select
          value={rules.reviewFrequency}
          onChange={(e) =>
            select(
              "reviewFrequency",
              e.target.value as AgreementRules["reviewFrequency"],
            )
          }
        >
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="as_needed">As needed</option>
        </select>
      </label>
      <label className="field">
        Next review date
        <input
          type="date"
          value={rules.nextReviewDate}
          onChange={(e) => select("nextReviewDate", e.target.value)}
        />
      </label>
      {error && (
        <div role="alert">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}
      </fieldset>
      <Button type="submit" disabled={busy || !budgetAllowed || !scenario}>
        {busy
          ? "Saving draft..."
          : current
            ? "Save new version"
            : "Create draft"}
      </Button>
    </form>
  );
}
