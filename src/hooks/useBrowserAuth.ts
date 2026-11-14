import { useContext } from "react";
import { AuthContext } from "../app/auth-context";
export function useBrowserAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required.");
  return context;
}
