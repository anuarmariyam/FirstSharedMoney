import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  Badge,
  Brand,
  Button,
  ButtonLink,
  DemoNotice,
  EmptyState,
  PageHeading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { useDemo } from "../hooks/useDemo";
import { LiveSessionPage } from "../features/session/LiveSessionPage";

export { SessionEntryPage } from "../features/session/SessionEntryPage";

export default function SessionPage() {
  const { coupleId } = useParams();
  return coupleId === "demo" ? <DemoSessionPage /> : <LiveSessionPage />;
}
function DemoSessionPage() {
  const demo = useDemo();
  const [resetMessage, setResetMessage] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="YOUR SHARED STARTING POINT"
        title="A plan begins with two perspectives."
        description="There’s no need to have it all figured out. Take the first step, then find your way together."
      >
        <div className="overlapping-avatars">
          <span>A</span>
          <span>B</span>
        </div>
      </PageHeading>
      <DemoNotice />
      <div className="overview-grid">
        <section className="surface overview-main">
          <div className="flex items-center justify-between gap-4">
            <p className="eyebrow">THE CONVERSATION AHEAD</p>

          </div>
          <h2>
            Make space for
            <br />
            your side of the story.
          </h2>
          <p>
            Fifteen thoughtful questions about the everyday, the unexpected, and
            what independence means to you.
          </p>
          <ButtonLink to="/sessions/demo/questionnaire">
            {demo.questionnaireComplete
              ? "Review my answers"
              : "Start my questionnaire"}
          </ButtonLink>
          <div className="overview-meta">
            <span>
              <Icon name="document" size={16} />
              15 questions
            </span>
            <span>
              <Icon name="lock" size={16} />
              No server storage
            </span>
          </div>
        </section>
        <section className="surface partner-card">
          <div className="flex items-center gap-3">
            <span className="feature-icon">
              <Icon name="people" />
            </span>
            <h2>A place for both of you</h2>
          </div>
          <div className="partner-row">
            <span className="avatar">A</span>
            <div>
              <strong>Your perspective</strong>
              <p>
                {demo.questionnaireComplete
                  ? "Questionnaire preview complete"
                  : "Ready when you are"}
              </p>
            </div>
            <Badge tone={demo.questionnaireComplete ? "green" : "neutral"}>
              {demo.questionnaireComplete ? "Previewed" : "Start here"}
            </Badge>
          </div>
          <div className="partner-row">
            <span className="avatar avatar-muted">B</span>
            <div>
              <strong>Your partner’s perspective</strong>
              <p>Ready to plan together?</p>
            </div>
            <Icon name="clock" size={18} />
          </div>
          <div className="invite-placeholder">
            <Icon name="link" size={18} />
            <span>
              Start your own shared plan to invite your partner.
            </span>
          </div>
          <ButtonLink to="/create" variant="secondary" className="w-full">Start your plan</ButtonLink>
        </section>
      </div>
      <div className="section-title-row">
        <h2>Your path to a shared plan</h2>
        <span>At your own pace</span>
      </div>
      <div className="journey-list">
        {[
          {
            n: "01",
            title: "Understand your perspectives",
            text: "Start separately, then find the topics worth talking about.",
            to: "/sessions/demo/differences",
            label: "Preview perspectives",
            icon: "chat",
          },
          {
            n: "02",
            title: "Explore what feels workable",
            text: "See example approaches to rent, everyday costs, and the unexpected.",
            to: "/sessions/demo/simulator",
            label: "Explore the simulator",
            icon: "sliders",
          },
          {
            n: "03",
            title: "Put your decisions into words",
            text: "A clear draft for the choices you want to make together.",
            to: "/sessions/demo/agreement",
            label: "Preview an agreement",
            icon: "heart",
          },
        ].map((step) => (
          <Link to={step.to} className="journey-item" key={step.n}>
            <span className="journey-number">{step.n}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <span className="journey-link">
              {step.label}
            </span>
          </Link>
        ))}
      </div>
      <div className="overview-bottom">
        <p>
          <Icon name="info" size={16} />
          Example comparisons and calculations are independent of your local
          questionnaire answers.
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            demo.reset();
            setResetMessage(
              "Example Plan cleared. No server data was changed.",
            );
          }}
        >
          <Icon name="refresh" size={16} />
          Reset preview
        </Button>
      </div>
      {resetMessage && (
        <p role="status" className="field-hint">
          {resetMessage}
        </p>
      )}
    </>
  );
}

export function NotFoundPage() {
  return (
    <main id="main-content" tabIndex={-1} className="not-found">
      <Brand />
      <EmptyState icon="home" title="This page isn’t part of your plan.">
        The address may be incomplete or the page may have moved.
        <div className="mt-6">
          <ButtonLink to="/">
            Back to the beginning
          </ButtonLink>
        </div>
      </EmptyState>
    </main>
  );
}
