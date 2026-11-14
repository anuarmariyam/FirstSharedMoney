import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthContext, type BrowserAuthState } from "./auth-context";
import { supabase } from "../services/supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    userId: null as string | null,
    restoring: !!supabase,
    error: null as string | null,
  });
  const [issued, setIssued] = useState<BrowserAuthState["issued"]>(null);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let events = 0;
    function accept(session: Session | null) {
      if (!active) return;
      const userId = session?.user.id ?? null;
      if (identity.current !== userId) {
        identity.current = userId;
        setIssued(null);
      }
      setState({ userId, restoring: false, error: null });
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      events++;
      accept(session);
    });
    const initialEvents = events;
    void supabase.auth
      .getSession()
      .then((result) => {
        if (!active || events !== initialEvents) return;
        if (result.error)
          setState({
            userId: null,
            restoring: false,
            error: "The existing browser session could not be restored.",
          });
        else accept(result.data.session);
      })
      .catch(() => {
        if (active)
          setState({
            userId: null,
            restoring: false,
            error: "Browser identity restoration failed.",
          });
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        ...state,
        issued,
        rememberInvitation: (coupleId, invitation) =>
          setIssued({ coupleId, invitation }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
