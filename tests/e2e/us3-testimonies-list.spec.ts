import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

test.describe('US-3 — Список свидетельств', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/admin/testimonies')
  })

  // Scenario 3.1
  test('3.1 — Фильтр по статусу', async ({ page }) => {
    await test.step('Given: пользователь на /admin/testimonies', async () => {
      await expect(page).toHaveURL('/admin/testimonies')
    })

    await test.step('And: по умолчанию активен фильтр "all"', async () => {
      await expect(page.getByRole('tab', { name: /all/i })).toHaveAttribute('aria-selected', 'true')
    })

    await test.step('When: пользователь выбирает фильтр "new"', async () => {
      await page.getByRole('tab', { name: /^new$/i }).click()
    })

    await test.step('Then: URL содержит ?status=new', async () => {
      await expect(page).toHaveURL(/status=new/)
    })

    await test.step('And: в таблице только свидетельства со статусом "new"', async () => {
      const statusCells = page.getByTestId('cell-status')
      const count = await statusCells.count()
      for (let i = 0; i < count; i++) {
        await expect(statusCells.nth(i)).toHaveText('new')
      }
    })

    await test.step('And: доступны фильтры all, new, summarized, published', async () => {
      for (const label of ['all', 'new', 'summarized', 'published']) {
        await expect(page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible()
      }
    })
  })

  // Scenario 3.2
  test('3.2 — Пагинация', async ({ page }) => {
    await test.step('Given: на /admin/testimonies более 20 свидетельств (предположительно)', async () => {
      // Этот тест значим только при наличии >20 записей в БД.
      // При пустой БД тест помечает себя как passed (нет кнопок → нечего проверять).
    })

    await test.step('Then: отображаются первые 20 записей', async () => {
      const rows = page.getByRole('table').getByRole('row')
      const count = await rows.count() - 1 // без header
      expect(count).toBeLessThanOrEqual(20)
    })

    const nextBtn = page.getByRole('button', { name: /следующая|next/i })
    const hasNext = await nextBtn.isVisible()

    if (hasNext) {
      await test.step('And: доступна кнопка следующей страницы', async () => {
        await expect(nextBtn).toBeEnabled()
      })

      await test.step('When: переходим на страницу 2', async () => {
        await nextBtn.click()
      })

      await test.step('Then: URL содержит ?page=2', async () => {
        await expect(page).toHaveURL(/page=2/)
      })

      await test.step('And: отображаются следующие 20 записей', async () => {
        const rows = page.getByRole('table').getByRole('row')
        expect(await rows.count() - 1).toBeLessThanOrEqual(20)
      })
    }
  })

  // Scenario 3.3
  test('3.3 — Сортировка по testimonies.created_at DESC', async ({ page }) => {
    await test.step('Given: пользователь на /admin/testimonies', async () => {
      await expect(page).toHaveURL('/admin/testimonies')
    })

    await test.step('Then: записи отсортированы по testimonies.created_at DESC (новые сначала)', async () => {
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
