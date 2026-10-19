const { defineConfig, devices } = require("@playwright/test");

if (!process.env.CI) {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
}

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:4321",
    reducedMotion: "reduce",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "Desktop Chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile WebKit",
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: "python3 -m http.server 4321",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
  },
});
