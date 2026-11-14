import { defineConfig } from "@playwright/test";
import { liveEnvironment } from "./tests/live/environment.ts";

// Fail before starting a server/browser when the real test project is absent.
const env = liveEnvironment();
process.env.VITE_SUPABASE_URL = env.url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.key;

export default defineConfig({
  testDir: "./tests/live",
  testMatch: "session.spec.ts",
  workers: 1,
  retries: 0,
  outputDir: "./artifacts/live-test-results",
  reporter: "list",
  timeout: 90_000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    channel: "msedge",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command:
      "npm.cmd run dev -- --mode live-test --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
