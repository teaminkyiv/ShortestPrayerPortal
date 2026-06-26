import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('US-2 — Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 2.1
  test('2.1 — Отображение счётчиков статусов', async ({ page }) => {
    await test.step('Given: пользователь авторизован и открывает /admin', async () => {
      await page.goto('/admin')
    })

    await test.step('Then: видны три счётчика — new, summarized, published', async () => {
      await expect(page.getByTestId('counter-new')).toBeVisible()
      await expect(page.getByTestId('counter-summarized')).toBeVisible()
      await expect(page.getByTestId('counter-published')).toBeVisible()
    })

    await test.step('And: счётчик "new" выделен если значение > 0', async () => {
      const counter = page.getByTestId('counter-new')
      const value = parseInt(await counter.innerText(), 10)
      if (value > 0) {
        // должен иметь класс выделения (красный / оранжевый)
        await expect(counter).toHaveClass(/text-red|text-orange|bg-red|bg-orange/i)
      } else {
        await expect(counter).not.toHaveClass(/text-red|text-orange|bg-red|bg-orange/i)
      }
    })
  })

  // Scenario 2.2
  test('2.2 — Таблица последних 20 свидетельств', async ({ page }) => {
    await test.step('Given: пользователь авторизован и открывает /admin', async () => {
      await page.goto('/admin')
    })

    await test.step('Then: таблица свидетельств отображается', async () => {
      await expect(page.getByRole('table')).toBeVisible()
    })

    await test.step('And: не более 20 строк в таблице', async () => {
      const rows = page.getByRole('table').getByRole('row')
      // rows включает header, поэтому data rows = count - 1
      expect(await rows.count()).toBeLessThanOrEqual(21)
    })

    await test.step('And: каждая строка содержит Telegram ID, язык, дату, статус', async () => {
      const firstDataRow = page.getByRole('table').getByRole('row').nth(1)
      await expect(firstDataRow.getByTestId('cell-telegram-id')).toBeVisible()
      await expect(firstDataRow.getByTestId('cell-language')).toBeVisible()
      await expect(firstDataRow.getByTestId('cell-date')).toBeVisible()
      await expect(firstDataRow.getByTestId('cell-status')).toBeVisible()
    })

    await test.step('And: строки отсортированы по testimonies.created_at DESC (новые сначала)', async () => {
      const dateCells = page.getByTestId('cell-date')
      const count = await dateCells.count()
      if (count < 2) return

      const dates: number[] = []
      for (let i = 0; i < count; i++) {
        const text = await dateCells.nth(i).innerText()
        dates.push(new Date(text).getTime())
      }
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1])
      }
    })
  })

})
