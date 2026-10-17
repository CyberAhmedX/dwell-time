import { defineConfig, devices } from "@playwright/test";

// Browser tests play the built game (dist/index.html) end to end.
// Run `npm run build` first, then `npm run e2e`.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: true,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
});
