# PRD: Admin Panel — Testimony Review Portal

**Date:** 2026-06-26  
**Status:** Draft  
**Связан с:** `2026-06-25-telegram-testimony-bot-prd.md`  
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
| Уведомления | Email (Resend) + Telegram-бот |
| Архитектура | Clean Architecture (Domain / Application / Infrastructure / Presentation) |

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
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
});
```

### `notifications` — лог уведомлений
```ts
export const notifications = pgTable('notifications', {
  id:          uuid('id').primaryKey().defaultRandom(),
  type:        text('type').notNull(), // 'new_testimony'
  testimonyId: uuid('testimony_id').references(() => testimonies.id),
  channel:     text('channel').notNull(), // 'email' | 'telegram'
  sentAt:      timestamp('sent_at').defaultNow(),
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

## Архитектура (Clean Architecture)

```
src/
├── domain/                    # Чистые сущности, без зависимостей
│   ├── entities/
│   │   ├── Testimony.ts       # Testimony + TestimonyReview
│   │   ├── AdminUser.ts
│   │   └── BotUser.ts
│   └── repositories/          # Интерфейсы (порты)
│       ├── ITestimonyRepository.ts
│       ├── IAdminUserRepository.ts
│       └── INotificationService.ts
│
├── application/               # Use cases — бизнес-логика
│   ├── testimony/
│   │   ├── GetTestimoniesUseCase.ts
│   │   ├── GetTestimonyDetailUseCase.ts
│   │   ├── GenerateAiSummaryUseCase.ts
│   │   └── PublishTestimonyUseCase.ts
│   └── admin/
│       ├── InviteAdminUserUseCase.ts
│       └── UpdateAdminUserUseCase.ts
│
├── infrastructure/            # Реализации (адаптеры)
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema (все таблицы)
│   │   ├── client.ts          # Neon + Drizzle client
│   │   └── repositories/
│   │       ├── DrizzleTestimonyRepository.ts
│   │       └── DrizzleAdminUserRepository.ts
│   ├── ai/
│   │   └── OpenAiSummaryService.ts
│   └── notifications/
│       ├── ResendEmailService.ts
│       └── TelegramNotifyService.ts
│
└── presentation/              # Next.js App Router
    ├── app/
    │   ├── (auth)/
    │   │   └── login/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx
    │       ├── page.tsx                        # Dashboard
    │       ├── testimonies/
    │       │   ├── page.tsx                    # Список свидетельств
    │       │   └── [id]/page.tsx               # Детальная страница
    │       └── users/
    │           └── page.tsx                    # Управление (только admin)
    ├── components/
    └── api/
        └── route handlers (Next.js API routes)
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

---

### Dashboard

**US-2: Обзор новых свидетельств**  
Как редактор, я хочу видеть на главной странице все новые свидетельства, чтобы сразу понимать объём работы.

- Dashboard показывает счётчики: `new`, `summarized`, `published`
- Выделяет красным/оранжевым количество `new` (непрочитанных)
- Таблица последних 20 свидетельств со статусом
- Каждая строка: имя пользователя Telegram (или ID), язык, дата завершения, статус

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
- Если summary уже есть — показывается; кнопка "Regenerate"

**US-6: Редактирование и публикация**  
Как редактор, я хочу написать финальную версию свидетельства и опубликовать её, чтобы свидетельство стало готово к использованию.

- Textarea с `editedVersion` (pre-filled из AI summary если есть, иначе пусто)
- Кнопка "Save draft" — сохраняет без смены статуса
- Кнопка "Publish" — сохраняет + статус → `published` + фиксирует `publishedBy` и `publishedAt`
- После публикации поля становятся read-only (редактор видит кто и когда опубликовал)

---


### Уведомления

**US-9: Оповещение о новом свидетельстве**  
Как редактор, я хочу получать уведомление когда приходит новое завершённое свидетельство, чтобы не пропустить работу.

- Триггер: бот меняет `testimonies.status = 'finished'`
- Система создаёт запись в `testimony_reviews` со статусом `new`
- Все активные `admin_users` получают уведомление:
  - **Email** (Resend): тема "Новое свидетельство #ID", ссылка на детальную страницу
  - **Telegram** (если указан `telegramId`): короткое сообщение от бота с кнопкой-ссылкой на страницу
- Уведомление логируется в `notifications`

**Как триггер попадает в admin-систему:**  
Бот вызывает `finishTestimony()` → дополнительно вставляет запись в `testimony_reviews` и вызывает webhook или напрямую pub/sub. Простейший вариант MVP: Next.js API route `POST /api/webhooks/testimony-finished` вызывается из бота после завершения свидетельства.

---

## Страницы и навигация

```
/admin/login                    — вход (публичная)
/admin                          — Dashboard
/admin/testimonies              — список всех свидетельств
/admin/testimonies/[id]         — детальная страница
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
| `RESEND_API_KEY` | Отправка email-уведомлений | Деплоер (свой Resend ключ) |
| `TELEGRAM_BOT_TOKEN` | Отправка Telegram-уведомлений | Деплоер (токен своего бота) |
| `WEBHOOK_SECRET` | Аутентификация вебхука от бота | Деплоер (любая случайная строка) |

### Правила

- **Никаких ключей в коде.** Ни в `src/`, ни в конфигах, ни в комментариях.
- **`.env` только локально.** Файл всегда в `.gitignore`. В репозиторий не попадает никогда.
- **`.env.example` в репозитории.** Содержит все переменные с пустыми значениями и описанием — для онбординга новых деплоеров.
- **Выбор LLM настраивается.** Если задан `ANTHROPIC_API_KEY` — используется Claude; если только `OPENAI_API_KEY` — GPT-4o. Код обязан поддерживать оба варианта.

---

## Что НЕ входит в MVP

- Экспорт свидетельств в PDF/Word
- Комментарии редакторов друг другу
- История изменений `editedVersion`
- Поиск по тексту чанков
- Публичная страница опубликованных свидетельств
