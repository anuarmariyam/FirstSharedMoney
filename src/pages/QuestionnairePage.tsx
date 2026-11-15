import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
  useOutletContext,
} from "react-router";
import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  EmptyState,
  Notice,
  ProgressIndicator,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { questions, categoryLabels } from "../features/questionnaire/catalog";
import { validateAnswer } from "../features/questionnaire/validation";
import { QuestionField } from "../features/questionnaire/QuestionField";
import { useDemo } from "../hooks/useDemo";
import type { QuestionCode, CoupleSession } from "../types/domain";
import { LiveQuestionnairePage } from "../features/questionnaire/LiveQuestionnairePage";

export default function QuestionnairePage() {
  const { coupleId } = useParams();
  const context = useOutletContext<
    { session: CoupleSession; reload: () => void } | undefined
  >();
  return coupleId === "demo" ? (
    <DemoQuestionnairePage />
  ) : context ? (
    <LiveQuestionnairePage
      key={`${context.session.id}/${context.session.viewerPartnerId}`}
      {...context}
    />
  ) : (
    <EmptyState title="Your session is unavailable.">
      Return to your plan and try again.
    </EmptyState>
  );
}
function DemoQuestionnairePage() {
  const demo = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const rawStep = Number(searchParams.get("step") ?? "1");
  const step = Number.isInteger(rawStep)
    ? Math.max(0, Math.min(14, rawStep - 1))
    : 0;
  const question = questions[step];
  const [validationError, setValidationError] = useState<{
    code: QuestionCode;
    message: string;
  } | null>(null);
  const error =
    validationError?.code === question.code ? validationError.message : "";
  const [exampleMessage, setExampleMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const isConsent = location.pathname.endsWith("/consent");
  const isComplete = location.pathname.endsWith("/complete");
  const firstInvalid = questions.findIndex(
    (item) => validateAnswer(item, demo.answers[item.code]) !== null,
  );
  useEffect(() => {
    heading.current?.focus();
  }, [step, isConsent, isComplete]);
  function setError(message: string) {
    setValidationError(message ? { code: question.code, message } : null);
  }
  function go(next: number) {
    navigate(`/sessions/demo/questionnaire?step=${next + 1}`);
  }
  function next() {
    const message = validateAnswer(question, demo.answers[question.code]);
    if (message) {
      setError(message);
      return;
    }
    if (step === 14) {
      if (firstInvalid !== -1) {
        go(firstInvalid);
        return;
      }
      navigate("/sessions/demo/questionnaire/consent");
    } else go(step + 1);
  }
  if (isComplete)
    return (
      <div className="questionnaire-wrap">
        <DemoNotice />
        {demo.questionnaireComplete ? (
          <section className="surface completion-card">
            <span className="completion-icon">
              <Icon name="check" size={32} />
            </span>
            <Badge>DEMO COMPLETE</Badge>
            <h1>
              You’ve made space
              <br />
              for your perspective.
            </h1>
            <p>
              Your answers and sharing choices are held only in this tab’s
              memory. Nothing was submitted to a server or shared with another
              person.
            </p>
            <div className="completion-choices">
              <div>
                <span>Comparison summary</span>
                <strong>
                  {demo.consent.comparison
                    ? "Selected in preview"
                    : "Not selected"}
                </strong>
              </div>
              <div>
                <span>Shared budget inputs</span>
                <strong>
                  {demo.consent.budget ? "Selected in preview" : "Not selected"}
                </strong>
              </div>
            </div>
            <ButtonLink to="/sessions/demo/differences">
              Explore example perspectives
            </ButtonLink>
            <ButtonLink to="/sessions/demo/questionnaire" variant="ghost">
              Review my answers
            </ButtonLink>
          </section>
        ) : (
          <EmptyState title="Your questionnaire is still in progress.">
            Complete the questions and review sharing choices first.
            <div className="mt-6">
              <ButtonLink to="/sessions/demo/questionnaire">
                Back to my questions
              </ButtonLink>
            </div>
          </EmptyState>
        )}
      </div>
    );
  if (isConsent)
    return (
      <div className="questionnaire-wrap">
        <div className="question-topline">
          <ButtonLink to="/sessions/demo/questionnaire?step=15" variant="ghost">
            <Icon name="back" size={16} />
            Back to questions
          </ButtonLink>
          <Badge>FINAL STEP</Badge>
        </div>
        <DemoNotice />
        {firstInvalid !== -1 ? (
          <EmptyState title="A few questions still need your perspective.">
            Finish the required answers before reviewing your sharing choices.
            <div className="mt-6">
              <ButtonLink
                to={`/sessions/demo/questionnaire?step=${firstInvalid + 1}`}
              >
                Continue my questionnaire
              </ButtonLink>
            </div>
          </EmptyState>
        ) : (
          <form
            className="surface question-card consent-card"
            onSubmit={(event) => {
              event.preventDefault();
              demo.finishQuestionnaire();
              navigate("/sessions/demo/questionnaire/complete");
            }}
          >
            <span className="feature-icon">
              <Icon name="shield" size={25} />
            </span>
            <p className="eyebrow">YOUR COMFORT COMES FIRST</p>
            <h1 ref={heading} tabIndex={-1}>
              You choose what to share.
            </h1>
            <p className="question-help">
              These are two separate choices. Neither is required to finish this
              preview.
            </p>
            <label className="consent-option">
              <input
                type="checkbox"
                checked={demo.consent.comparison}
                onChange={(event) =>
                  demo.updateConsent({
                    ...demo.consent,
                    comparison: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Share a comparison summary</strong>
                <span>
                  Share a summary of where our planning preferences align or
                  differ. My raw answers and private note stay private.
                </span>
              </span>
            </label>
            <label className="consent-option">
              <input
                type="checkbox"
                checked={demo.consent.budget}
                onChange={(event) =>
                  demo.updateConsent({
                    ...demo.consent,
                    budget: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Share my budget inputs</strong>
                <span>
                  Share my submitted monthly take-home income and
                  personal-obligation total in our shared budget simulator.
                </span>
              </span>
            </label>
            <Notice title="Preview choices only">
              In real sessions, sharing requires both partners’ permission.
              These demo choices do not grant access to real data.
            </Notice>
            <div className="question-actions">
              <ButtonLink
                to="/sessions/demo/questionnaire?step=15"
                variant="ghost"
              >
                <Icon name="back" size={17} />
                Previous
              </ButtonLink>
              <Button type="submit">
                Finish preview
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  return (
    <div className="questionnaire-wrap">
      <div className="question-topline">
        <ButtonLink to="/sessions/demo" variant="ghost">
          <Icon name="back" size={16} />
          Our starting point
        </ButtonLink>
        <Badge>YOUR PERSPECTIVE</Badge>
      </div>
      <DemoNotice />
      <div className="question-toolbar">
        <ProgressIndicator current={step + 1} total={15} />
        <Button
          variant="ghost"
          className="load-example"
          onClick={() => {
            demo.loadExample();
            setError("");
            setExampleMessage(
              "Fictional answers loaded for all 15 questions. You can edit them.",
            );
          }}
        >
          <Icon name="spark" size={16} />
          Use fictional example
        </Button>
      </div>
      {exampleMessage && (
        <p className="field-hint example-message" role="status">
          {exampleMessage}
        </p>
      )}
      <form
        className="surface question-card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          next();
        }}
      >
        <div className="question-category">
          <span>{String(step + 1).padStart(2, "0")}</span>
          <p className="eyebrow">{categoryLabels[question.category]}</p>
          {!question.required && <Badge tone="neutral">Optional</Badge>}
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {question.title}
        </h1>
        <p className="question-help">{question.helpText}</p>
        <QuestionField
          question={question}
          value={demo.answers[question.code]}
          error={error}
          onChange={(value) => {
            demo.updateAnswer(question.code, value);
            setError("");
          }}
        />
        <div className="question-actions">
          <Button
            variant="ghost"
            disabled={step === 0}
            onClick={() => go(step - 1)}
          >
            <Icon name="back" size={17} />
            Previous
          </Button>
          <Button type="submit">
            {step === 14 ? "Review sharing choices" : "Next question"}
          </Button>
        </div>
      </form>
      <div className="question-reassurance">
        <Icon name="lock" size={15} />
        <p>
          A little honesty, at your own pace. Use fictional details in this
          demo.
        </p>
      </div>
    </div>
  );
}
