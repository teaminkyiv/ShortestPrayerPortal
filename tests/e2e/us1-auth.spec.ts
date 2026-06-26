import { test, expect } from '@playwright/test'
import { login, ensureLoggedOut } from './helpers/auth'

const CORRECT_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'test-password'

test.describe('US-1 — Вход в систему', () => {

  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page)
  })

  // Scenario 1.1
  test('1.1 — Успешный вход с верным паролем', async ({ page }) => {
    await test.step('Given: пользователь открывает /admin/login', async () => {
      await page.goto('/admin/login')
      await expect(page).toHaveURL('/admin/login')
    })

    await test.step('When: вводит верный пароль и нажимает "Войти"', async () => {
      await page.getByRole('textbox', { name: /пароль/i }).fill(CORRECT_PASSWORD)
      await page.getByRole('button', { name: /войти/i }).click()
    })

    await test.step('Then: редирект на /admin', async () => {
      await expect(page).toHaveURL('/admin')
    })

    await test.step('And: cookie установлена с httpOnly, secure, sameSite=strict, TTL 7 дней', async () => {
      const cookies = await page.context().cookies()
      const session = cookies.find(c => c.name === 'session')
      expect(session).toBeDefined()
      expect(session?.httpOnly).toBe(true)
      expect(session?.secure).toBe(true)
      expect(session?.sameSite).toBe('Strict')
      // 7 days in seconds ≈ 604800
      expect(session?.expires).toBeGreaterThan(Date.now() / 1000 + 604700)
    })
  })

  // Scenario 1.2
  test('1.2 — Неверный пароль', async ({ page }) => {
    await test.step('Given: пользователь открывает /admin/login', async () => {
      await page.goto('/admin/login')
    })

    await test.step('When: вводит неверный пароль и нажимает "Войти"', async () => {
      await page.getByRole('textbox', { name: /пароль/i }).fill('wrong-password')
      await page.getByRole('button', { name: /войти/i }).click()
    })

    await test.step('Then: отображается сообщение "Неверный пароль"', async () => {
      await expect(page.getByText(/неверный пароль/i)).toBeVisible()
    })

    await test.step('And: cookie не устанавливается', async () => {
      const cookies = await page.context().cookies()
      expect(cookies.find(c => c.name === 'session')).toBeUndefined()
    })

    await test.step('And: пользователь остаётся на /admin/login', async () => {
      await expect(page).toHaveURL('/admin/login')
    })

    await test.step('And: поле пароля не очищается', async () => {
      await expect(page.getByRole('textbox', { name: /пароль/i })).toHaveValue('wrong-password')
    })

    await test.step('And: сообщение об ошибке не уточняет что именно неверно', async () => {
      const errorText = await page.getByText(/неверный пароль/i).innerText()
      expect(errorText).not.toMatch(/пользователь|логин|email|имя|не найден|не существует/i)
    })
  })

  // Scenario 1.3
  test('1.3 — Доступ к защищённому роуту без сессии', async ({ page }) => {
    for (const path of ['/admin', '/admin/testimonies', '/admin/testimonies/some-id']) {
      await test.step(`Given: нет session cookie; When: переход на ${path}`, async () => {
        await page.goto(path)
      })

      await test.step(`Then: редирект на /admin/login (для ${path})`, async () => {
        await expect(page).toHaveURL('/admin/login')
      })
    }
  })

  // Scenario 1.4
  test('1.4 — Истечение сессии', async ({ page }) => {
    await test.step('Given: установлена истёкшая session cookie', async () => {
      await page.context().addCookies([{
        name: 'session',
        value: 'expired-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        expires: Math.floor(Date.now() / 1000) - 1, // уже истекла
      }])
    })

    await test.step('When: пользователь переходит на /admin', async () => {
      await page.goto('/admin')
    })

    await test.step('Then: редирект на /admin/login', async () => {
      await expect(page).toHaveURL('/admin/login')
    })
  })

  // Scenario 1.5 — deferred
  test.skip('1.5 — Выход из системы [deferred: не в MVP]', async () => {
    // Явная кнопка logout и роут /admin/logout не реализуются в MVP.
    // Сессия истекает автоматически через 7 дней.
  })

})
