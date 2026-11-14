import { Badge } from "./ui";
import { Icon } from "./Icon";

/** A labeled editorial illustration, not a live financial result. */
export function PlanPreview() {
  return (
    <div className="plan-illustration">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="plan-paper">
        <div className="flex items-center justify-between gap-4">
          <span className="paper-eyebrow">OUR FIRST MONEY PLAN</span>
          <Badge tone="neutral">Draft</Badge>
        </div>
        <div className="paper-title">
          <div className="small-avatars">
            <span>A</span>
            <span>B</span>
          </div>
          <div>
            <h3>
              A little clarity.
              <br />A lot more together.
            </h3>
          </div>
        </div>
        <div className="paper-expenses">
          <div>
            <span>
              <Icon name="home" size={17} />
              Rent & home
            </span>
            <strong>$2,200</strong>
          </div>
          <div>
            <span>
              <Icon name="spark" size={17} />
              Everyday essentials
            </span>
            <strong>$1,000</strong>
          </div>
        </div>
        <div className="paper-total">
          <span>Monthly shared budget</span>
          <strong>
            $3,200<span> / mo</span>
          </strong>
        </div>
        <div
          className="split-bar"
          aria-label="Illustrative split: Partner A 62.5%, Partner B 37.5%"
        >
          <span style={{ width: "62.5%" }} />
          <span style={{ width: "37.5%" }} />
        </div>
        <div className="paper-partners">
          <div>
            <i className="dot dot-purple" />
            <span>Partner A</span>
            <strong>$2,000</strong>
          </div>
          <div>
            <i className="dot dot-lavender" />
            <span>Partner B</span>
            <strong>$1,200</strong>
          </div>
        </div>
        <div className="paper-caption">
          <Icon name="info" size={14} />
          Fictional proportional example · not calculated live
        </div>
      </div>
      <div className="floating-note">
        <span className="note-icon">
          <Icon name="chat" size={21} />
        </span>
        <div>
          <strong>Different starting points?</strong>
          <p>That’s where the conversation starts.</p>
        </div>
      </div>
      <span className="illustration-caption">
        A glimpse of what you can build together.
      </span>
    </div>
  );
}
