import { useState } from "react";
import { useParams } from "react-router";
import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  PageHeading,
  LoadingState,
  EmptyState,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  comparisonCopy,
  comparisonFixtures,
} from "../features/comparison/demo-results";
import type { ConflictResult } from "../types/domain";
import { useSharedResource } from "../hooks/useSharedResource";

const topics: Partial<Record<ConflictResult["questionCode"], string>> = {
  shared_categories: "What you plan together",
  shared_budget_estimate: "Shared living costs",
  split_preference: "How to share costs",
  monthly_shared_savings: "Shared savings",
  personal_spending: "Personal spending",
  debt_expectation: "Existing debt",
  emergency_preference: "Unexpected costs",
  emergency_fund_target: "Emergency savings",
  large_purchase_threshold: "Larger purchases",
  transparency_preference: "Financial openness",
  review_frequency: "Budget reviews",
};

function ComparisonCard({ result }: { result: ConflictResult }) {
  const [open, setOpen] = useState(false);
  const copy = comparisonCopy[result.discussionPromptCode] ?? {
    title: topics[result.questionCode] ?? "A topic to discuss",
    text:
      result.status === "aligned"
        ? "Your submitted preferences match on this topic."
        : result.status === "different"
          ? "You have different expectations to talk through."
          : "There are details to choose together.",
    prompt:
      "What would feel workable for each of you, and when should you revisit it?",
  };
  return (
    <article className={`comparison-card comparison-${result.status}`}>
      <span className="comparison-symbol">
        <Icon
          name={
            result.status === "aligned"
              ? "check"
              : result.status === "different"
                ? "chat"
                : "clock"
          }
          size={19}
        />
      </span>
      <div>
        <h3>{copy.title}</h3>
        <p>{copy.text}</p>
        <Button
          variant="ghost"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Close discussion prompt" : "A question to talk through"}
          <Icon name="chevron" size={15} className={open ? "rotated" : ""} />
        </Button>
        {open && <div className="discussion-prompt">{copy.prompt}</div>}
      </div>
    </article>
  );
}
export default function DifferencesPage() {
  const { coupleId } = useParams();
  return coupleId === "demo" ? (
    <DifferencesView results={comparisonFixtures} coupleId="demo" />
  ) : (
    <LiveDifferences coupleId={coupleId!} />
  );
}
function LiveDifferences({ coupleId }: { coupleId: string }) {
  const state = useSharedResource("getComparison", coupleId);
  if (state.loading) return <LoadingState />;
  if (!state.data)
    return (
      <EmptyState title="Your perspectives are not ready to compare.">
        {state.error?.message}
        <div className="mt-6 flex gap-3">
          <ButtonLink to={`/sessions/${coupleId}/questionnaire/consent`}>
            My sharing choices
          </ButtonLink>
          <Button variant="secondary" onClick={state.reload}>
            Refresh
          </Button>
        </div>
      </EmptyState>
    );
  return <DifferencesView results={state.data.results} coupleId={coupleId} />;
}
function DifferencesView({
  results,
  coupleId,
}: {
  results: readonly ConflictResult[];
  coupleId: string;
}) {
  const isDemo = coupleId === "demo";
  return (
    <>
      <PageHeading
        eyebrow="TWO PERSPECTIVES, ONE CONVERSATION"
        title="Understanding starts here."
        description="You don’t have to see everything the same way. Make space for the things you share and the things worth talking through."
      />
      {isDemo && (
        <DemoNotice>
          Fictional comparison fixtures, not an analysis of your questionnaire.
          The comparison engine and partner data are not connected.
        </DemoNotice>
      )}
      <div className="perspective-intro">
        <div className="small-avatars">
          <span>A</span>
          <span>B</span>
        </div>
        <p>
          Different expectations are a starting point.
          <br />
          <strong>There’s no score, and nobody wins or loses.</strong>
        </p>
      </div>
      <div className="comparison-columns">
        {[
          {
            status: "aligned",
            title: "Aligned Preferences",
            subtitle: "A little common ground.",
            tone: "green",
          },
          {
            status: "different",
            title: "Different Expectations",
            subtitle: "Room for a conversation.",
            tone: "purple",
          },
          {
            status: "unresolved",
            title: "Unresolved Decisions",
            subtitle: "Choose the details together.",
            tone: "amber",
          },
        ].map((group) => (
          <section key={group.status}>
            <div className="comparison-group-heading">
              <h2>{group.title}</h2>
              <Badge tone={group.tone as "green" | "purple" | "amber"}>
                {results.filter((item) => item.status === group.status).length}{" "}
                {isDemo ? "examples" : "topics"}
              </Badge>
            </div>
            <p className="group-subtitle">{group.subtitle}</p>
            {results
              .filter((item) => item.status === group.status)
              .map((result) => (
                <ComparisonCard key={result.questionCode} result={result} />
              ))}
          </section>
        ))}
      </div>
      <div className="next-step-banner">
        <div>
          <p className="eyebrow">TURN THE CONVERSATION INTO POSSIBILITIES</p>
          <h2>What could sharing costs look like?</h2>
          <p>
            {isDemo
              ? "Explore a few clearly labeled examples, side by side."
              : "Compare ways to share your actual household budget."}
          </p>
        </div>
        <ButtonLink to={`/sessions/${coupleId}/simulator`}>
          Explore the numbers <Icon name="arrow" />
        </ButtonLink>
      </div>
    </>
  );
}
