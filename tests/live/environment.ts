import { existsSync } from "node:fs";

export function liveEnvironment() {
  if (existsSync(".env.security.local"))
    process.loadEnvFile(".env.security.local");
  const required = [
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "FSM_TEST_PROJECT_REF",
    "FSM_TEST_DATABASE_URL",
    "FSM_ALLOW_TEST_DATABASE_MUTATIONS",
  ] as const;
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(
      `Live tests were not run. Missing configuration: ${missing.join(", ")}. Use tests/security.env.example.`,
    );
  if (process.env.FSM_ALLOW_TEST_DATABASE_MUTATIONS !== "1")
    throw new Error(
      "Live tests were not run. A disposable test project must be explicitly acknowledged.",
    );
  const url = new URL(process.env.SUPABASE_URL!);
  const ref = process.env.FSM_TEST_PROJECT_REF!;
  if (
    url.protocol !== "https:" ||
    url.hostname !== `${ref}.supabase.co` ||
    url.pathname !== "/" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Live tests were not run. The actual test project URL must match FSM_TEST_PROJECT_REF.",
    );
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "Live tests require a publishable project key, not a server secret.",
    );
  const database = new URL(process.env.FSM_TEST_DATABASE_URL!);
  const direct = database.hostname === `db.${ref}.supabase.co`;
  const pooler =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${ref}`;
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    (!direct && !pooler)
  )
    throw new Error(
      "Live tests were not run. The database connection must belong to the same disposable Supabase project.",
    );
  // pg URL SSL parameters can replace explicit SSL options. Enforce our own CA check.
  for (const parameter of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    database.searchParams.delete(parameter);
  return {
    url: url.origin,
    key,
    ref,
    databaseURL: database.toString(),
    caFile: process.env.FSM_TEST_DATABASE_CA_FILE,
    appOrigin: process.env.FSM_TEST_APP_ORIGIN || "http://127.0.0.1:5173",
  };
}
