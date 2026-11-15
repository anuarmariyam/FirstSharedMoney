import { Brand, Badge, ButtonLink } from "../components/ui";
import { Icon } from "../components/Icon";
import { PlanPreview } from "../components/PlanPreview";

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header content-width">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#made-for-two">Made for two</a>
          <ButtonLink to="/sessions/demo" variant="ghost">
            Try Demo
          </ButtonLink>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="hero content-width">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />A new chapter. A shared starting point.
            </div>
            <h1>
              Money is personal.
              <br />
              Plan it <span>together.</span>
            </h1>
            <p className="hero-tagline">
              Two people. Different money habits.
              <br />
              One shared plan.
            </p>
            <p className="hero-description">
              Moving in together comes with a lot of firsts. Make talking about
              money a little easier, before the bills arrive.
            </p>
            <div className="hero-actions">
              <ButtonLink to="/create">
                Create Our Money Plan
              </ButtonLink>
              <ButtonLink to="/sessions/demo" variant="secondary">
                Try Demo
              </ButtonLink>
            </div>
            <div className="hero-footnote">
              <Icon name="info" size={15} />
              <span>Try Demo uses sample data. Your own plan starts separately.</span>
            </div>
          </div>
          <PlanPreview />
        </section>
        <div className="landing-principles content-width">
          <span>
            <Icon name="people" />
            Two perspectives, equal space
          </span>
          <span>
            <Icon name="chat" />
            Conversations, not compatibility scores
          </span>
          <span>
            <Icon name="document" />A practical plan to work toward
          </span>
        </div>
        <section className="how-section content-width" id="how-it-works">
          <div className="section-heading">
            <p className="eyebrow">LESS GUESSING. MORE UNDERSTANDING.</p>
            <h2>
              A money conversation
              <br />
              with a way forward.
            </h2>
            <p>
              You don’t need identical habits.
              <br />
              You need a place to start.
            </p>
          </div>
          <div className="how-grid">
            {[
              {
                number: "01",
                icon: "document",
                title: "Start with your perspective",
                text: "A guided questionnaire gives each person space to think about income, expectations, and independence.",
              },
              {
                number: "02",
                icon: "sliders",
                title: "See the possibilities",
                text: "Find the topics worth talking about. Explore what different ways of sharing costs could look like.",
              },
              {
                number: "03",
                icon: "heart",
                title: "Make a plan that’s yours",
                text: "Bring your choices together in one clear agreement, with room to revisit it as life changes.",
              },
            ].map((step) => (
              <article className="how-step" key={step.number}>
                <div className="how-step-top">
                  <span className="feature-icon">
                    <Icon
                      name={step.icon as "document" | "sliders" | "heart"}
                      size={24}
                    />
                  </span>
                  <span className="step-number">{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="together-section content-width" id="made-for-two">
          <div className="together-art" aria-hidden="true">
            <div className="together-circle circle-a">you</div>
            <div className="together-circle circle-b">me</div>
            <div className="together-heart">
              <Icon name="heart" size={30} />
            </div>
            <span className="handwritten">a little space for both</span>
          </div>
          <div>
            <p className="eyebrow">SHARED LIFE. STILL YOURSELVES.</p>
            <h2>
              A shared plan shouldn’t
              <br />
              mean losing your independence.
            </h2>
            <p>
              Maybe one of you loves a spreadsheet. Maybe the other would rather
              talk it through. FirstSharedMoney makes room for both.
            </p>
            <ul className="benefit-list">
              <li>
                <Icon name="check" />
                Talk about the everyday and the unexpected.
              </li>
              <li>
                <Icon name="check" />
                Choose how much personal spending stays personal.
              </li>
              <li>
                <Icon name="check" />
                Turn “we should discuss this” into clear next steps.
              </li>
            </ul>
            <ButtonLink to="/sessions/demo" variant="ghost">
              See the example journey
            </ButtonLink>
          </div>
        </section>
        <section className="privacy-section content-width" id="privacy">
          <div className="privacy-symbol">
            <Icon name="shield" size={35} />
          </div>
          <div>
            <p className="eyebrow">YOUR PERSPECTIVE DESERVES CARE.</p>
            <h2>Sharing a life starts with choice.</h2>
            <p>
              Each partner chooses separately whether to share a comparison
              summary and budget inputs. The demo uses fictional data and never
              shares your answers with another person.
            </p>
          </div>
          <Badge tone="neutral">Built around two voices</Badge>
        </section>
        <section className="faq-section content-width">
          <div>
            <p className="eyebrow">A FEW THINGS YOU MAY BE WONDERING</p>
            <h2>Let’s clear the air.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>
                Do we need a joint bank account?
                <Icon name="chevron" />
              </summary>
              <p>
                No. This is a planning workflow, not a bank. The MVP does not
                connect to bank accounts or move money.
              </p>
            </details>
            <details>
              <summary>
                Do we have to split everything 50/50?
                <Icon name="chevron" />
              </summary>
              <p>
                No. Compare Equal, Proportional, and Custom ways to share costs.
                Try Demo shows a fixed sample budget for each approach.
              </p>
            </details>
            <details>
              <summary>
                Is our information saved here?
                <Icon name="chevron" />
              </summary>
              <p>
                In Try Demo, drafts stay in this tab and reset on refresh.
                Your own session saves answers and records each partner’s
                confirmation separately. Use fictional details during testing.
              </p>
            </details>
          </div>
        </section>
        <section className="closing-section content-width">
          <span className="closing-spark">
            <Icon name="spark" size={30} />
          </span>
          <h2>
            Your first plan.
            <br />
            <span>A better starting point.</span>
          </h2>
          <p>A little structure for a conversation that matters.</p>
          <ButtonLink to="/create">
            Create Our Money Plan
          </ButtonLink>
        </section>
      </main>
      <footer className="landing-footer content-width">
        <Brand />
        <p>Personal planning, not financial or legal advice.</p>
        <span>Demo uses sample data</span>
      </footer>
    </div>
  );
}
