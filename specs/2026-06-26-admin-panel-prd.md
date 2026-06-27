# PRD: Admin Panel — Testimony Review Portal

**Date:** 2026-06-26  
**Status:** Draft  
**Связан с:** `2026-06-26-user-scenarios.md`  
**URL:** `https://shortest-prayer-portal.vercel.app`

---

## Что это

Веб-приложение для команды редакторов — просмотр, обработка и публикация свидетельств, собранных Telegram-ботом [`simple-prayer-bot`](../../../simple-prayer-bot) (`/Users/berdyshevo/Documents/MyProjects/simple-prayer-bot`).

**Бот** принимает свидетельства от пользователей в Telegram: пользователь запускает `/new`, отправляет текстовые или голосовые сообщения (голос транскрибируется через Deepgram), каждое сообщение сохраняется как отдельный `chunk`. Когда пользователь завершает сессию — свидетельство получает статус `finished`. Бот работает на Railway, база — Neon PostgreSQL.

**Эта панель** — следующий шаг: редакторы видят все завершённые свидетельства в виде сырых чанков, запускают AI-суммаризацию и создают финальную отредактированную версию для публикации.

---

## Технологический стек

| Компонент | Решение |
|---|---|
| Framework | Next.js 15 (App Router) |
| Hosting | Vercel |
| База данных | Neon (PostgreSQL) — та же что у бота |
| ORM | Drizzle ORM |
| Стили | Tailwind CSS |
| Auth | Простой пароль из env (`ADMIN_PANEL_PASSWORD`) + httpOnly cookie |
| AI Summary | OpenAI GPT-4o |
| Архитектура | Pragmatic Clean Architecture (Domain / Application / Infrastructure / Presentation) |

**Почему Vercel, не Railway:** Admin panel — Next.js SSR/SSG, идеально ложится на Vercel. Бот продолжает работать на Railway. Они разделены; общий ресурс — база Neon.

---

## Аутентификация

Панель живёт целиком под `/admin`. Единственная защита — общий пароль.

- `/admin/login` — публичная страница: одно поле пароля (без имени пользователя)
- Введённый пароль сравнивается с `ADMIN_PANEL_PASSWORD` из env
- При совпадении — ставится httpOnly cookie с сессионным токеном, редирект на `/admin`
- Все роуты `/admin/*` кроме `/admin/login` защищены middleware — без валидной cookie → редирект на `/admin/login`
- Нет ролей, нет таблицы пользователей, нет NextAuth

> **Это MVP-аутентификация.** Одна команда, один пароль. Усложним позже при необходимости.

---

## Схема базы данных (Drizzle)

### Существующие таблицы (бот) — только чтение, не трогать

> Эти таблицы уже созданы в Neon и используются ботом в проде. Никаких ALTER TABLE, никаких новых колонок, никаких изменений. Admin panel только читает из них.

```sql
CREATE TABLE IF NOT EXISTS users (
  telegram_id BIGINT PRIMARY KEY,
  language    TEXT NOT NULL CHECK (language IN ('en', 'uk', 'ru')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS testimonies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL REFERENCES users(telegram_id),
  status      TEXT NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started', 'in_progress', 'finished')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  testimony_id UUID NOT NULL REFERENCES testimonies(id),
  text         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### Новые таблицы (admin panel, Drizzle миграция)

> Добавляются через отдельную миграцию — не затрагивают существующие таблицы. `admin_users` не нужна — аутентификация через `ADMIN_PANEL_PASSWORD`.

### `testimony_reviews` — статус обработки свидетельства в админке
```ts
export const testimonyReviews = pgTable('testimony_reviews', {
  id:            uuid('id').primaryKey().defaultRandom(),
  testimonyId:   uuid('testimony_id').notNull().references(() => testimonies.id).unique(),
  status:        text('status').notNull().default('new'), // 'new' | 'summarized' | 'published'
  aiSummary:     text('ai_summary'),
  editedVersion: text('edited_version'),
  summarizedAt:  timestamp('summarized_at'),
  publishedAt:   timestamp('published_at'),
  publishedBy:   text('published_by'), // логин редактора; сейчас всегда 'admin'
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
});
```


---

## Состояния свидетельства в админке

Статус хранится в `testimony_reviews.status`. Независим от `testimonies.status` (бот использует `in_progress` / `finished`).

```
new ──────────────────► summarized ──────────────────► published
  │                          │
  │   (AI summary готов      │   (редактор проверил,
  │    или создан вручную)   │    написал финал)
  │                          │
  └── (редактор может        └── (только после
       пропустить summary         наличия editedVersion)
       и сразу редактировать)
```

| Статус | Описание | Переход |
|---|---|---|
| `new` | Свидетельство завершено ботом, ещё не обработано | → `summarized` при генерации AI summary |
| `summarized` | AI summary готов, ждёт редактора | → `published` после сохранения editedVersion |
| `published` | Финальная версия готова | Терминальный статус |

**Важно:** переход `new → summarized` может быть пропущен — редактор может сразу написать `editedVersion` и опубликовать.

---

## Архитектура (Pragmatic Clean Architecture)

Следуем принципам Clean Architecture, но без догматизма. Правило простое: **слой не создаётся ради слоя**. Если абстракция не даёт реальной пользы — не пишем её.

**Что это значит на практике:**
- Интерфейс репозитория (`ITestimonyRepository`) нужен, потому что изолирует бизнес-логику от Drizzle
- Но отдельный Use Case для простой выборки без логики — лишний; можно вызвать репозиторий напрямую из Server Component
- Entities — простые TypeScript-типы, без методов и OOP-излишеств
- Нет маппера ради маппера: если Drizzle-тип совпадает с domain-типом — используем напрямую

### Правила изоляции между слоями

Зависимости идут **только внутрь** — от Presentation к Application к Infrastructure к Domain. Никогда в обратную сторону.

| Откуда | Может вызывать | Не может вызывать |
|---|---|---|
| `app/` (pages, API routes) | Use Cases, репозитории (для простых выборок) | Drizzle напрямую, OpenAI напрямую |
| Use Cases | Интерфейсы репозиториев (`ITestimonyRepository`) | Drizzle, Next.js, `fetch`, компоненты |
| Infrastructure (Drizzle, OpenAI) | Domain entities | Use Cases, pages, components |
| Domain (entities, интерфейсы) | Ничего | Любые внешние зависимости |

**Конкретные запреты:**
- API route / Server Component **не импортирует** `drizzle`, `db`, `openai` напрямую
- Use Case **не импортирует** ничего из `presentation/` или `next/`
- Infrastructure **не знает** о существовании страниц или роутов
- Если нужно передать данные вверх — через return value, не через импорт

```
src/
├── domain/                    # Чистые сущности, без зависимостей
│   ├── entities/
│   │   ├── Testimony.ts       # Testimony + TestimonyReview
│   │   └── BotUser.ts
│   └── repositories/          # Интерфейсы (порты)
│       └── ITestimonyRepository.ts
│
├── application/               # Use cases — бизнес-логика
│   └── testimony/
│       ├── GetTestimoniesUseCase.ts
│       ├── GetTestimonyDetailUseCase.ts
│       ├── GenerateAiSummaryUseCase.ts
│       └── PublishTestimonyUseCase.ts
│
├── infrastructure/            # Реализации (адаптеры)
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema (все таблицы)
│   │   ├── client.ts          # Neon + Drizzle client
│   │   └── repositories/
│   │       └── DrizzleTestimonyRepository.ts
│   └── ai/
│       └── OpenAiSummaryService.ts
│
└── presentation/              # Next.js App Router
    ├── app/
    │   ├── admin/
    │   │   ├── login/page.tsx
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                        # Dashboard
    │   │   └── testimonies/
    │   │       ├── page.tsx                    # Список свидетельств
    │   │       └── [id]/page.tsx               # Детальная страница
    │   └── api/
    │       └── webhooks/
    │           └── testimony-finished/route.ts # Публичный webhook от бота
    ├── components/
    └── middleware.ts                           # Auth guard для /admin/*
```

---

## User Stories

### Аутентификация

**US-1: Вход в систему**  
Как редактор, я хочу ввести пароль и попасть в панель.

- Форма: одно поле пароля
- При неверном пароле — сообщение "Неверный пароль"
- При успехе — httpOnly cookie, редирект на `/admin`
- Сессия живёт 7 дней; после истечения → редирект на `/admin/login`
- Выход из системы — `[deferred: не в MVP]` (сессия истекает автоматически через 7 дней)

---

### Dashboard

**US-2: Обзор новых свидетельств**  
Как редактор, я хочу видеть на главной странице все новые свидетельства, чтобы сразу понимать объём работы.

- Dashboard показывает счётчики: `new`, `summarized`, `published`
- Выделяет красным/оранжевым количество `new` (непрочитанных)
- Таблица последних 20 свидетельств со статусом
- Каждая строка: Telegram ID пользователя, язык, дата завершения, статус

---

### Список свидетельств

**US-3: Фильтрация и поиск**  
Как редактор, я хочу фильтровать свидетельства по статусу и дате, чтобы находить нужные быстро.

- Фильтр по статусу: `new` / `summarized` / `published` / all
- Сортировка по дате (новые сначала по умолчанию)
- Пагинация: 20 per page

---

### Детальная страница свидетельства

**US-4: Просмотр сырых чанков**  
Как редактор, я хочу видеть все сырые сообщения пользователя в хронологическом порядке, чтобы понять полный контекст свидетельства.

- Список чанков с порядковым номером и временной меткой
- Различие голос/текст не хранится (все чанки текстовые после транскрипции)

**US-5: AI Summary**  
Как редактор, я хочу одним кликом получить AI-суммаризацию свидетельства, чтобы быстро понять суть без чтения всех чанков.

- Кнопка "Generate Summary" (активна при статусе `new`)
- После клика — spinner, затем текст summary
- Summary генерируется из всех чанков + язык пользователя
- Статус меняется на `summarized`
- При статусе `summarized` — summary показывается; вместо "Generate Summary" отображается кнопка "Regenerate" (генерирует заново, перезаписывает, статус остаётся `summarized`)

**US-6: Редактирование и публикация**  
Как редактор, я хочу написать финальную версию свидетельства и опубликовать её, чтобы свидетельство стало готово к использованию.

- Textarea с `editedVersion` (pre-filled из AI summary если есть, иначе пусто)
- Кнопка "Save draft" — сохраняет без смены статуса
- Кнопка "Publish" — сохраняет + статус → `published` + фиксирует `publishedBy` (строка "admin") и `publishedAt`
- После публикации поля становятся read-only (видно когда опубликовано)

---


### Webhook от бота

**US-9: Создание записи review при завершении свидетельства**

- Бот после `testimonies.status = 'finished'` вызывает `POST /api/webhooks/testimony-finished`
- Тело запроса: `{ "testimonyId": "<uuid>" }`
- Заголовок: `X-Webhook-Secret: <WEBHOOK_SECRET>`
- Admin panel создаёт запись в `testimony_reviews` со статусом `new`
- Endpoint публичный (вне `/admin/*`), защищён только `WEBHOOK_SECRET`

---

### BYOK — Bring Your Own Key для AI провайдеров

**US-10: Настройка API ключей через интерфейс администратора**

Как администратор, я хочу иметь возможность ввести API ключ AI-провайдера через веб-интерфейс, чтобы AI-суммаризация работала на проде (Vercel) без необходимости добавлять секреты напрямую в настройки хостинга.

**Проблема:** На Vercel env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) могут отсутствовать. Вместо полного отказа AI-суммаризации — предоставить UI для ввода ключей с сохранением в БД.

**Приоритет источника ключа (от высшего к низшему):**
1. Env var (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) — всегда имеет приоритет
2. Ключ из таблицы `api_keys` в БД
3. Если нигде нет — вернуть понятную ошибку с ссылкой на `/admin/settings`

**Acceptance Criteria:**
- [ ] `/admin/settings` — страница доступна для авторизованного admin (защищена тем же middleware)
- [ ] Форма на странице позволяет ввести Anthropic API ключ и/или OpenAI API ключ
- [ ] После сохранения ключ хранится в таблице `api_keys` (без шифрования в MVP, поле `key_value text`)
- [ ] AI-суммаризация проверяет: сначала env var → затем `api_keys` в БД → затем ошибка
- [ ] Если ключа нет нигде — API `/api/admin/testimonies/[id]/summarize` возвращает 422 с телом `{ "error": "no_api_key", "settingsUrl": "/admin/settings" }`
- [ ] UI AiSummaryPanel при получении `no_api_key` показывает сообщение: "API ключ не настроен. [Перейти в настройки](/admin/settings)"
- [ ] Сохранённый в БД ключ показывается в форме в замаскированном виде (`sk-ant-...****`)
- [ ] Удаление ключа из БД через кнопку "Удалить ключ"
- [ ] Страница `/admin/settings` добавляется в навигацию (`AdminLayout`)

**DB Schema — новая таблица `api_keys`:**

```sql
CREATE TABLE api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai')),
  key_value  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider)
);
```

Drizzle-определение:
```typescript
export const apiKeys = pgTable('api_keys', {
  id:        uuid('id').primaryKey().defaultRandom(),
  provider:  text('provider').notNull(),  // 'anthropic' | 'openai'
  keyValue:  text('key_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
```

**Новые API routes:**
- `GET  /api/admin/settings/api-keys` — список ключей (только провайдер + маска, не полный ключ)
- `PUT  /api/admin/settings/api-keys` — сохранить/перезаписать ключ `{ provider, keyValue }`
- `DELETE /api/admin/settings/api-keys?provider=anthropic` — удалить ключ

**Новые страницы/компоненты:**
- `src/app/admin/settings/page.tsx` — страница настроек
- `src/components/ApiKeyForm.tsx` — форма ввода ключей
- `src/infrastructure/db/repositories/IApiKeyRepository.ts` + `DrizzleApiKeyRepository.ts`

---

## Страницы и навигация

```
/admin/login                    — вход (публичная)
/admin                          — Dashboard
/admin/testimonies              — список всех свидетельств
/admin/testimonies/[id]         — детальная страница
/admin/settings                 — настройки (API ключи для AI)
```

---

## Нефункциональные требования

- **Auth guard:** все роуты `/admin/*` кроме `/admin/login` защищены middleware. Неавторизованный → редирект на `/admin/login`.
- **Optimistic UI:** кнопки блокируются во время запроса, показывают spinner.
- **Error boundaries:** ошибки AI / DB показывают toast, не ломают страницу.
- **Mobile:** не приоритет MVP, но layout не должен ломаться на планшете.

---

## BYOK — Bring Your Own Keys

Проект не содержит и никогда не должен содержать захардкоженные API-ключи. Все секреты передаются через переменные окружения. Деплоер обязан предоставить собственные ключи в Vercel → Settings → Environment Variables.

### Обязательные переменные окружения

| Переменная | Назначение | Кто предоставляет |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Деплоер (свой Neon проект) |
| `ADMIN_PANEL_PASSWORD` | Единственный пароль доступа к панели | Деплоер (любая строка) |
| `SESSION_SECRET` | Подпись httpOnly cookie сессии | Деплоер (`openssl rand -base64 32`) |
| `OPENAI_API_KEY` | GPT-4o для AI-суммаризации | Деплоер (свой OpenAI ключ) |
| `ANTHROPIC_API_KEY` | Claude как альтернативный LLM (опционально) | Деплоер (свой Anthropic ключ) |
| `WEBHOOK_SECRET` | Аутентификация вебхука от бота | Деплоер (любая случайная строка) |

### Правила

- **Никаких ключей в коде.** Ни в `src/`, ни в конфигах, ни в комментариях.
- **`.env` только локально.** Файл всегда в `.gitignore`. В репозиторий не попадает никогда.
- **`.env.example` в репозитории.** Содержит все переменные с пустыми значениями и описанием — для онбординга новых деплоеров.
- **Выбор LLM настраивается.** Если задан `ANTHROPIC_API_KEY` — используется Claude; если только `OPENAI_API_KEY` — GPT-4o. Код обязан поддерживать оба варианта.

---

## E2E тесты (Playwright)

Тесты находятся в `tests/e2e/` и написаны в стиле BDD (Given / When / Then через `test.step()`).

**При создании Next.js приложения** создай файл `.env.test` (он в `.gitignore`, в репозиторий не попадает) и заполни его UUID реальных записей из тестовой БД:

| Переменная | Назначение |
|---|---|
| `BASE_URL` | URL dev-сервера (по умолчанию `http://localhost:3000`) |
| `TEST_ADMIN_PASSWORD` | Значение `ADMIN_PANEL_PASSWORD` для тестового окружения |
| `WEBHOOK_SECRET` | Значение `WEBHOOK_SECRET` для тестового окружения |
| `TEST_TESTIMONY_ID` | UUID любого свидетельства в тестовой БД |
| `TEST_NEW_TESTIMONY_ID` | UUID свидетельства со статусом `new` |
| `TEST_SUMMARIZED_TESTIMONY_ID` | UUID свидетельства со статусом `summarized` (для черновика и проверки пустого поля) |
| `TEST_FOR_PUBLISH_TESTIMONY_ID` | UUID свидетельства со статусом `summarized` (будет опубликовано в тесте 6.2 — отдельный от выше) |
| `TEST_FRESH_SUMMARIZED_TESTIMONY_ID` | UUID свидетельства со статусом `summarized` и `edited_version = NULL` (для теста pre-fill 6.3) |
| `TEST_PUBLISHED_TESTIMONY_ID` | UUID свидетельства со статусом `published` |

> Шаблон: `.env.test.example` в корне проекта. Каждый тест, который меняет состояние БД, использует отдельный UUID чтобы избежать конфликтов при параллельном запуске.

Запуск тестов: `npx playwright test`

---

## Что НЕ входит в MVP

- Уведомления (email и Telegram) при новом свидетельстве
- Управление пользователями (invite, роли, деактивация)
- Экспорт свидетельств в PDF/Word
- Комментарии редакторов друг другу
- История изменений `editedVersion`
- Поиск по тексту чанков
- Публичная страница опубликованных свидетельств
