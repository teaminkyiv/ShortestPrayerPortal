import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local', override: false })
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
    {
      name: 'chromium-main',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /5\.3\s*—/,
    },
    {
      name: 'reseed',
      testDir: '.',
      testMatch: /playwright\.reseed\.ts/,
      dependencies: ['chromium-main'],
    },
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
        url: 'http://localhost:3000',
        reuseExistingServer: true,
      },
})
