import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePublicBackendConfig } from "../../src/lib/backend-config.ts";
import {
  displayName,
  invitationToken,
  isUUID,
} from "../../supabase/functions/_shared/session-contract.ts";

test("missing project settings keep the application honestly unconfigured", () => {
  assert.equal(parsePublicBackendConfig({}), null);
  assert.throws(() =>
    parsePublicBackendConfig({ VITE_SUPABASE_URL: "https://example.invalid" }),
  );
});
test("elevated VITE settings and non-publishable keys are rejected", () => {
  assert.throws(() =>
    parsePublicBackendConfig({
      VITE_SUPABASE_SERVICE_ROLE_KEY: "invalid-test-value",
    }),
  );
  assert.throws(() =>
    parsePublicBackendConfig({
      VITE_SUPABASE_URL: "https://example.invalid",
      VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-publishable-key",
    }),
  );
});
test("boundary helpers reject identity-shaped input and control characters", () => {
  assert.equal(isUUID("not-a-uuid"), false);
  assert.equal(displayName("  Test A  "), "Test A");
  assert.throws(() => displayName("a".repeat(41)));
  assert.throws(() => displayName("test\u0000name"));
  assert.throws(() => invitationToken("a.b.c"));
});
