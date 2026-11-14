import { createContext } from "react";
import type { CoupleId } from "../types/domain";
import type { IssuedInvitation } from "../types/api";

export interface BrowserAuthState {
  userId: string | null;
  restoring: boolean;
  error: string | null;
  issued: { coupleId: CoupleId; invitation: IssuedInvitation } | null;
  rememberInvitation(coupleId: CoupleId, invitation: IssuedInvitation): void;
}
export const AuthContext = createContext<BrowserAuthState | null>(null);
