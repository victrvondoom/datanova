import { defineConfig } from "@playwright/test";

// E2E tests run against the production build served by `vite preview`
// (port 4173) with the real API on 127.0.0.1 (auto-detected ports 8002/8000/8001).
// The API must be started with CORS including http://localhost:4173.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  reporter: [["list"]],
});
