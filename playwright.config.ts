import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

// Load test env vars (.env.test is git-ignored; create it from .env.test.example)
config({ path: '.env.test', override: false })

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './playwright.global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    // Main project: all tests except 5.3 (which needs a DB reset after 5.1 mutates data)
    {
      name: 'chromium-main',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /5\.3\s*—/,
    },
    // Re-seed the DB after 5.1 generates a summary for NEW_TESTIMONY_ID
    {
      name: 'reseed',
      testDir: '.',
      testMatch: /playwright\.reseed\.ts/,
      dependencies: ['chromium-main'],
    },
    // Run 5.3 after the reseed so NEW_TESTIMONY_ID is back to "new" state
    {
      name: 'chromium-5-3',
      use: { ...devices['Desktop Chrome'] },
      grep: /5\.3\s*—/,
      dependencies: ['reseed'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/admin/login',
        reuseExistingServer: true,
      },
})
