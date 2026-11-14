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
        description={`You are ${viewer.displayName}, Partner ${viewer.slot}. This status was loaded from the session API.`}
      >
        <Badge tone="green">Session connected</Badge>
      </PageHeading>
      <Notice title="Phase 4A: session management only">
        Membership and invitations use Supabase. Questionnaires, financial
        analysis, and agreement approval are not connected to this live session
        yet. Use fictional names during testing.
      </Notice>
      <div className="overview-grid mt-6">
        <section className="surface overview-main">
          <p className="eyebrow">SEPARATE IDENTITIES, SHARED START</p>
          <h2>
            {session.partners.length === 2
              ? "Your partner has joined."
              : "Invite the other perspective."}
          </h2>
          <p>
            {session.partners.length === 2
              ? "Both partner places are now taken. Each browser keeps its own identity."
              : viewer.slot === "A"
                ? "Send a single-use invitation to your partner. It never includes your own access token."
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
                  The raw invitation is not stored on the server. After refresh
                  or expiry, issue a new invitation; previous unused links will
                  stop working.
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
          <h2>Questionnaires come next.</h2>
          <p>
            Live financial input is not enabled in Phase 4A. The separate demo
            still uses fictional, unsaved data.
          </p>
        </div>
        <ButtonLink to="/sessions/demo">
          Explore the fictional preview <Icon name="arrow" />
        </ButtonLink>
      </div>
    </>
  );
}
