import { createClient } from "@supabase/supabase-js";
import { createSessionHandler } from "./handler.ts";

interface EdgeRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
}
const runtime = (globalThis as typeof globalThis & { Deno: EdgeRuntime }).Deno;
function required(name: string) {
  const value = runtime.env.get(name);
  if (!value) throw new Error(`Missing Edge configuration: ${name}`);
  return value;
}
const url = required("SUPABASE_URL");
const key = required("FSM_SUPABASE_PUBLISHABLE_KEY");
if (!key.startsWith("sb_publishable_"))
  throw new Error(
    "Edge calls must use a publishable key, not an elevated secret.",
  );
const origins = required("FSM_ALLOWED_ORIGINS")
  .split(",")
  .map((value) => value.trim());
if (
  origins.some(
    (origin) => !origin || origin === "*" || new URL(origin).origin !== origin,
  )
)
  throw new Error("Configure exact allowed origins.");

function userClient(token: string) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
runtime.serve(
  createSessionHandler(
    {
      async verifyUser(token) {
        const { data, error } = await userClient(token).auth.getUser(token);
        return !error && !!data.user;
      },
      async rpc(name, args, token) {
        const { data, error } = await userClient(token).rpc(name, args);
        return { data, error };
      },
    },
    origins,
  ),
);
