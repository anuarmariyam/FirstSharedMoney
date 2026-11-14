import { useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  DemoNotice,
  PageHeading,
} from "../components/ui";
import { Icon } from "../components/Icon";
import {
  comparisonCopy,
  comparisonFixtures,
} from "../features/comparison/demo-results";
import type { ConflictResult } from "../types/domain";

function ComparisonCard({ result }: { result: ConflictResult }) {
  const [open, setOpen] = useState(false);
  const copy = comparisonCopy[result.discussionPromptCode];
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
  return (
    <>
      <PageHeading
        eyebrow="TWO PERSPECTIVES, ONE CONVERSATION"
        title="Understanding starts here."
        description="You don’t have to see everything the same way. Make space for the things you share and the things worth talking through."
      />
      <DemoNotice>
        Fictional comparison fixtures, not an analysis of your questionnaire.
        The comparison engine and partner data are not connected.
      </DemoNotice>
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
                {
                  comparisonFixtures.filter(
                    (item) => item.status === group.status,
                  ).length
                }{" "}
                examples
              </Badge>
            </div>
            <p className="group-subtitle">{group.subtitle}</p>
            {comparisonFixtures
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
          <p>Explore a few clearly labeled examples, side by side.</p>
        </div>
        <ButtonLink to="/sessions/demo/simulator">
          Explore the numbers <Icon name="arrow" />
        </ButtonLink>
      </div>
    </>
  );
}
