import { test, expect } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

test.describe('US-1 — Authentication', () => {

  // Scenario 1.1
  test('1.1 — Unauthenticated access redirects to sign-in', async ({ page }) => {
    await test.step('Given: no auth token; When: navigating to /admin', async () => {
      await page.goto('/admin')
    })

    await test.step('Then: redirected to /sign-in', async () => {
      await expect(page).toHaveURL(/\/sign-in/)
    })
  })

  // Scenario 1.2
  test('1.2 — Unauthenticated access to sub-routes redirects to sign-in', async ({ page }) => {
    for (const path of ['/admin/testimonies', '/admin/settings']) {
      await test.step(`Given: no auth; When: navigating to ${path}`, async () => {
        await page.goto(path)
      })

      await test.step(`Then: redirected to /sign-in (for ${path})`, async () => {
        await expect(page).toHaveURL(/\/sign-in/)
      })
    }
  })

  // Scenario 1.3
  test('1.3 — Authenticated user can access /admin', async ({ page }) => {
    await test.step('Given: valid Clerk testing token', async () => {
      await setupClerkTestingToken({ page })
    })

    await test.step('When: navigating to /admin', async () => {
      await page.goto('/admin')
    })

    await test.step('Then: /admin loads successfully', async () => {
      await expect(page).toHaveURL('/admin')
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
    })
  })

})
