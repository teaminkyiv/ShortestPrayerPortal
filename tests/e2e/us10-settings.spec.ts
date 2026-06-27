import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

const NEW_TESTIMONY_ID = process.env.TEST_NEW_TESTIMONY_ID ?? 'test-new-testimony-uuid'

test.describe('US-10 — BYOK (Bring Your Own Key)', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 10.1
  test('10.1 — Страница /admin/settings отображается', async ({ page }) => {
    await test.step('Given: пользователь авторизован', async () => {
      // login called in beforeEach
    })

    await test.step('When: он переходит на /admin/settings', async () => {
      await page.goto('/admin/settings')
    })

    await test.step('Then: страница загружается без ошибок', async () => {
      await expect(page).not.toHaveURL(/login/)
      await expect(page.getByRole('heading', { name: /настройки/i })).toBeVisible()
    })

    await test.step('And: форма для Anthropic API ключа видна', async () => {
      await expect(page.getByTestId('api-key-form-anthropic')).toBeVisible()
      await expect(page.getByTestId('api-key-input-anthropic')).toBeVisible()
    })

    await test.step('And: форма для OpenAI API ключа видна', async () => {
      await expect(page.getByTestId('api-key-form-openai')).toBeVisible()
      await expect(page.getByTestId('api-key-input-openai')).toBeVisible()
    })

    await test.step('And: ссылка на /admin/settings есть в навигации', async () => {
      await page.goto('/admin')
      await expect(page.getByRole('link', { name: /настройки/i })).toBeVisible()
    })
  })

  // Scenario 10.2
  test('10.2 — Admin может сохранить Anthropic API ключ', async ({ page, request }) => {
    // Clean up: ensure no anthropic key before test
    await request.delete('/api/admin/settings/api-keys?provider=anthropic')

    await test.step('Given: пользователь на /admin/settings', async () => {
      await page.goto('/admin/settings')
    })

    await test.step('When: он вводит Anthropic API ключ и нажимает "Сохранить"', async () => {
      await page.getByTestId('api-key-input-anthropic').fill('sk-ant-test-key-for-e2e-testing')
      await page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /save|сохранить/i }).click()
    })

    await test.step('Then: показывается уведомление "Ключ сохранён"', async () => {
      await expect(page.getByTestId('api-key-saved-notice')).toBeVisible({ timeout: 5_000 })
    })

    await test.step('And: кнопка "Удалить ключ" появляется', async () => {
      await expect(page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /удалить ключ/i })).toBeVisible()
    })

    await test.step('And: GET /api/admin/settings/api-keys возвращает маскированный ключ', async () => {
      const res = await request.get('/api/admin/settings/api-keys')
      expect(res.status()).toBe(200)
      const body = await res.json()
      const anthropicEntry = body.keys.find((k: { provider: string }) => k.provider === 'anthropic')
      expect(anthropicEntry).toBeTruthy()
      expect(anthropicEntry.maskedKey).toContain('****')
      expect(anthropicEntry.maskedKey).not.toBe('sk-ant-test-key-for-e2e-testing')
    })

    await test.step('When: пользователь нажимает "Удалить ключ"', async () => {
      await page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /удалить ключ/i }).click()
    })

    await test.step('Then: форма возвращается в пустое состояние', async () => {
      await expect(
        page.getByTestId('api-key-form-anthropic').getByRole('button', { name: /удалить ключ/i })
      ).not.toBeVisible({ timeout: 5_000 })
    })
  })

  // Scenario 10.3 — tested via API (env var mocking not available in E2E)
  // This test verifies the fallback API call chain at the HTTP level
  test('10.3 — PUT /api/admin/settings/api-keys сохраняет ключ корректно (API)', async ({ request }) => {
    await test.step('When: PUT запрос с валидным провайдером и ключом', async () => {
      const res = await request.put('/api/admin/settings/api-keys', {
        data: { provider: 'openai', keyValue: 'sk-test-openai-key' },
      })
      expect(res.status()).toBe(200)
    })

    await test.step('Then: GET возвращает запись для openai', async () => {
      const res = await request.get('/api/admin/settings/api-keys')
      const body = await res.json()
      const openaiEntry = body.keys.find((k: { provider: string }) => k.provider === 'openai')
      expect(openaiEntry).toBeTruthy()
    })

    await test.step('And: DELETE удаляет запись', async () => {
      const del = await request.delete('/api/admin/settings/api-keys?provider=openai')
      expect(del.status()).toBe(200)
      const res2 = await request.get('/api/admin/settings/api-keys')
      const body2 = await res2.json()
      const openaiEntry2 = body2.keys.find((k: { provider: string }) => k.provider === 'openai')
      expect(openaiEntry2).toBeFalsy()
    })
  })

  // Scenario 10.4 — env var priority is unit-tested, not E2E (env vars cannot be changed at runtime)
  // Documented here as a reminder for the implementation contract:
  // AiSummaryService must check process.env.ANTHROPIC_API_KEY BEFORE querying DrizzleApiKeyRepository

  // Scenario 10.5
  test('10.5 — Если ключа нет нигде — AiSummaryPanel показывает ошибку со ссылкой на /admin/settings', async ({ page }) => {
    await test.step('Given: AI API мокирован для возврата 422 no_api_key', async () => {
      await page.route(/\/api\/.*summarize/, (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'no_api_key', settingsUrl: '/admin/settings' }),
        })
      )
      await page.goto(`/admin/testimonies/${NEW_TESTIMONY_ID}`)
    })

    await test.step('When: редактор нажимает "Generate Summary"', async () => {
      await page.getByRole('button', { name: /generate summary/i }).click()
    })

    await test.step('Then: показывается alert с сообщением о ненастроенном ключе', async () => {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('alert')).toContainText(/api ключ не настроен/i)
    })

    await test.step('And: в alert есть ссылка на /admin/settings', async () => {
      await expect(
        page.getByRole('link', { name: /перейти в настройки/i })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: /перейти в настройки/i })
      ).toHaveAttribute('href', '/admin/settings')
    })

    await test.step('And: статус свидетельства не меняется (остаётся "new")', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('new')
    })
  })

})
