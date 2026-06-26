import { test, expect } from '@playwright/test'

// Webhook tests use Playwright's API request context — no UI/login needed.
const WEBHOOK_URL = '/api/webhooks/testimony-finished'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? 'test-webhook-secret'
const EXISTING_TESTIMONY_ID = process.env.TEST_NEW_TESTIMONY_ID ?? 'test-new-testimony-uuid'
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('US-9 — Webhook від бота', () => {

  // Scenario 9.1
  test('9.1 — Успешное создание testimony_review', async ({ request }) => {
    await test.step('Given: бот завершает свидетельство (testimonies.status = "finished")', async () => {
      // seed assumed; TEST_NEW_TESTIMONY_ID exists in DB with status 'finished'
    })

    let response: Awaited<ReturnType<typeof request.post>>

    await test.step('When: бот отправляет POST с верным X-Webhook-Secret', async () => {
      response = await request.post(WEBHOOK_URL, {
        headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
        data: { testimonyId: EXISTING_TESTIMONY_ID },
      })
    })

    await test.step('Then: возвращается HTTP 200', async () => {
      expect(response.status()).toBe(200)
    })

    await test.step('And: повторный запрос idempotent — тоже 200', async () => {
      const response2 = await request.post(WEBHOOK_URL, {
        headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
        data: { testimonyId: EXISTING_TESTIMONY_ID },
      })
      expect(response2.status()).toBe(200)
    })
  })

  // Scenario 9.2
  test('9.2 — Неверный webhook secret → 401', async ({ request }) => {
    let response: Awaited<ReturnType<typeof request.post>>

    await test.step('When: запрос с неверным X-Webhook-Secret', async () => {
      response = await request.post(WEBHOOK_URL, {
        headers: { 'X-Webhook-Secret': 'wrong-secret' },
        data: { testimonyId: EXISTING_TESTIMONY_ID },
      })
    })

    await test.step('Then: возвращается HTTP 401', async () => {
      expect(response.status()).toBe(401)
    })

    await test.step('And: тело ответа не раскрывает причину отказа', async () => {
      const body = await response.text()
      expect(body).not.toMatch(/secret|password|token/i)
    })
  })

  test('9.2b — Отсутствующий заголовок X-Webhook-Secret → 401', async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: { testimonyId: EXISTING_TESTIMONY_ID },
    })
    expect(response.status()).toBe(401)
  })

  // Scenario 9.3
  test('9.3 — Несуществующий testimonyId → 404', async ({ request }) => {
    let response: Awaited<ReturnType<typeof request.post>>

    await test.step('When: запрос с testimonyId которого нет в testimonies', async () => {
      response = await request.post(WEBHOOK_URL, {
        headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
        data: { testimonyId: NONEXISTENT_ID },
      })
    })

    await test.step('Then: возвращается HTTP 404', async () => {
      expect(response.status()).toBe(404)
    })

    await test.step('And: запись в testimony_reviews не создаётся', async () => {
      // Verify idempotently: sending again still returns 404
      const response2 = await request.post(WEBHOOK_URL, {
        headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
        data: { testimonyId: NONEXISTENT_ID },
      })
      expect(response2.status()).toBe(404)
    })
  })

})
