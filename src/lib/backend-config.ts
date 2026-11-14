export interface PublicBackendConfig {
  url: string;
  publishableKey: string;
  storageKey: string;
}
export function parsePublicBackendConfig(
  env: Record<string, string | undefined>,
): PublicBackendConfig | null {
  for (const name of Object.keys(env)) {
    if (
      name.startsWith("VITE_") &&
      /SECRET|SERVICE_ROLE|DB_PASSWORD|ACCESS_TOKEN/i.test(name) &&
      env[name]
    )
      throw new Error(
        `Privileged configuration must not use the VITE_ prefix: ${name}`,
      );
  }
  const url = env.VITE_SUPABASE_URL?.trim() || "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  if (!url && !key) return null;
  if (!url || !key)
    throw new Error(
      "Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key))
    throw new Error(
      "Use a Supabase publishable key, never a secret or service_role key.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error(
      "Use the actual HTTPS Supabase project URL without credentials, paths, or query parameters.",
    );
  return {
    url: parsed.origin,
    publishableKey: key,
    storageKey: `fsm-auth-${parsed.hostname}`,
  };
}
