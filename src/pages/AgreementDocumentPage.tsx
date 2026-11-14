import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  EmptyState,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { useDemo } from "../hooks/useDemo";
import { formatMoney, parseMoneyInput } from "../lib/money";
import { validateAgreementDraft } from "../features/agreement/validation";

export default function AgreementDocumentPage() {
  const { agreement } = useDemo();
  const invalid = Object.keys(validateAgreementDraft(agreement)).length > 0;
  const threshold = parseMoneyInput(agreement.threshold);
  if (invalid || !threshold.ok)
    return (
      <EmptyState icon="document" title="A few draft details need attention.">
        Review the purchase threshold and review date before opening the
        document.
        <div className="mt-6">
          <ButtonLink to="/sessions/demo/agreement">
            Back to the draft
          </ButtonLink>
        </div>
      </EmptyState>
    );
  return (
    <div className="document-wrap">
      <div className="document-toolbar">
        <ButtonLink to="/sessions/demo/agreement" variant="ghost">
          <Icon name="back" size={16} />
          Back to editing
        </ButtonLink>
        <Button variant="secondary" disabled>
          <Icon name="lock" size={16} />
          PDF export — coming later
        </Button>
      </div>
      <DemoNotice>
        Unapproved local document preview. No signatures, server version, or
        independent approvals exist.
      </DemoNotice>
      <article className="agreement-document">
        <div className="document-top">
          <span className="paper-eyebrow">FIRSTSHAREDMONEY</span>
          <Badge tone="neutral">UNAPPROVED DRAFT</Badge>
        </div>
        <span className="document-heart">
          <Icon name="heart" size={29} />
        </span>
        <h1>
          Our First
          <br />
          <span>Money Agreement.</span>
        </h1>
        <p className="document-intro">
          A starting point for the life we’re building together.
        </p>
        <div className="document-partners">
          <span>
            <i className="dot dot-purple" />
            Partner A
          </span>
          <span>
            <i className="dot dot-lavender" />
            Partner B
          </span>
          <span>Fictional example</span>
        </div>
        <section>
          <h2>01 / Our shared everyday</h2>
          <p>
            Our example monthly shared budget is <strong>$3,200</strong>, using
            an income-based proportional split.
          </p>
          <div className="document-expenses">
            {[
              ["Rent & home", "$2,200"],
              ["Utilities", "$300"],
              ["Groceries", "$500"],
              ["Other shared costs", "$200"],
              ["Shared savings", "$0"],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="document-contributions">
            <div>
              <span>Partner A contributes</span>
              <strong>
                $2,000<span> / month</span>
              </strong>
            </div>
            <div>
              <span>Partner B contributes</span>
              <strong>
                $1,200<span> / month</span>
              </strong>
            </div>
          </div>
        </section>
        <section>
          <h2>02 / Our personal space</h2>
          <p>
            {agreement.personalSpending === "independent"
              ? "We keep personal purchases independent."
              : "We discuss personal purchases above our agreed threshold."}{" "}
            {agreement.debtExpectation === "individual_responsibility"
              ? "Each person remains responsible for their existing personal debt."
              : "We discuss any support with personal debt before including it in our plan."}
          </p>
          <p>
            We talk together before a purchase above{" "}
            <strong>{formatMoney(threshold.value)}</strong>.
          </p>
        </section>
        <section>
          <h2>03 / The unexpected</h2>
          <p>
            {agreement.emergencyRule === "use_shared_reserve_then_discuss"
              ? "We use our shared emergency reserve first, then discuss any amount that remains."
              : agreement.emergencyRule === "pause_savings_then_discuss"
                ? "We pause shared savings first, then discuss the remaining cost."
                : "We discuss unexpected costs before spending."}{" "}
            The fictional available shared reserve is <strong>$1,000</strong>.
          </p>
        </section>
        <section>
          <h2>04 / Keep the conversation going</h2>
          <p>
            We revisit this plan{" "}
            <strong>
              {agreement.reviewFrequency === "monthly"
                ? "every month"
                : agreement.reviewFrequency === "quarterly"
                  ? "every three months"
                  : "when something changes"}
            </strong>
            . Our next review date is{" "}
            <strong>
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(`${agreement.reviewDate}T00:00:00Z`))}
            </strong>
            .
          </p>
        </section>
        <div className="document-approval">
          <div>
            <strong>Partner A</strong>
            <span>Not approved · not connected</span>
          </div>
          <div>
            <strong>Partner B</strong>
            <span>Not approved · not connected</span>
          </div>
        </div>
        <footer>
          This fictional draft is a personal planning tool, not a legal contract
          or professional financial advice. It has not been proposed or approved
          by two independent partners.
        </footer>
      </article>
    </div>
  );
}
