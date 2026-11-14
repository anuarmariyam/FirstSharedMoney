import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { parsePublicBackendConfig } from "./src/lib/backend-config.ts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const uiTest = mode === "ui-test";
  parsePublicBackendConfig(
    uiTest
      ? { ...env, VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" }
      : env,
  );
  return {
    plugins: [react(), tailwindcss()],
    define: uiTest
      ? {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
        }
      : {},
  };
});
