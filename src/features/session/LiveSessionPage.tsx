import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import type { CoupleSession } from "../../types/domain";
import {
  Badge,
  Button,
  ButtonLink,
  Notice,
  PageHeading,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useBrowserAuth } from "../../hooks/useBrowserAuth";
import { fsmClient } from "../../services/fsm-client";
import { sessionError } from "../../services/session-error";

export function LiveSessionPage() {
  const { session, reload } = useOutletContext<{
    session: CoupleSession;
    reload(): void;
  }>();
  const auth = useBrowserAuth();
  const viewer = session.partners.find(
    (partner) => partner.id === session.viewerPartnerId,
  )!;
  const bothSubmitted = session.partners.length === 2 && session.partners.every(p => p.questionnaireStatus === 'submitted');
  const ownSubmitted = viewer.questionnaireStatus === 'submitted';
  const nextLabel = !ownSubmitted ? 'Complete my questionnaire' : bothSubmitted ? 'Compare preferences' : 'Review sharing choices';
  const nextPath = !ownSubmitted ? 'questionnaire' : bothSubmitted ? 'differences' : 'questionnaire/consent';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const pending = useRef(false);
  const invitation =
    auth.issued?.coupleId === session.id ? auth.issued.invitation : null;
  const available = invitation && Date.parse(invitation.expiresAt) > now;
  const invitationUrl = available
    ? `${window.location.origin}/join#token=${invitation.token}`
    : "";
  async function rotate() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const result = await fsmClient.request("rotateInvitation", null, {
        coupleId: session.id,
      });
      auth.rememberInvitation(session.id, result);
    } catch (failure) {
      setError(sessionError(failure).message);
      reload();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setError("");
    } catch {
      setError(
        "Clipboard access was unavailable. Select and copy the invitation field instead.",
      );
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR SHARED STARTING POINT"
        title={
          session.partners.length === 2
            ? "Two perspectives. One shared space."
            : "Your shared space is ready."
        }
        description={`Welcome, ${viewer.displayName}. Build a plan together, one conversation at a time.`}
      >
        <Badge tone="green">Session connected</Badge>
      </PageHeading>
      <div className="overview-grid mt-6">
        <section className="surface overview-main">
          <p className="eyebrow">SEPARATE IDENTITIES, SHARED START</p>
          <h2>
            {session.partners.length === 2
              ? "Your partner has joined."
              : "Invite your partner"}
          </h2>
          <p>
            {session.partners.length === 2
              ? bothSubmitted ? "Both questionnaires are complete. Shared results become available when you both allow sharing." : "You are both here. Complete your questionnaires separately to start planning."
              : viewer.slot === "A"
                ? "Share this one-time link privately. Your partner should open it in a different browser profile or device."
                : "Your access belongs to this browser identity."}
          </p>
          <Button variant="secondary" onClick={reload}>
            <Icon name="refresh" size={16} />
            Refresh session status
          </Button>
          <p className="field-hint mt-4">
            Access expires{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(session.expiresAt))}
            . Clearing browser storage loses access.
          </p>
        </section>
        <section className="surface partner-card">
          <div className="flex items-center gap-3">
            <span className="feature-icon">
              <Icon name="people" />
            </span>
            <h2>A place for both of you</h2>
          </div>
          {session.partners.map((partner) => (
            <div className="partner-row" key={partner.id}>
              <span className="avatar">{partner.slot}</span>
              <div>
                <strong>{partner.displayName}</strong>
                <p>
                  Partner {partner.slot}
                  {partner.id === session.viewerPartnerId ? " · You" : ""}
                </p>
              </div>
              <Badge tone="green">Joined</Badge>
            </div>
          ))}
          {session.partners.length === 1 && (
            <div className="partner-row">
              <span className="avatar avatar-muted">B</span>
              <div>
                <strong>Partner B</strong>
                <p>Waiting for an invitation to be accepted</p>
              </div>
              <Icon name="clock" />
            </div>
          )}
          {viewer.slot === "A" && session.partners.length === 1 && (
            <div className="mt-5">
              {available ? (
                <>
                  <label className="field-hint" htmlFor="live-invitation">
                    Single-use partner invitation
                  </label>
                  <input
                    id="live-invitation"
                    className="input mt-2"
                    readOnly
                    value={invitationUrl}
                    onFocus={(event) => event.target.select()}
                  />
                  <p className="field-hint">
                    Expires{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(invitation.expiresAt))}
                    . Open in a different browser profile or device.
                  </p>
                  <Button onClick={() => void copy()} className="w-full mt-3">
                    {copied ? "Invitation copied" : "Copy invitation"}
                  </Button>
                  {copied && (
                    <p role="status" className="field-hint">
                      Invitation copied. Share it only with your intended
                      partner.
                    </p>
                  )}
                </>
              ) : (
                <Notice>
                  For your privacy, the invitation is not kept after refresh.
                  Create a new link if needed; the previous unused link will stop working.
                </Notice>
              )}
              <Button
                variant="secondary"
                className="w-full mt-3"
                disabled={busy}
                onClick={() => void rotate()}
              >
                {busy
                  ? "Replacing invitation…"
                  : available
                    ? "Revoke & replace invitation"
                    : "Generate new invitation"}
              </Button>
              <p className="field-hint">
                Replacing a link immediately revokes the previous unused
                invitation.
              </p>
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
      <div className="next-step-banner">
        <div>
          <p className="eyebrow">THE NEXT PART OF THE CONVERSATION</p>
          <h2>{!ownSubmitted ? 'Your perspective comes first.' : bothSubmitted ? 'Your answers are complete.' : 'Waiting for your partner’s questionnaire.'}</h2>
          <p>
            Save your answers privately, then choose what may be used in your
            shared plan.
          </p>
        </div>
        <ButtonLink to={`/sessions/${session.id}/${nextPath}`}>
          {nextLabel}
        </ButtonLink>
      </div>
    </>
  );
}
