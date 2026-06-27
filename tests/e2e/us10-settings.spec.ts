import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

const NEW_TESTIMONY_ID = process.env.TEST_NEW_TESTIMONY_ID ?? 'test-new-testimony-uuid'

test.describe('US-10 — BYOK (Bring Your Own Key)', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 10.1 — US-10a
  test('10.1 — /admin/settings page renders correctly', async ({ page }) => {
    await test.step('Given: user is logged in', async () => {
      // login called in beforeEach
    })

    await test.step('When: they navigate to /admin/settings', async () => {
      await page.goto('/admin/settings')
    })

    await test.step('Then: page loads without errors', async () => {
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    })

    await test.step('And: Anthropic API key form is visible', async () => {
      await expect(page.getByTestId('api-key-form-anthropic')).toBeVisible()
      await expect(page.getByTestId('api-key-input-anthropic')).toBeVisible()
    })

    await test.step('And: OpenAI API key form is visible', async () => {
      await expect(page.getByTestId('api-key-form-openai')).toBeVisible()
      await expect(page.getByTestId('api-key-input-openai')).toBeVisible()
    })

    await test.step('And: Settings link exists in navigation', async () => {
      await page.goto('/admin')
      await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
    })
  })

  // Scenario 10.2 — US-10b
  test('10.2 — Admin can save and delete an Anthropic API key', async ({ page, request }) => {
    // Clean up: ensure no anthropic key before test
    await request.delete('/api/admin/settings/api-keys?provider=anthropic')

    await test.step('Given: user is on /admin/settings', async () => {
      await page.goto('/admin/settings')
    })

    await test.step('When: they enter an Anthropic API key and click Save', async () => {
      await page.getByTestId('api-key-input-anthropic').fill('sk-ant-test-key-for-e2e-testing')
      await page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /save/i }).click()
    })

    await test.step('Then: "Key saved" notice appears', async () => {
      await expect(page.getByTestId('api-key-saved-notice')).toBeVisible({ timeout: 5_000 })
    })

    await test.step('And: Delete key button appears', async () => {
      await expect(page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /delete key/i })).toBeVisible()
    })

    await test.step('And: GET /api/admin/settings/api-keys returns a masked key', async () => {
      const res = await request.get('/api/admin/settings/api-keys')
      expect(res.status()).toBe(200)
      const body = await res.json()
      const anthropicEntry = body.keys.find((k: { provider: string }) => k.provider === 'anthropic')
      expect(anthropicEntry).toBeTruthy()
      expect(anthropicEntry.maskedKey).toContain('****')
      expect(anthropicEntry.maskedKey).not.toBe('sk-ant-test-key-for-e2e-testing')
    })

    await test.step('When: user clicks Delete key', async () => {
      await page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /delete key/i }).click()
    })

    await test.step('Then: form resets to empty state', async () => {
      await expect(
        page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /delete key/i })
      ).not.toBeVisible({ timeout: 5_000 })
    })
  })

  // Scenario 10.3 — US-10b (API level)
  test('10.3 — PUT /api/admin/settings/api-keys saves key correctly', async ({ request }) => {
    await test.step('When: PUT request with valid provider and key', async () => {
      const res = await request.put('/api/admin/settings/api-keys', {
        data: { provider: 'openai', keyValue: 'sk-test-openai-key' },
      })
      expect(res.status()).toBe(200)
    })

    await test.step('Then: GET returns entry for openai', async () => {
      const res = await request.get('/api/admin/settings/api-keys')
      const body = await res.json()
      const openaiEntry = body.keys.find((k: { provider: string }) => k.provider === 'openai')
      expect(openaiEntry).toBeTruthy()
    })

    await test.step('And: DELETE removes the entry', async () => {
      const del = await request.delete('/api/admin/settings/api-keys?provider=openai')
      expect(del.status()).toBe(200)
      const res2 = await request.get('/api/admin/settings/api-keys')
      const body2 = await res2.json()
      const openaiEntry2 = body2.keys.find((k: { provider: string }) => k.provider === 'openai')
      expect(openaiEntry2).toBeFalsy()
    })
  })

  // Scenario 10.4 — env var priority is unit-tested, not E2E (env vars cannot be changed at runtime)
  // AiSummaryService must check process.env.ANTHROPIC_API_KEY BEFORE querying ApiKeyRepository

  // Scenario 10.5 — US-10c: explicit API key prompt, no "try again"
  test('10.5 — When no key is configured, AiSummaryPanel shows explicit prompt with Settings link', async ({ page }) => {
    await test.step('Given: summarize endpoint returns 422 no_api_key', async () => {
      await page.route(/\/api\/.*summarize/, (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'no_api_key' }),
        })
      )
      await page.goto(`/admin/testimonies/${NEW_TESTIMONY_ID}`)
    })

    await test.step('When: editor clicks "Generate Summary"', async () => {
      await page.getByRole('button', { name: /generate summary/i }).click()
    })

    await test.step('Then: alert shows explicit "No API key configured" message', async () => {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('alert')).toContainText(/no api key configured/i)
    })

    await test.step('And: alert does NOT say "try again"', async () => {
      await expect(page.getByRole('alert')).not.toContainText(/try again/i)
    })

    await test.step('And: alert contains a link to /admin/settings', async () => {
      await expect(
        page.getByRole('link', { name: /add an api key in settings/i })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: /add an api key in settings/i })
      ).toHaveAttribute('href', '/admin/settings')
    })

    await test.step('And: testimony status remains unchanged', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('new')
    })
  })

})
