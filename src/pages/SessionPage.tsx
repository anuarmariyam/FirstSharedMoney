import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Badge,
  Brand,
  Button,
  ButtonLink,
  DemoNotice,
  EmptyState,
  Input,
  Notice,
  PageHeading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import { useDemo } from "../hooks/useDemo";
import { fsmClient } from "../services/fsm-client";

export function SessionEntryPage() {
  const isJoin = useLocation().pathname === "/join";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [inviteState, setInviteState] = useState<
    "unavailable" | "expired" | "invalid"
  >("unavailable");
  useEffect(() => {
    if (isJoin && window.location.hash)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
  }, [isJoin]);
  return (
    <div className="entry-page">
      <header className="content-width landing-header">
        <Brand />
        <ButtonLink to="/" variant="ghost">
          <Icon name="back" size={17} />
          Back home
        </ButtonLink>
      </header>
      <main id="main-content" tabIndex={-1} className="entry-main">
        <div className="entry-intro">
          <Badge>YOUR NEXT CHAPTER</Badge>
          <h1>
            {isJoin
              ? "A plan with room for you."
              : "A little clarity starts here."}
          </h1>
          <p>
            {isJoin
              ? "One invitation. Two perspectives. A conversation you build together."
              : "First your perspective. Then a shared conversation. Finally, a plan you can both stand behind."}
          </p>
          <div className="entry-steps">
            <span>
              <Icon name="document" />
              Your perspective
            </span>
            <i />
            <span>
              <Icon name="people" />
              Your conversation
            </span>
            <i />
            <span>
              <Icon name="heart" />
              Your shared plan
            </span>
          </div>
        </div>
        <section className="entry-card">
          <div className="feature-icon">
            <Icon name={isJoin ? "link" : "people"} size={26} />
          </div>
          <h2>{isJoin ? "Join your partner" : "Create your shared space"}</h2>
          <p className="muted">
            {isJoin
              ? "Each partner uses a separate identity and a personal invitation."
              : "Each partner has their own private access in the connected app."}
          </p>
          <Input
            id="display-name"
            label="What should we call you?"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError("");
            }}
            maxLength={80}
            placeholder="A first name or nickname"
            hint="Optional. A nickname is fine. Use fictional details."
            error={error}
          />
          <Notice title="Standalone demo">
            {isJoin && inviteState !== "unavailable"
              ? `Invitation ${inviteState} — example error state only. No live invitation has been checked.`
              : "Real sessions are available in the connected app. This standalone frontend does not create a session or save your name. Use Try Demo to explore."}
          </Notice>
          <Button
            disabled={fsmClient.connection === "not_connected"}
            className="w-full"
          >
            <Icon name="lock" size={17} />
            {isJoin
              ? "Join session"
              : "Create session"}
          </Button>
          <div className="entry-divider">
            <span>or take a look around</span>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              if (name.trim().length > 40) {
                setError("Use 40 characters or fewer.");
                return;
              }
              navigate("/sessions/demo");
            }}
          >
            Try Demo
          </Button>
          {isJoin && (
            <div className="invite-state-examples">
              <span>Preview invitation states:</span>
              <button onClick={() => setInviteState("expired")}>Expired</button>
              <button onClick={() => setInviteState("invalid")}>Invalid</button>
              <button onClick={() => setInviteState("unavailable")}>
                Unavailable
              </button>
            </div>
          )}
          <p className="entry-bottom">
            <Icon name="info" size={14} />
            No real financial information, please.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function SessionPage() {
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
            <Badge tone="neutral">Sample Data</Badge>
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
              <p>No second partner in Demo</p>
            </div>
            <Icon name="clock" size={18} />
          </div>
          <div className="invite-placeholder">
            <Icon name="link" size={18} />
            <span>
              Invitations are available when you create a real session in the connected app.
            </span>
          </div>
          <Button variant="secondary" className="w-full" disabled>
            Invitations unavailable in Demo
          </Button>
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
              "Sample Data cleared. No server data was changed.",
            );
          }}
        >
          <Icon name="refresh" size={16} />
          Reset Demo
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
