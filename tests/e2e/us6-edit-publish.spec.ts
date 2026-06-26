import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// Each mutating test needs its own testimony to avoid cross-test state pollution.
// Seed four separate summarized records in your test DB and point env vars at them.
const ID_FOR_DRAFT   = process.env.TEST_SUMMARIZED_TESTIMONY_ID         ?? 'test-summarized-uuid'
const ID_FOR_PUBLISH = process.env.TEST_FOR_PUBLISH_TESTIMONY_ID        ?? 'test-for-publish-uuid'
const ID_FOR_PREFILL = process.env.TEST_FRESH_SUMMARIZED_TESTIMONY_ID   ?? 'test-fresh-summarized-uuid'
const ID_PUBLISHED   = process.env.TEST_PUBLISHED_TESTIMONY_ID           ?? 'test-published-uuid'

test.describe('US-6 — Редактирование и публикация', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  // Scenario 6.1
  test('6.1 — Сохранение черновика', async ({ page }) => {
    await test.step('Given: редактор на странице свидетельства (не published)', async () => {
      await page.goto(`/admin/testimonies/${ID_FOR_DRAFT}`)
      await expect(page.getByTestId('meta-status')).not.toHaveText('published')
    })

    const draftText = `Черновик — ${Date.now()}`

    await test.step('When: вводит текст в поле editedVersion', async () => {
      await page.getByTestId('edited-version-textarea').fill(draftText)
    })

    await test.step('And: нажимает "Save draft"', async () => {
      await page.getByRole('button', { name: /save draft/i }).click()
    })

    await test.step('Then: показывается уведомление "Сохранено"', async () => {
      await expect(page.getByText(/сохранено/i)).toBeVisible()
    })

    await test.step('And: статус не изменился', async () => {
      await expect(page.getByTestId('meta-status')).not.toHaveText('published')
    })

    await test.step('And: после перезагрузки страницы черновик сохранён', async () => {
      await page.reload()
      await expect(page.getByTestId('edited-version-textarea')).toHaveValue(draftText)
    })
  })

  // Scenario 6.2
  test('6.2 — Публикация свидетельства', async ({ page }) => {
    await test.step('Given: редактор заполнил поле editedVersion', async () => {
      await page.goto(`/admin/testimonies/${ID_FOR_PUBLISH}`)
      await page.getByTestId('edited-version-textarea').fill('Финальная версия свидетельства.')
    })

    await test.step('When: нажимает "Publish"', async () => {
      await page.getByRole('button', { name: /^publish$/i }).click()
    })

    await test.step('Then: статус меняется на "published"', async () => {
      await expect(page.getByTestId('meta-status')).toHaveText('published', { timeout: 10_000 })
    })

    await test.step('And: publishedAt заполнен', async () => {
      await expect(page.getByTestId('published-at')).not.toBeEmpty()
    })

    await test.step('And: publishedBy = "admin"', async () => {
      await expect(page.getByTestId('published-by')).toHaveText('admin')
    })

    await test.step('And: поля становятся read-only', async () => {
      await expect(page.getByTestId('edited-version-textarea')).toBeDisabled()
    })

    await test.step('And: кнопки "Save draft" и "Publish" исчезают', async () => {
      await expect(page.getByRole('button', { name: /save draft/i })).not.toBeVisible()
      await expect(page.getByRole('button', { name: /^publish$/i })).not.toBeVisible()
    })

    await test.step('And: отображается дата публикации', async () => {
      await expect(page.getByTestId('published-at')).toBeVisible()
    })
  })

  // Scenario 6.2 AC — Publish недоступен при пустом editedVersion
  test('6.2 AC — Кнопка Publish недоступна если editedVersion пустой', async ({ page }) => {
    await test.step('Given: editedVersion пустой', async () => {
      // Uses ID_FOR_DRAFT — read-only assertion, no mutation
      await page.goto(`/admin/testimonies/${ID_FOR_DRAFT}`)
      await page.getByTestId('edited-version-textarea').fill('')
    })

    await test.step('Then: кнопка Publish задизейблена', async () => {
      await expect(page.getByRole('button', { name: /^publish$/i })).toBeDisabled()
    })
  })

  // Scenario 6.3
  test('6.3 — Pre-fill из AI summary когда editedVersion = null', async ({ page }) => {
    await test.step('Given: свидетельство имеет ai_summary и editedVersion = null', async () => {
      // ID_FOR_PREFILL must be seeded with ai_summary set and edited_version NULL
      await page.goto(`/admin/testimonies/${ID_FOR_PREFILL}`)
      await expect(page.getByTestId('meta-status')).toHaveText('summarized')
    })

    await test.step('Then: поле editedVersion предзаполнено текстом ai_summary', async () => {
      const summaryText = await page.getByTestId('ai-summary-text').innerText()
      const textareaValue = await page.getByTestId('edited-version-textarea').inputValue()
      expect(textareaValue.trim()).toBe(summaryText.trim())
    })
  })

  // Scenario 6.3 AC — если editedVersion уже заполнен вручную, показывается он, а не summary
  test('6.3 AC — Если editedVersion уже заполнен, показывается он а не ai_summary', async ({ page }) => {
    await test.step('Given: свидетельство имеет ai_summary и editedVersion уже заполнен', async () => {
      // ID_FOR_DRAFT is seeded with ai_summary set and edited_version already populated
      await page.goto(`/admin/testimonies/${ID_FOR_DRAFT}`)
      await expect(page.getByTestId('meta-status')).not.toHaveText('published')
    })

    await test.step('Then: поле editedVersion содержит ранее сохранённый текст, а не ai_summary', async () => {
      const summaryText = await page.getByTestId('ai-summary-text').innerText()
      const textareaValue = await page.getByTestId('edited-version-textarea').inputValue()
      // editedVersion must be non-empty and must differ from the raw ai_summary
      expect(textareaValue.trim()).not.toBe('')
      expect(textareaValue.trim()).not.toBe(summaryText.trim())
    })
  })

  // Scenario 6.4
  test('6.4 — Опубликованное свидетельство доступно только в read-only', async ({ page }) => {
    await test.step('Given: свидетельство имеет статус "published"', async () => {
      await page.goto(`/admin/testimonies/${ID_PUBLISHED}`)
      await expect(page.getByTestId('meta-status')).toHaveText('published')
    })

    await test.step('Then: все поля отображаются в режиме read-only', async () => {
      await expect(page.getByTestId('edited-version-textarea')).toBeDisabled()
    })

    await test.step('And: видна дата публикации (publishedAt)', async () => {
      await expect(page.getByTestId('published-at')).toBeVisible()
    })

    await test.step('And: кнопки Save draft и Publish отсутствуют', async () => {
      await expect(page.getByRole('button', { name: /save draft/i })).not.toBeVisible()
      await expect(page.getByRole('button', { name: /^publish$/i })).not.toBeVisible()
    })
  })

})
