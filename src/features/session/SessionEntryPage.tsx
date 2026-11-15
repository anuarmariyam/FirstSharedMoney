import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Badge,
  Brand,
  Button,
  ButtonLink,
  Input,
  Notice,
} from "../../components/ui";
import { Icon } from "../../components/Icon";
import { fsmClient } from "../../services/fsm-client";
import { sessionError } from "../../services/session-error";
import { useBrowserAuth } from "../../hooks/useBrowserAuth";
import {
  displayName,
  invitationToken,
  isUUID,
} from "../../../supabase/functions/_shared/session-contract";
import type { InvitationToken } from "../../types/api";
import type { RequestId } from "../../types/domain";

function captureInvitation(): InvitationToken | null {
  try {
    return invitationToken(
      new URLSearchParams(window.location.hash.slice(1)).get("token"),
    );
  } catch {
    return null;
  }
}
function SessionEntryContent({ isJoin }: { isJoin: boolean }) {
  const navigate = useNavigate();
  const auth = useBrowserAuth();
  const configured = fsmClient.connection === "connected";
  const [token] = useState(captureInvitation);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const creation = useRef<{ name: string | null; requestId: RequestId } | null>(
    null,
  );
  const [inviteState, setInviteState] = useState<
    "unavailable" | "expired" | "invalid"
  >("unavailable");
  let previous: string | null = null;
  try {
    if (auth.userId)
      previous = localStorage.getItem(`fsm-last-session:${auth.userId}`);
  } catch {
    /* An optional locator must not block the form. */
  }
  useEffect(() => {
    if (isJoin && window.location.hash)
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
  }, [isJoin]);
  async function submit() {
    if (pending.current || !configured) return;
    let normalized: string | null;
    try {
      normalized = displayName(name);
    } catch {
      setNameError("Use 40 characters or fewer, without control characters.");
      return;
    }
    if (isJoin && !token) {
      setError(
        "The invitation is missing or has an invalid format. Reopen the original link from your partner.",
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNameError("");
    try {
      if (isJoin && token) {
        const response = await fsmClient.request(
          "redeemInvitation",
          { token, displayName: normalized },
          {},
        );
        navigate(`/sessions/${response.session.id}`);
      } else {
        if (!creation.current || creation.current.name !== normalized)
          creation.current = {
            name: normalized,
            requestId: crypto.randomUUID() as RequestId,
          };
        const response = await fsmClient.request(
          "createSession",
          { requestId: creation.current.requestId, displayName: normalized },
          {},
        );
        if (response.invitation)
          auth.rememberInvitation(response.session.id, response.invitation);
        navigate(`/sessions/${response.session.id}`);
      }
    } catch (failure) {
      setError(sessionError(failure).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
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
        <form
          className="entry-card"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="feature-icon">
            <Icon name={isJoin ? "link" : "people"} size={26} />
          </div>
          <h2>{isJoin ? "Join your partner" : "Create your shared space"}</h2>
          <p className="muted">
            {configured
              ? "Use a nickname. Your browser keeps its own anonymous identity; no email or password is required."
              : isJoin
                ? "A valid invitation will connect a separate partner identity in the live product."
                : "Live sessions will give each partner their own private access."}
          </p>
          <Input
            id="display-name"
            label="What should we call you?"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError("");
            }}
            maxLength={80}
            placeholder="A first name or nickname"
            hint="Optional. A nickname is fine."
            error={nameError}
          />
          {!configured ? (
            <Notice title="Not connected yet">
              {isJoin && inviteState !== "unavailable"
                ? `Invitation ${inviteState} — example error state only. No live invitation has been checked.`
                : "Saving is not available in this browser right now. You can still explore the preview."}
            </Notice>
          ) : (
            <Notice
              title={
                isJoin
                  ? "Your own access"
                  : "No account needed"
              }
            >
              {isJoin
                ? "Open this link in a separate browser profile or device from Partner A. We never replace an existing identity to fill the other seat."
                : "Your session will last up to 30 days. Clearing browser storage loses access; automatic recovery is not available."}
            </Notice>
          )}
          {configured && isJoin && !token && (
            <div role="alert" className="mt-4">
              <Notice tone="warning">
                The invitation is missing or has an invalid format. Reopen the
                original link from your partner. A stripped invitation cannot be
                recovered by refreshing this page.
              </Notice>
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {auth.error && (
            <p className="field-error" role="alert">
              {auth.error}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              !configured || busy || auth.restoring || (isJoin && !token)
            }
            className="w-full mt-5"
          >

            {!configured
              ? isJoin
                ? "Join session"
                : "Create session"
              : busy
                ? isJoin
                  ? "Joining your partner…"
                  : "Creating your session…"
                : auth.restoring
                  ? "Restoring browser access…"
                  : isJoin
                    ? "Join session"
                    : "Create session"}
          </Button>
          {configured && previous && isUUID(previous) && (
            <div className="mt-3">
              <ButtonLink to={`/sessions/${previous}`} variant="ghost">
                Return to my current plan
              </ButtonLink>
            </div>
          )}
          <div className="entry-divider">
            <span>or take a look around</span>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/sessions/demo")}
          >
            Explore Preview
          </Button>
          {isJoin && !configured && (
            <div className="invite-state-examples">
              <span>Preview invitation states:</span>
              <button type="button" onClick={() => setInviteState("expired")}>
                Expired
              </button>
              <button type="button" onClick={() => setInviteState("invalid")}>
                Invalid
              </button>
              <button
                type="button"
                onClick={() => setInviteState("unavailable")}
              >
                Not connected
              </button>
            </div>
          )}
          <p className="entry-bottom">
            <Icon name="info" size={14} />
            No real financial information, please.
          </p>
        </form>
      </main>
    </div>
  );
}
export function SessionEntryPage() {
  const location = useLocation();
  return (
    <SessionEntryContent
      key={`${location.pathname}:${location.hash}`}
      isJoin={location.pathname === "/join"}
    />
  );
}
