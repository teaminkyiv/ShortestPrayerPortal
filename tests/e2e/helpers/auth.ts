import { Page } from '@playwright/test'

const PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'test-password'

export async function login(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: /пароль/i }).fill(PASSWORD)
  await page.getByRole('button', { name: /войти/i }).click()
  await page.waitForURL('/admin')
}

export async function ensureLoggedOut(page: Page) {
  await page.context().clearCookies()
}
