import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { LiveAgreementPage } from '../features/agreement/LiveAgreementPage';
import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  FieldError,
  MoneyInput,
  Notice,
  PageHeading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { AgreementStatus } from "../components/AgreementStatus";
import { useDemo } from "../hooks/useDemo";
import { validateAgreementDraft } from "../features/agreement/validation";
import type { AgreementDraftInputs } from "../app/demo-context";

export default function AgreementPage() {
 const {coupleId}=useParams();return coupleId==='demo'?<DemoAgreementPage/>:<LiveAgreementPage/>;
}
function DemoAgreementPage() {
  const { agreement, updateAgreement } = useDemo();
  const [errors, setErrors] = useState<
    ReturnType<typeof validateAgreementDraft>
  >({});
  const navigate = useNavigate();
  function update<Key extends keyof AgreementDraftInputs>(
    key: Key,
    value: AgreementDraftInputs[Key],
  ) {
    updateAgreement({ ...agreement, [key]: value });
    setErrors({});
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR CHOICES, PUT INTO WORDS"
        title="A shared plan. In your own terms."
        description="Turn a few thoughtful conversations into clear expectations for everyday life."
      >
        <Badge tone="neutral">Preview draft · unapproved</Badge>
      </PageHeading>
      <DemoNotice>
        Explore the example rules. This preview is not saved or approved by either partner.
      </DemoNotice>
      <section className="surface agreement-progress">
        <div className="section-title-row">
          <h2>From a first draft to a shared yes.</h2>
          <span className="muted small-copy">Workflow preview</span>
        </div>
        <AgreementStatus />
        <p className="field-hint">
          These steps explain the agreement process. This demo draft has not
          reached Proposed, Under Review, or Approved.
        </p>
      </section>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const nextErrors = validateAgreementDraft(agreement);
          setErrors(nextErrors);
          if (!Object.keys(nextErrors).length)
            navigate("/sessions/demo/agreement/preview");
        }}
      >
        <div className="agreement-grid">
          <div className="agreement-sections">
            <section className="surface agreement-section">
              <div className="numbered-heading">
                <span>01</span>
                <div>
                  <h2>The everyday, together</h2>
                  <p>Fixed proportional example · $3,200 per month</p>
                </div>
                <Icon name="home" />
              </div>
              <div className="agreement-expenses">
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
              <div className="agreement-total">
                <span>
                  Partner A <strong>$2,000 / mo</strong>
                </span>
                <span>
                  Partner B <strong>$1,200 / mo</strong>
                </span>
              </div>
              <ButtonLink to="/sessions/demo/simulator" variant="ghost">
                Explore the example budget
              </ButtonLink>
            </section>
            <section className="surface agreement-section">
              <div className="numbered-heading">
                <span>02</span>
                <div>
                  <h2>Room for your independence</h2>
                  <p>Clear boundaries can make sharing feel easier.</p>
                </div>
                <Icon name="people" />
              </div>
              <div className="field">
                <label htmlFor="spending-rule">Personal purchases</label>
                <select
                  id="spending-rule"
                  value={agreement.personalSpending}
                  onChange={(event) =>
                    update(
                      "personalSpending",
                      event.target
                        .value as AgreementDraftInputs["personalSpending"],
                    )
                  }
                >
                  <option value="independent">
                    Keep personal purchases independent
                  </option>
                  <option value="discuss_above_threshold">
                    Discuss purchases above our threshold
                  </option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="debt-rule">Existing personal debt</label>
                <select
                  id="debt-rule"
                  value={agreement.debtExpectation}
                  onChange={(event) =>
                    update(
                      "debtExpectation",
                      event.target
                        .value as AgreementDraftInputs["debtExpectation"],
                    )
                  }
                >
                  <option value="individual_responsibility">
                    Each person remains responsible
                  </option>
                  <option value="discuss_support">
                    Discuss any support together first
                  </option>
                </select>
              </div>
              <MoneyInput
                id="purchase-threshold"
                label="Discuss a purchase above"
                value={agreement.threshold}
                onChange={(value) => update("threshold", value)}
                error={errors.threshold}
              />
            </section>
            <section className="surface agreement-section">
              <div className="numbered-heading">
                <span>03</span>
                <div>
                  <h2>A little room for life</h2>
                  <p>Decide how to approach surprises and revisit the plan.</p>
                </div>
                <Icon name="shield" />
              </div>
              <div className="field">
                <label htmlFor="emergency-rule">
                  When an unexpected cost appears
                </label>
                <select
                  id="emergency-rule"
                  value={agreement.emergencyRule}
                  onChange={(event) =>
                    update(
                      "emergencyRule",
                      event.target
                        .value as AgreementDraftInputs["emergencyRule"],
                    )
                  }
                >
                  <option value="use_shared_reserve_then_discuss">
                    Use shared reserve, then discuss the rest
                  </option>
                  <option value="pause_savings_then_discuss">
                    Pause savings, then discuss the rest
                  </option>
                  <option value="discuss_before_spending">
                    Discuss before spending
                  </option>
                </select>
                <p className="field-hint">
                  Example shared reserve: $1,000. The reserve is separate from
                  monthly savings.
                </p>
              </div>
              <div className="form-two-columns">
                <div className="field">
                  <label htmlFor="review-frequency">Review this plan</label>
                  <select
                    id="review-frequency"
                    value={agreement.reviewFrequency}
                    onChange={(event) =>
                      update(
                        "reviewFrequency",
                        event.target
                          .value as AgreementDraftInputs["reviewFrequency"],
                      )
                    }
                  >
                    <option value="monthly">Every month</option>
                    <option value="quarterly">Every three months</option>
                    <option value="as_needed">When something changes</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="review-date">Next review date</label>
                  <input
                    id="review-date"
                    type="date"
                    value={agreement.reviewDate}
                    onChange={(event) =>
                      update("reviewDate", event.target.value)
                    }
                    aria-invalid={!!errors.reviewDate}
                    aria-describedby={
                      errors.reviewDate ? "review-date-error" : undefined
                    }
                  />
                  {errors.reviewDate && (
                    <FieldError id="review-date-error">
                      {errors.reviewDate}
                    </FieldError>
                  )}
                </div>
              </div>
            </section>
          </div>
          <aside className="surface review-panel">
            <span className="feature-icon">
              <Icon name="heart" size={25} />
            </span>
            <h2>
              Two voices.
              <br />
              One shared yes.
            </h2>
            <p>
              In a real session, each person confirms the same server-verified
              version independently. Confirmations are available in your own shared plan.
            </p>
            {(["A", "B"] as const).map((slot) => (
              <div className="approval-placeholder" key={slot}>
                <div>
                  <span
                    className={`avatar ${slot === "B" ? "avatar-light" : ""}`}
                  >
                    {slot}
                  </span>
                  <div>
                    <strong>Partner {slot}</strong>
                    <span>Not approved · Preview</span>
                  </div>
                </div>
                <Button variant="secondary" disabled>
                  <Icon name="lock" size={15} />
                  Approve as Partner {slot}
                </Button>
              </div>
            ))}
            <Notice>
              No confirmations are recorded here. Local editing cannot approve
              an agreement.
            </Notice>
            <Button type="submit" className="w-full">
              Preview draft document
            </Button>
            <Button className="w-full" variant="ghost" disabled>
              Proposals unavailable in preview
            </Button>
          </aside>
        </div>
      </form>
    </>
  );
}
