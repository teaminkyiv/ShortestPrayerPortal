import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// Replace with a real testimony ID seeded in the test DB
const TEST_TESTIMONY_ID = process.env.TEST_TESTIMONY_ID ?? 'test-testimony-uuid'

test.describe('US-4 — Просмотр детальной страницы свидетельства', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 4.1
  test('4.1 — Чанки отображаются в хронологическом порядке', async ({ page }) => {
    await test.step('Given: пользователь открывает /admin/testimonies/[id]', async () => {
      await page.goto(`/admin/testimonies/${TEST_TESTIMONY_ID}`)
    })

    await test.step('Then: список чанков отображается', async () => {
      await expect(page.getByTestId('chunks-list')).toBeVisible()
    })

    await test.step('And: каждый чанк содержит порядковый номер и временную метку', async () => {
      const chunks = page.getByTestId('chunk-item')
      const count = await chunks.count()
      if (count === 0) {
        await expect(page.getByText(/нет сообщений/i)).toBeVisible()
        return
      }
      for (let i = 0; i < count; i++) {
        await expect(chunks.nth(i).getByTestId('chunk-index')).toBeVisible()
        await expect(chunks.nth(i).getByTestId('chunk-timestamp')).toBeVisible()
      }
    })

    await test.step('And: чанки отсортированы по chunks.created_at ASC', async () => {
      const timestamps = page.getByTestId('chunk-timestamp')
      const count = await timestamps.count()
      if (count < 2) return

      const times: number[] = []
      for (let i = 0; i < count; i++) {
        const text = await timestamps.nth(i).getAttribute('datetime') ?? ''
        times.push(new Date(text).getTime())
      }
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
      }
    })
  })

  // Scenario 4.2
  test('4.2 — Метаданные свидетельства', async ({ page }) => {
    await test.step('Given: пользователь открывает /admin/testimonies/[id]', async () => {
      await page.goto(`/admin/testimonies/${TEST_TESTIMONY_ID}`)
    })

    await test.step('Then: отображается Telegram ID пользователя', async () => {
      await expect(page.getByTestId('meta-telegram-id')).toBeVisible()
    })

    await test.step('And: отображается язык', async () => {
      await expect(page.getByTestId('meta-language')).toBeVisible()
      await expect(page.getByTestId('meta-language')).toHaveText(/en|uk|ru/)
    })

    await test.step('And: отображается дата создания', async () => {
      await expect(page.getByTestId('meta-created-at')).toBeVisible()
    })

    await test.step('And: отображается текущий статус', async () => {
      await expect(page.getByTestId('meta-status')).toBeVisible()
      await expect(page.getByTestId('meta-status')).toHaveText(/new|summarized|published/)
    })
  })

})
