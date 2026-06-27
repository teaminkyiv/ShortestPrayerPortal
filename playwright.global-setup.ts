import { execSync } from 'child_process'
import { chromium } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.test', override: false })

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const PASSWORD  = process.env.TEST_ADMIN_PASSWORD ?? 'test-password'

async function globalSetup() {
  execSync('npm run seed:test', { stdio: 'inherit' })

  // Save authenticated session state so the `request` fixture shares cookies
  const browser = await chromium.launch()
  const page    = await browser.newPage()

  await page.goto(`${BASE_URL}/admin/login`)
  await page.getByRole('textbox', { name: /пароль/i }).fill(PASSWORD)
  await page.getByRole('button',  { name: /войти/i }).click()
  await page.waitForURL(`${BASE_URL}/admin`)

  await page.context().storageState({ path: '.playwright-auth.json' })
  await browser.close()
}

export default globalSetup
