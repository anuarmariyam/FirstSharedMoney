import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  LoadingState,
  Notice,
  ProgressIndicator,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useQuestionnaire } from "../../hooks/useQuestionnaire";
import { questions, categoryLabels } from "./catalog";
import { QuestionField } from "./QuestionField";
import { validateAnswer } from "./validation";
import { fromAnswerValue } from "./answer-adapter";
import type { CoupleSession } from "../../types/domain";

export function LiveQuestionnairePage({
  session,
  reload,
}: {
  session: CoupleSession;
  reload: () => void;
}) {
  const state = useQuestionnaire(session.id, session.viewerPartnerId);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const step = Math.max(
    0,
    Math.min(
      14,
      Number.isInteger(Number(params.get("step") ?? "1"))
        ? Number(params.get("step") ?? "1") - 1
        : 0,
    ),
  );
  const question = questions[step];
  const [validation, setValidation] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const base = `/sessions/${session.id}/questionnaire`;
  const isConsent = location.pathname.endsWith("/consent");
  const firstInvalid = questions.findIndex(
    (q) => validateAnswer(q, state.draft[q.code]) !== null,
  );
  useEffect(() => {
    heading.current?.focus();
  }, [step, isConsent, state.loading]);
  const go = (next: number) => navigate(`${base}?step=${next + 1}`);
  async function next() {
    const error = validateAnswer(question, state.draft[question.code]);
    if (error) {
      setValidation({ code: question.code, message: error });
      return;
    }
    if (!(await state.flush())) return;
    if (step === 14) {
      if (firstInvalid !== -1) go(firstInvalid);
      else navigate(`${base}/consent`);
    } else go(step + 1);
  }
  if (state.loading) return <LoadingState />;
  if (!state.questionnaire)
    return (
      <EmptyState title="Your answers could not be loaded.">
        {state.error}
        <div className="mt-6">
          <Button onClick={() => void state.load()}>Retry</Button>
        </div>
      </EmptyState>
    );
  const submitted = state.questionnaire.status === "submitted";
  const savedCurrent = state.questionnaire.answers.find(
    (answer) => answer.questionCode === question.code,
  );
  const status = state.busy
    ? "Saving…"
    : state.conflict
      ? "Review needed"
      : state.dirty
        ? "Unsaved changes"
        : "Saved";
  const feedback = (
    <>
      <p className="field-hint" role="status">
        {status}
      </p>
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      {state.conflict ? (
        <Notice title="Review the latest saved answers">
          <p>
            Saved answer for this question:{" "}
            {savedCurrent
              ? String(fromAnswerValue(savedCurrent.value))
              : "No saved answer"}
            .
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              disabled={state.busy}
              onClick={() => void state.reviewConflict(false)}
            >
              Use saved answers
            </Button>
            <Button
              disabled={state.busy}
              variant="secondary"
              onClick={() => void state.reviewConflict(true)}
            >
              Keep my changes
            </Button>
          </div>
        </Notice>
      ) : (
        state.error && (
          <Button
            variant="secondary"
            disabled={state.busy}
            onClick={() => void state.flush()}
          >
            Retry saving
          </Button>
        )
      )}
    </>
  );
  if (submitted && !isConsent)
    return (
      <div className="questionnaire-wrap">
        <section className="surface completion-card">
          <span className="completion-icon">
            <Icon name="check" size={32} />
          </span>
          <Badge>ANSWERS SUBMITTED</Badge>
          <h1 ref={heading} tabIndex={-1}>
            Your answers are saved.
          </h1>
          <p>
            Your raw answers and private note stay private. Shared tools require
            both partners’ permission.
          </p>
          <div className="completion-choices">
            <div>
              <span>Compare preferences</span>
              <strong>
                {state.consent.comparison ? "On" : "Off"}
              </strong>
            </div>
            <div>
              <span>Shared budget planning</span>
              <strong>
                {state.consent.budget ? "On" : "Off"}
              </strong>
            </div>
          </div>
          <Notice>
            Editing pauses both sharing permissions until you submit again. Your
            saved answers are kept.
          </Notice>
          {feedback}
          <p>{session.partners.some(p => p.id !== session.viewerPartnerId && p.questionnaireStatus !== 'submitted') || session.partners.length < 2
            ? 'Your partner still needs to finish their questionnaire. You can review your sharing choices while you wait.'
            : 'Shared comparisons and budgets each need permission from both partners.'}</p>
          <ButtonLink to={`/sessions/${session.id}/differences`}>Compare preferences</ButtonLink>
          <ButtonLink to={`/sessions/${session.id}/simulator`} variant="secondary">Plan our budget</ButtonLink>
          <Button
            disabled={state.busy || state.conflict}
            onClick={() => {
              void state.mutate("reopenQuestionnaire").then((ok) => {
                if (ok) {
                  reload();
                  go(0);
                }
              });
            }}
          >
            Edit my answers
          </Button>
          <ButtonLink to={`${base}/consent`} variant="secondary">
            Sharing choices
          </ButtonLink>
          <ButtonLink to={`/sessions/${session.id}`} variant="ghost">
            Back to our plan
          </ButtonLink>
        </section>
      </div>
    );
  if (isConsent)
    return (
      <div className="questionnaire-wrap">
        <div className="question-topline">
          <ButtonLink to={`${base}?step=15`} variant="ghost">
            Back to questions
          </ButtonLink>
          <Badge>SHARING CHOICES</Badge>
        </div>
        {!submitted && firstInvalid !== -1 ? (
          <EmptyState title="A few questions still need your perspective.">
            Complete the required answers first.
            <div className="mt-6">
              <Button onClick={() => go(firstInvalid)}>Continue</Button>
            </div>
          </EmptyState>
        ) : (
          <form
            className="surface question-card consent-card"
            onSubmit={(event) => {
              event.preventDefault();
              void state
                .mutate(submitted ? "updatePrivacy" : "submitQuestionnaire")
                .then((ok) => {
                  if (ok) {
                    reload();
                    navigate(`${base}/complete`);
                  }
                });
            }}
          >
            <span className="feature-icon">
              <Icon name="shield" size={25} />
            </span>
            <h1 ref={heading} tabIndex={-1}>
              You choose what to share.
            </h1>
            <p className="question-help">
              Two separate choices. Neither is required to submit your answers.
            </p>
            <label className="consent-option">
              <input
                type="checkbox"
                checked={state.consent.comparison}
                disabled={state.busy}
                onChange={(event) =>
                  state.setConsent({
                    ...state.consent,
                    comparison: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Share a comparison summary</strong>
                <span>
                  Allow a summary of where our preferences align or differ. My
                  raw answers and private note stay private.
                </span>
              </span>
            </label>
            <label className="consent-option">
              <input
                type="checkbox"
                checked={state.consent.budget}
                disabled={state.busy}
                onChange={(event) =>
                  state.setConsent({
                    ...state.consent,
                    budget: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Share my budget inputs</strong>
                <span>
                  Allow my submitted income and personal-obligation total to be
                  used in our shared budget.
                </span>
              </span>
            </label>
            <Notice>
              Comparison requires permission from both people. Shared budget
              tools require both budget permissions. These tools are not
              available yet.
            </Notice>
            {feedback}
            <div className="question-actions">
              <ButtonLink to={`${base}?step=15`} variant="ghost">
                Previous
              </ButtonLink>
              <Button type="submit" disabled={state.busy || state.conflict}>
                {submitted ? "Save sharing choices" : "Submit my answers"}
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  return (
    <div className="questionnaire-wrap">
      <div className="question-topline">
        <ButtonLink to={`/sessions/${session.id}`} variant="ghost">
          Our starting point
        </ButtonLink>
        <Badge>YOUR PERSPECTIVE</Badge>
      </div>
      <div className="question-toolbar">
        <ProgressIndicator current={step + 1} total={15} />
        {feedback}
      </div>
      <form
        className="surface question-card"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void next();
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
        <fieldset className="contents" disabled={state.conflict}>
          <QuestionField
            question={question}
            value={state.draft[question.code]}
            error={validation?.code === question.code ? validation.message : ""}
            preview={false}
            onChange={(value) => {
              state.updateAnswer(question.code, value);
              setValidation(null);
            }}
          />
        </fieldset>
        <div className="question-actions">
          <Button
            variant="ghost"
            disabled={step === 0 || state.busy}
            onClick={() => go(step - 1)}
          >
            Previous
          </Button>
          <Button type="submit" disabled={state.busy || state.conflict}>
            {step === 14 ? "Review sharing choices" : "Next question"}
          </Button>
        </div>
      </form>
      <div className="question-reassurance">
        <Icon name="lock" size={15} />
        <p>Your answers stay private. Your sharing choices control the results you can plan with together.</p>
      </div>
    </div>
  );
}
