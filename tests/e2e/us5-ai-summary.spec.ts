import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

const NEW_TESTIMONY_ID = process.env.TEST_NEW_TESTIMONY_ID ?? 'test-new-testimony-uuid'
const SUMMARIZED_TESTIMONY_ID = process.env.TEST_SUMMARIZED_TESTIMONY_ID ?? 'test-summarized-testimony-uuid'

test.describe('US-5 — AI Summary', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 5.1
  test('5.1 — Генерация summary для нового свидетельства', async ({ page }) => {
    await test.step('Given: свидетельство имеет статус "new" и ai_summary = null', async () => {
      await page.goto(`/admin/testimonies/${NEW_TESTIMONY_ID}`)
      await expect(page.getByTestId('meta-status')).toHaveText('new')
    })

    await test.step('Then: кнопка "Generate Summary" видна и активна', async () => {
      await expect(page.getByRole('button', { name: /generate summary/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /generate summary/i })).toBeEnabled()
    })

    await test.step('When: редактор нажимает "Generate Summary"', async () => {
      await page.getByRole('button', { name: /generate summary/i }).click()
    })

    await test.step('Then: кнопка блокируется и показывает spinner', async () => {
      await expect(page.getByRole('button', { name: /generate summary/i })).toBeDisabled()
      await expect(page.getByTestId('spinner')).toBeVisible()
    })

    await test.step('When: генерация завершается', async () => {
      await expect(page.getByTestId('ai-summary-text')).toBeVisible({ timeout: 30_000 })
    })

    await test.step('Then: статус меняется на "summarized"', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('summarized')
    })

    await test.step('And: поле summarizedAt заполняется', async () => {
      await expect(page.getByTestId('meta-summarized-at')).not.toBeEmpty()
    })
  })

  // Scenario 5.2
  test('5.2 — Регенерация summary при статусе summarized', async ({ page }) => {
    await test.step('Given: свидетельство имеет статус "summarized" и ai_summary заполнен', async () => {
      await page.goto(`/admin/testimonies/${SUMMARIZED_TESTIMONY_ID}`)
      await expect(page.getByTestId('meta-status')).toHaveText('summarized')
      await expect(page.getByTestId('ai-summary-text')).not.toBeEmpty()
    })

    await test.step('Then: отображается кнопка "Regenerate" (не "Generate Summary")', async () => {
      await expect(page.getByRole('button', { name: /regenerate/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /generate summary/i })).not.toBeVisible()
    })

    const oldSummary = await page.getByTestId('ai-summary-text').innerText()

    await test.step('When: редактор нажимает "Regenerate"', async () => {
      await page.getByRole('button', { name: /regenerate/i }).click()
    })

    await test.step('Then: генерируется новый summary', async () => {
      await page.waitForFunction(
        (old) => {
          const el = document.querySelector('[data-testid="ai-summary-text"]')
          return el && el.textContent !== old && el.textContent !== ''
        },
        oldSummary,
        { timeout: 30_000 },
      )
    })

    await test.step('And: статус остаётся "summarized"', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('summarized')
    })
  })

  // AC: ошибка API — toast, статус не меняется
  test('5.3 — Ошибка AI API показывает toast, статус не меняется', async ({ page }) => {
    await test.step('Given: AI API недоступен (mock 500)', async () => {
      // Matches any API route that contains "summarize" — adapts to the actual Next.js path
      await page.route(/\/api\/.*summarize/, (route) =>
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      )
      await page.goto(`/admin/testimonies/${NEW_TESTIMONY_ID}`)
    })

    await test.step('When: редактор нажимает "Generate Summary"', async () => {
      await page.getByRole('button', { name: /generate summary/i }).click()
    })

    await test.step('Then: показывается toast с ошибкой', async () => {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    })

    await test.step('And: статус остаётся "new"', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('new')
    })
  })

})
