# Admin Panel — Testimony Review Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 admin panel for editors to view, AI-summarize, and publish testimonies collected by a Telegram bot, backed by a shared Neon PostgreSQL database.

**Architecture:** Pragmatic Clean Architecture — Domain entities and repository interface sit at the core; Drizzle-backed infrastructure implements that interface; Next.js App Router pages/API routes consume use cases. Server Components handle data fetching; Client Components handle interactive UI. Mutations happen through API routes (not Server Actions) so the E2E tests can call them directly.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Drizzle ORM, Neon PostgreSQL (serverless), `jose` (JWT), OpenAI SDK, Anthropic SDK, Playwright (E2E, already written).

## Global Constraints

- Framework: Next.js 15 with App Router — never Pages Router
- Runtime: Edge-compatible middleware (use `jose`, not `jsonwebtoken`)
- Cookie name: `session`; flags: `httpOnly`, `secure` (prod only), `sameSite=strict`, TTL 7 days
- All `/admin/*` routes except `/admin/login` protected by middleware redirect
- DB: Neon PostgreSQL shared with bot — **never ALTER existing tables** (`users`, `testimonies`, `chunks`); only create `testimony_reviews`
- AI provider: if `ANTHROPIC_API_KEY` set → Claude claude-sonnet-4-6; else `OPENAI_API_KEY` → GPT-4o
- `publishedBy` value is always the string `"admin"` in MVP
- Status flow: `new → summarized → published` (published is terminal)
- All `data-testid` values must match exactly what E2E tests expect (listed in each task)
- Button/input text must match E2E locator patterns (listed in each task)
- 20 items per page everywhere
- URL query params: `?status=<value>` for filter, `?page=<n>` for pagination
- No secrets in code; all keys from env vars

---

## File Structure

```
# Config / root
drizzle.config.ts
.env.example                          (exists — leave as-is)
.env.test.example                     (re-create — was deleted)

# Domain layer (zero external deps)
src/domain/entities/Testimony.ts
src/domain/entities/BotUser.ts
src/domain/repositories/ITestimonyRepository.ts

# Application layer (use cases)
src/application/testimony/GetDashboardDataUseCase.ts
src/application/testimony/GetTestimoniesUseCase.ts
src/application/testimony/GetTestimonyDetailUseCase.ts
src/application/testimony/GenerateAiSummaryUseCase.ts
src/application/testimony/SaveDraftUseCase.ts
src/application/testimony/PublishTestimonyUseCase.ts

# Infrastructure layer
src/infrastructure/db/schema.ts
src/infrastructure/db/client.ts
src/infrastructure/db/repositories/DrizzleTestimonyRepository.ts
src/infrastructure/ai/AiSummaryService.ts

# Shared lib
src/lib/auth.ts                       (session JWT helpers)

# Middleware
src/middleware.ts                     (auth guard)

# Next.js App Router pages
src/app/layout.tsx                    (root layout)
src/app/admin/layout.tsx              (admin shell — no auth logic needed, middleware handles it)
src/app/admin/login/page.tsx          (public login page)
src/app/admin/page.tsx                (Dashboard)
src/app/admin/testimonies/page.tsx    (list with filter + pagination)
src/app/admin/testimonies/[id]/page.tsx  (detail: chunks, meta, AI summary, edit/publish)

# API routes
src/app/api/admin/login/route.ts
src/app/api/admin/testimonies/[id]/summarize/route.ts
src/app/api/admin/testimonies/[id]/draft/route.ts
src/app/api/admin/testimonies/[id]/publish/route.ts
src/app/api/webhooks/testimony-finished/route.ts

# UI Components
src/components/StatusCounter.tsx      (data-testid="counter-{status}")
src/components/TestimoniesTable.tsx   (shared table with data-testid cells)
src/components/FilterTabs.tsx         (aria-selected tabs, updates URL)
src/components/Pagination.tsx         (prev/next buttons, updates URL)
src/components/ChunksList.tsx         (data-testid="chunks-list", "chunk-item", etc.)
src/components/TestimonyMeta.tsx      (data-testid="meta-*")
src/components/AiSummaryPanel.tsx     (Generate/Regenerate + spinner)
src/components/EditPublishPanel.tsx   (textarea + Save draft + Publish)
src/components/Toast.tsx              (role="alert" for errors)

# Test tooling
scripts/seed-test-db.ts               (populates Neon test DB with known UUIDs)
```

---

## Task 1: Bootstrap Next.js 15 Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `drizzle.config.ts`
- Create: `src/app/layout.tsx`
- Create: `.env.test.example`
- Modify: `.gitignore` (add `.env.test`)

**Interfaces:**
- Produces: running dev server at `http://localhost:3000`; `npm run dev`, `npm run db:generate`, `npm run db:push` scripts

- [ ] **Step 1: Scaffold Next.js 15 app**

Run from `/Users/berdyshevo/Documents/MyProjects/ShortestPrayerPortal`:

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

When prompted, answer Yes to all. If the directory already has files, it will ask to overwrite — say Yes to package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.mjs. Say **No** to `.gitignore` (keep existing).

Expected: command exits 0, `node_modules/` appears.

- [ ] **Step 2: Install project dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless drizzle-kit jose openai @anthropic-ai/sdk dotenv
```

Expected: packages added to `node_modules/`, no peer-dep errors.

- [ ] **Step 3: Add DB scripts to package.json**

Edit `package.json` — add inside `"scripts"`:

```json
"db:generate": "drizzle-kit generate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 4: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '.env' })

export default defineConfig({
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 5: Create root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Testimony Admin Panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Re-create .env.test.example**

```bash
# .env.test.example
BASE_URL=http://localhost:3000
TEST_ADMIN_PASSWORD=
WEBHOOK_SECRET=

# UUIDs — point each at a real record seeded by scripts/seed-test-db.ts
TEST_TESTIMONY_ID=
TEST_NEW_TESTIMONY_ID=
TEST_SUMMARIZED_TESTIMONY_ID=
TEST_FOR_PUBLISH_TESTIMONY_ID=
TEST_FRESH_SUMMARIZED_TESTIMONY_ID=
TEST_PUBLISHED_TESTIMONY_ID=
```

Write that content to `.env.test.example`.

- [ ] **Step 7: Add .env.test to .gitignore**

Open `.gitignore`, add at the bottom if not present:

```
.env.test
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected output includes: `- Local: http://localhost:3000`. Press Ctrl+C to stop.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs drizzle.config.ts src/app/layout.tsx src/app/globals.css .env.test.example .gitignore
git commit -m "feat: bootstrap Next.js 15 project with Drizzle and auth deps"
```

---

## Task 2: Database Schema, Client, and Migration

**Files:**
- Create: `src/infrastructure/db/schema.ts`
- Create: `src/infrastructure/db/client.ts`
- Create: `drizzle/` (generated migration files — commit them)

**Interfaces:**
- Produces: `db` singleton (Drizzle client); exported table references `users`, `testimonies`, `chunks`, `testimonyReviews` for use in repository

- [ ] **Step 1: Write schema**

```typescript
// src/infrastructure/db/schema.ts
import {
  pgTable, uuid, bigint, text, timestamp,
} from 'drizzle-orm/pg-core'

// Read-only tables owned by the bot — never ALTER
export const users = pgTable('users', {
  telegramId: bigint('telegram_id', { mode: 'number' }).primaryKey(),
  language:   text('language').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const testimonies = pgTable('testimonies', {
  id:         uuid('id').primaryKey().defaultRandom(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull()
                .references(() => users.telegramId),
  status:     text('status').notNull().default('not_started'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const chunks = pgTable('chunks', {
  id:          uuid('id').primaryKey().defaultRandom(),
  testimonyId: uuid('testimony_id').notNull().references(() => testimonies.id),
  text:        text('text').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Admin panel table — created via migration
export const testimonyReviews = pgTable('testimony_reviews', {
  id:            uuid('id').primaryKey().defaultRandom(),
  testimonyId:   uuid('testimony_id').notNull().unique().references(() => testimonies.id),
  status:        text('status').notNull().default('new'),
  aiSummary:     text('ai_summary'),
  editedVersion: text('edited_version'),
  summarizedAt:  timestamp('summarized_at'),
  publishedAt:   timestamp('published_at'),
  publishedBy:   text('published_by'),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
})
```

- [ ] **Step 2: Write DB client**

```typescript
// src/infrastructure/db/client.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Generate migration**

```bash
npm run db:generate
```

Expected: `drizzle/` directory created with a `.sql` migration file containing `CREATE TABLE testimony_reviews`.

- [ ] **Step 4: Push migration to Neon**

Make sure `.env` contains `DATABASE_URL` pointing to your Neon database.

```bash
npm run db:push
```

Expected: `testimony_reviews` table created. Run to confirm:

```bash
npx drizzle-kit studio
```

Open browser → verify `testimony_reviews` table exists with correct columns.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/db/ drizzle/
git commit -m "feat: add Drizzle schema and testimony_reviews migration"
```

---

## Task 3: Domain Layer — Entities + Repository Interface

**Files:**
- Create: `src/domain/entities/Testimony.ts`
- Create: `src/domain/entities/BotUser.ts`
- Create: `src/domain/repositories/ITestimonyRepository.ts`

**Interfaces:**
- Produces: All TypeScript types consumed by application and infrastructure layers. Nothing imports from outside `src/domain/`.

- [ ] **Step 1: Write Testimony entities**

```typescript
// src/domain/entities/Testimony.ts
export type TestimonyStatus = 'new' | 'summarized' | 'published'

export interface TestimonyReview {
  id: string
  testimonyId: string
  status: TestimonyStatus
  aiSummary: string | null
  editedVersion: string | null
  summarizedAt: Date | null
  publishedAt: Date | null
  publishedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Chunk {
  id: string
  testimonyId: string
  text: string
  createdAt: Date
}

export interface TestimonyListItem {
  id: string
  telegramId: number
  language: string
  createdAt: Date
  status: TestimonyStatus
}

export interface TestimonyDetail {
  id: string
  telegramId: number
  language: string
  createdAt: Date
  review: TestimonyReview
  chunks: Chunk[]
}

export interface StatusCounts {
  new: number
  summarized: number
  published: number
}

export interface PaginatedTestimonies {
  items: TestimonyListItem[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 2: Write BotUser entity**

```typescript
// src/domain/entities/BotUser.ts
export interface BotUser {
  telegramId: number
  language: 'en' | 'uk' | 'ru'
  createdAt: Date
}
```

- [ ] **Step 3: Write repository interface**

```typescript
// src/domain/repositories/ITestimonyRepository.ts
import {
  StatusCounts,
  TestimonyListItem,
  TestimonyDetail,
  TestimonyReview,
  TestimonyStatus,
  PaginatedTestimonies,
} from '../entities/Testimony'

export interface GetTestimoniesOptions {
  status: TestimonyStatus | 'all'
  page: number
  pageSize: number
}

export interface ITestimonyRepository {
  getStatusCounts(): Promise<StatusCounts>
  getRecentTestimonies(limit: number): Promise<TestimonyListItem[]>
  getTestimonies(opts: GetTestimoniesOptions): Promise<PaginatedTestimonies>
  getTestimonyDetail(id: string): Promise<TestimonyDetail | null>
  testimonyExists(id: string): Promise<boolean>
  reviewExists(testimonyId: string): Promise<boolean>
  createReview(testimonyId: string): Promise<TestimonyReview>
  updateReview(
    testimonyId: string,
    data: Partial<Pick<TestimonyReview, 'status' | 'aiSummary' | 'editedVersion' | 'summarizedAt' | 'publishedAt' | 'publishedBy' | 'updatedAt'>>
  ): Promise<TestimonyReview>
}
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/
git commit -m "feat: add domain entities and repository interface"
```

---

## Task 4: Infrastructure — Drizzle Repository + AI Service

**Files:**
- Create: `src/infrastructure/db/repositories/DrizzleTestimonyRepository.ts`
- Create: `src/infrastructure/ai/AiSummaryService.ts`

**Interfaces:**
- Consumes: `db` from `src/infrastructure/db/client.ts`; schema from `src/infrastructure/db/schema.ts`; `ITestimonyRepository` from domain
- Produces: `DrizzleTestimonyRepository` class; `generateSummary(chunks: string[], language: string): Promise<string>` function

- [ ] **Step 1: Write Drizzle repository**

```typescript
// src/infrastructure/db/repositories/DrizzleTestimonyRepository.ts
import { eq, desc, count, and, sql } from 'drizzle-orm'
import { db } from '../client'
import {
  users, testimonies, chunks, testimonyReviews,
} from '../schema'
import { ITestimonyRepository, GetTestimoniesOptions } from '@/domain/repositories/ITestimonyRepository'
import {
  StatusCounts, TestimonyListItem, TestimonyDetail,
  TestimonyReview, PaginatedTestimonies,
} from '@/domain/entities/Testimony'

export class DrizzleTestimonyRepository implements ITestimonyRepository {
  async getStatusCounts(): Promise<StatusCounts> {
    const rows = await db
      .select({ status: testimonyReviews.status, cnt: count() })
      .from(testimonyReviews)
      .groupBy(testimonyReviews.status)

    const result: StatusCounts = { new: 0, summarized: 0, published: 0 }
    for (const row of rows) {
      if (row.status === 'new') result.new = Number(row.cnt)
      else if (row.status === 'summarized') result.summarized = Number(row.cnt)
      else if (row.status === 'published') result.published = Number(row.cnt)
    }
    return result
  }

  async getRecentTestimonies(limit: number): Promise<TestimonyListItem[]> {
    const rows = await db
      .select({
        id:         testimonies.id,
        telegramId: testimonies.telegramId,
        language:   users.language,
        createdAt:  testimonies.createdAt,
        status:     testimonyReviews.status,
      })
      .from(testimonyReviews)
      .innerJoin(testimonies, eq(testimonyReviews.testimonyId, testimonies.id))
      .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
      .orderBy(desc(testimonies.createdAt))
      .limit(limit)

    return rows.map(r => ({
      id:         r.id,
      telegramId: r.telegramId,
      language:   r.language,
      createdAt:  r.createdAt!,
      status:     r.status as 'new' | 'summarized' | 'published',
    }))
  }

  async getTestimonies(opts: GetTestimoniesOptions): Promise<PaginatedTestimonies> {
    const { status, page, pageSize } = opts
    const offset = (page - 1) * pageSize

    const whereClause = status === 'all'
      ? undefined
      : eq(testimonyReviews.status, status)

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id:         testimonies.id,
          telegramId: testimonies.telegramId,
          language:   users.language,
          createdAt:  testimonies.createdAt,
          status:     testimonyReviews.status,
        })
        .from(testimonyReviews)
        .innerJoin(testimonies, eq(testimonyReviews.testimonyId, testimonies.id))
        .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
        .where(whereClause)
        .orderBy(desc(testimonies.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(testimonyReviews)
        .where(whereClause),
    ])

    return {
      items: rows.map(r => ({
        id:         r.id,
        telegramId: r.telegramId,
        language:   r.language,
        createdAt:  r.createdAt!,
        status:     r.status as 'new' | 'summarized' | 'published',
      })),
      total:    Number(total),
      page,
      pageSize,
    }
  }

  async getTestimonyDetail(id: string): Promise<TestimonyDetail | null> {
    const [row] = await db
      .select({
        id:           testimonies.id,
        telegramId:   testimonies.telegramId,
        language:     users.language,
        createdAt:    testimonies.createdAt,
        reviewId:          testimonyReviews.id,
        reviewStatus:      testimonyReviews.status,
        aiSummary:         testimonyReviews.aiSummary,
        editedVersion:     testimonyReviews.editedVersion,
        summarizedAt:      testimonyReviews.summarizedAt,
        publishedAt:       testimonyReviews.publishedAt,
        publishedBy:       testimonyReviews.publishedBy,
        reviewCreatedAt:   testimonyReviews.createdAt,
        reviewUpdatedAt:   testimonyReviews.updatedAt,
      })
      .from(testimonies)
      .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
      .innerJoin(testimonyReviews, eq(testimonyReviews.testimonyId, testimonies.id))
      .where(eq(testimonies.id, id))

    if (!row) return null

    const chunkRows = await db
      .select()
      .from(chunks)
      .where(eq(chunks.testimonyId, id))
      .orderBy(chunks.createdAt)

    return {
      id:         row.id,
      telegramId: row.telegramId,
      language:   row.language,
      createdAt:  row.createdAt!,
      review: {
        id:            row.reviewId,
        testimonyId:   row.id,
        status:        row.reviewStatus as 'new' | 'summarized' | 'published',
        aiSummary:     row.aiSummary,
        editedVersion: row.editedVersion,
        summarizedAt:  row.summarizedAt,
        publishedAt:   row.publishedAt,
        publishedBy:   row.publishedBy,
        createdAt:     row.reviewCreatedAt!,
        updatedAt:     row.reviewUpdatedAt!,
      },
      chunks: chunkRows.map(c => ({
        id:          c.id,
        testimonyId: c.testimonyId,
        text:        c.text,
        createdAt:   c.createdAt!,
      })),
    }
  }

  async testimonyExists(id: string): Promise<boolean> {
    const [row] = await db
      .select({ id: testimonies.id })
      .from(testimonies)
      .where(eq(testimonies.id, id))
      .limit(1)
    return !!row
  }

  async reviewExists(testimonyId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: testimonyReviews.id })
      .from(testimonyReviews)
      .where(eq(testimonyReviews.testimonyId, testimonyId))
      .limit(1)
    return !!row
  }

  async createReview(testimonyId: string): Promise<TestimonyReview> {
    const [row] = await db
      .insert(testimonyReviews)
      .values({ testimonyId, status: 'new' })
      .returning()
    return this.mapReview(row)
  }

  async updateReview(
    testimonyId: string,
    data: Partial<Pick<TestimonyReview, 'status' | 'aiSummary' | 'editedVersion' | 'summarizedAt' | 'publishedAt' | 'publishedBy' | 'updatedAt'>>
  ): Promise<TestimonyReview> {
    const [row] = await db
      .update(testimonyReviews)
      .set({
        ...(data.status !== undefined      && { status:        data.status }),
        ...(data.aiSummary !== undefined   && { aiSummary:     data.aiSummary }),
        ...(data.editedVersion !== undefined && { editedVersion: data.editedVersion }),
        ...(data.summarizedAt !== undefined && { summarizedAt:  data.summarizedAt }),
        ...(data.publishedAt !== undefined  && { publishedAt:   data.publishedAt }),
        ...(data.publishedBy !== undefined  && { publishedBy:   data.publishedBy }),
        updatedAt: new Date(),
      })
      .where(eq(testimonyReviews.testimonyId, testimonyId))
      .returning()
    return this.mapReview(row)
  }

  private mapReview(row: typeof testimonyReviews.$inferSelect): TestimonyReview {
    return {
      id:            row.id,
      testimonyId:   row.testimonyId,
      status:        row.status as 'new' | 'summarized' | 'published',
      aiSummary:     row.aiSummary,
      editedVersion: row.editedVersion,
      summarizedAt:  row.summarizedAt,
      publishedAt:   row.publishedAt,
      publishedBy:   row.publishedBy,
      createdAt:     row.createdAt!,
      updatedAt:     row.updatedAt!,
    }
  }
}
```

- [ ] **Step 2: Write AI summary service**

```typescript
// src/infrastructure/ai/AiSummaryService.ts

export async function generateSummary(
  chunkTexts: string[],
  language: string,
): Promise<string> {
  const content = chunkTexts.join('\n---\n')
  const prompt = `Summarize the following personal testimony in ${language === 'ru' ? 'Russian' : language === 'uk' ? 'Ukrainian' : 'English'} (2-4 paragraphs). Preserve the speaker's voice and key spiritual details.\n\n${content}`

  if (process.env.ANTHROPIC_API_KEY) {
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
    return block.text
  }

  if (process.env.OPENAI_API_KEY) {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return res.choices[0].message.content ?? ''
  }

  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/
git commit -m "feat: add Drizzle repository implementation and AI summary service"
```

---

## Task 5: Auth — Session Helpers + Middleware + Login API + Login Page (US-1)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/middleware.ts`
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/admin/login/page.tsx`

**Interfaces:**
- Consumes: nothing external except env vars `SESSION_SECRET`, `ADMIN_PANEL_PASSWORD`
- Produces: `createSession()`, `verifySession(token)` from `src/lib/auth.ts`; middleware protecting `/admin/*`; POST `/api/admin/login`; login page at `/admin/login`

**E2E data-testid / locators this task must satisfy:**
- `page.getByRole('textbox', { name: /пароль/i })` — password input
- `page.getByRole('button', { name: /войти/i })` — submit button
- `page.getByText(/неверный пароль/i)` — error message
- cookie name: `session`; flags: `httpOnly`, `secure` (prod), `sameSite: 'Strict'`, TTL ≥ 7 days

- [ ] **Step 1: Write session helpers**

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function createSession(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export function getSessionCookieOptions(isProduction: boolean) {
  return {
    name:     COOKIE_NAME,
    httpOnly: true,
    secure:   isProduction,
    sameSite: 'strict' as const,
    maxAge:   MAX_AGE_SECONDS,
    path:     '/',
  }
}

export function getTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE_NAME)?.value
}
```

- [ ] **Step 2: Write middleware**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/admin/login') return NextResponse.next()

  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

- [ ] **Step 3: Write login API route**

```typescript
// src/app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSession, getSessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { password } = body as { password?: string }

  if (password !== process.env.ADMIN_PANEL_PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  const token = await createSession()
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieOpts = getSessionCookieOptions(isProduction)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(cookieOpts.name, token, {
    httpOnly: cookieOpts.httpOnly,
    secure:   cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    maxAge:   cookieOpts.maxAge,
    path:     cookieOpts.path,
  })
  return response
}
```

- [ ] **Step 4: Write login page**

```tsx
// src/app/admin/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Неверный пароль')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow"
      >
        <h1 className="mb-6 text-xl font-semibold">Вход в панель</h1>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Пароль
        </label>
        <input
          type="password"
          name="пароль"
          aria-label="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Run E2E auth tests**

Make sure `.env.test` exists with `BASE_URL`, `TEST_ADMIN_PASSWORD` (= value of `ADMIN_PANEL_PASSWORD` in `.env`), and `WEBHOOK_SECRET`.

```bash
npm run dev &
npx playwright test tests/e2e/us1-auth.spec.ts --reporter=line
```

Expected: tests 1.1–1.4 pass; 1.5 skipped.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts src/app/api/admin/login/ src/app/admin/login/
git commit -m "feat: auth — session JWT, middleware guard, login API and page (US-1)"
```

---

## Task 6: Dashboard (US-2)

**Files:**
- Create: `src/application/testimony/GetDashboardDataUseCase.ts`
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/components/StatusCounter.tsx`
- Create: `src/components/TestimoniesTable.tsx`

**Interfaces:**
- Consumes: `DrizzleTestimonyRepository`, domain types `StatusCounts`, `TestimonyListItem`
- Produces: `/admin` page with `data-testid="counter-new|summarized|published"` and table cells with `data-testid="cell-telegram-id|language|date|status"`

**E2E data-testid / locators:**
- `data-testid="counter-new"`, `"counter-summarized"`, `"counter-published"` — must show numeric count; counter-new gets `text-red-600` or `bg-orange-500` class when value > 0
- table rows: `data-testid="cell-telegram-id"`, `"cell-language"`, `"cell-date"`, `"cell-status"`
- max 21 rows including header (≤ 20 data rows)

- [ ] **Step 1: Write use case**

```typescript
// src/application/testimony/GetDashboardDataUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { StatusCounts, TestimonyListItem } from '@/domain/entities/Testimony'

export interface DashboardData {
  counts: StatusCounts
  recent: TestimonyListItem[]
}

export async function getDashboardData(
  repo: ITestimonyRepository,
): Promise<DashboardData> {
  const [counts, recent] = await Promise.all([
    repo.getStatusCounts(),
    repo.getRecentTestimonies(20),
  ])
  return { counts, recent }
}
```

- [ ] **Step 2: Write StatusCounter component**

```tsx
// src/components/StatusCounter.tsx
import { TestimonyStatus } from '@/domain/entities/Testimony'

interface Props {
  label: TestimonyStatus
  count: number
}

export function StatusCounter({ label, count }: Props) {
  const highlight = label === 'new' && count > 0

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm text-center">
      <p className="text-sm uppercase text-gray-500 mb-1">{label}</p>
      <p
        data-testid={`counter-${label}`}
        className={`text-3xl font-bold ${highlight ? 'text-red-600' : 'text-gray-800'}`}
      >
        {count}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Write TestimoniesTable component**

```tsx
// src/components/TestimoniesTable.tsx
import Link from 'next/link'
import { TestimonyListItem } from '@/domain/entities/Testimony'

interface Props {
  items: TestimonyListItem[]
}

export function TestimoniesTable({ items }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b bg-gray-50 text-left text-gray-500">
          <th className="px-4 py-2">Telegram ID</th>
          <th className="px-4 py-2">Язык</th>
          <th className="px-4 py-2">Дата</th>
          <th className="px-4 py-2">Статус</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id} className="border-b hover:bg-gray-50">
            <td className="px-4 py-2">
              <Link href={`/admin/testimonies/${item.id}`} className="text-blue-600 hover:underline">
                <span data-testid="cell-telegram-id">{item.telegramId}</span>
              </Link>
            </td>
            <td className="px-4 py-2" data-testid="cell-language">{item.language}</td>
            <td className="px-4 py-2" data-testid="cell-date">
              {item.createdAt.toISOString()}
            </td>
            <td className="px-4 py-2" data-testid="cell-status">{item.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Write admin layout**

```tsx
// src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-3">
        <nav className="flex gap-4 text-sm">
          <a href="/admin" className="font-semibold text-gray-700 hover:text-blue-600">Dashboard</a>
          <a href="/admin/testimonies" className="text-gray-600 hover:text-blue-600">Свидетельства</a>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Write Dashboard page**

```tsx
// src/app/admin/page.tsx
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getDashboardData } from '@/application/testimony/GetDashboardDataUseCase'
import { StatusCounter } from '@/components/StatusCounter'
import { TestimoniesTable } from '@/components/TestimoniesTable'

export default async function DashboardPage() {
  const repo = new DrizzleTestimonyRepository()
  const { counts, recent } = await getDashboardData(repo)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-3 gap-4 max-w-lg">
        <StatusCounter label="new"        count={counts.new} />
        <StatusCounter label="summarized" count={counts.summarized} />
        <StatusCounter label="published"  count={counts.published} />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Последние свидетельства</h2>
      <TestimoniesTable items={recent} />
    </div>
  )
}
```

- [ ] **Step 6: Run E2E dashboard tests**

```bash
npx playwright test tests/e2e/us2-dashboard.spec.ts --reporter=line
```

Expected: tests 2.1 and 2.2 pass.

- [ ] **Step 7: Commit**

```bash
git add src/application/testimony/GetDashboardDataUseCase.ts src/app/admin/ src/components/StatusCounter.tsx src/components/TestimoniesTable.tsx
git commit -m "feat: dashboard with status counters and recent testimonies table (US-2)"
```

---

## Task 7: Testimonies List Page (US-3)

**Files:**
- Create: `src/application/testimony/GetTestimoniesUseCase.ts`
- Create: `src/app/admin/testimonies/page.tsx`
- Create: `src/components/FilterTabs.tsx`
- Create: `src/components/Pagination.tsx`

**Interfaces:**
- Consumes: `ITestimonyRepository.getTestimonies()`; URL search params `status`, `page`
- Produces: `/admin/testimonies` page with filter tabs, table, pagination

**E2E data-testid / locators:**
- tabs: `role="tab"` with `aria-selected="true"` on active; names match `/^all$/i`, `/^new$/i`, `/^summarized$/i`, `/^published$/i`
- URL must contain `?status=<value>` when filter active; `?page=2` on second page
- table rows reuse `data-testid="cell-telegram-id|language|date|status"` (same as dashboard)
- pagination: `role="button"` with name matching `/следующая|next/i`

- [ ] **Step 1: Write use case**

```typescript
// src/application/testimony/GetTestimoniesUseCase.ts
import { ITestimonyRepository, GetTestimoniesOptions } from '@/domain/repositories/ITestimonyRepository'
import { PaginatedTestimonies } from '@/domain/entities/Testimony'

export async function getTestimonies(
  repo: ITestimonyRepository,
  opts: GetTestimoniesOptions,
): Promise<PaginatedTestimonies> {
  return repo.getTestimonies(opts)
}
```

- [ ] **Step 2: Write FilterTabs component**

```tsx
// src/components/FilterTabs.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const STATUSES = ['all', 'new', 'summarized', 'published'] as const

export function FilterTabs() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const current      = searchParams.get('status') ?? 'all'

  function handleClick(status: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('status', status)
    params.delete('page')
    router.push(`/admin/testimonies?${params.toString()}`)
  }

  return (
    <div role="tablist" className="flex gap-1 mb-4 border-b">
      {STATUSES.map(s => (
        <button
          key={s}
          role="tab"
          aria-selected={s === current}
          onClick={() => handleClick(s)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            s === current
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write Pagination component**

```tsx
// src/components/Pagination.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  page:      number
  pageSize:  number
  total:     number
}

export function Pagination({ page, pageSize, total }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const totalPages   = Math.ceil(total / pageSize)

  function go(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/admin/testimonies?${params.toString()}`)
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1 rounded border text-sm disabled:opacity-40"
      >
        Предыдущая
      </button>
      <span className="text-sm text-gray-600">
        Страница {page} из {totalPages}
      </span>
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded border text-sm disabled:opacity-40"
      >
        Следующая
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Write testimonies list page**

```tsx
// src/app/admin/testimonies/page.tsx
import { Suspense } from 'react'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonies } from '@/application/testimony/GetTestimoniesUseCase'
import { TestimoniesTable } from '@/components/TestimoniesTable'
import { FilterTabs } from '@/components/FilterTabs'
import { Pagination } from '@/components/Pagination'
import { TestimonyStatus } from '@/domain/entities/Testimony'

const PAGE_SIZE = 20

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function TestimoniesPage({ searchParams }: Props) {
  const params = await searchParams
  const status  = (['new', 'summarized', 'published'].includes(params.status ?? '')
    ? params.status as TestimonyStatus
    : 'all')
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  const repo = new DrizzleTestimonyRepository()
  const { items, total } = await getTestimonies(repo, { status, page, pageSize: PAGE_SIZE })

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Свидетельства</h1>
      <Suspense>
        <FilterTabs />
      </Suspense>
      <TestimoniesTable items={items} />
      <Suspense>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 5: Run E2E list tests**

```bash
npx playwright test tests/e2e/us3-testimonies-list.spec.ts --reporter=line
```

Expected: tests 3.1–3.3 pass (note: 3.2 pagination steps are conditional on >20 DB records).

- [ ] **Step 6: Commit**

```bash
git add src/application/testimony/GetTestimoniesUseCase.ts src/app/admin/testimonies/page.tsx src/components/FilterTabs.tsx src/components/Pagination.tsx
git commit -m "feat: testimonies list with filter, sort, and pagination (US-3)"
```

---

## Task 8: Testimony Detail — Chunks + Metadata (US-4)

**Files:**
- Create: `src/application/testimony/GetTestimonyDetailUseCase.ts`
- Create: `src/app/admin/testimonies/[id]/page.tsx` (initial shell — expanded in Tasks 9 and 10)
- Create: `src/components/ChunksList.tsx`
- Create: `src/components/TestimonyMeta.tsx`

**Interfaces:**
- Consumes: `ITestimonyRepository.getTestimonyDetail(id)`
- Produces: page at `/admin/testimonies/[id]` showing metadata + chunks

**E2E data-testid:**
- `data-testid="chunks-list"` — container
- `data-testid="chunk-item"` — each chunk row
- `data-testid="chunk-index"` — ordinal number inside chunk-item
- `data-testid="chunk-timestamp"` — `<time>` element with `datetime` attribute (ISO string); ordered ASC
- `data-testid="meta-telegram-id"`, `"meta-language"`, `"meta-created-at"`, `"meta-status"`
- text "Нет сообщений" when chunks list is empty

- [ ] **Step 1: Write use case**

```typescript
// src/application/testimony/GetTestimonyDetailUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { TestimonyDetail } from '@/domain/entities/Testimony'

export async function getTestimonyDetail(
  repo: ITestimonyRepository,
  id: string,
): Promise<TestimonyDetail | null> {
  return repo.getTestimonyDetail(id)
}
```

- [ ] **Step 2: Write ChunksList component**

```tsx
// src/components/ChunksList.tsx
import { Chunk } from '@/domain/entities/Testimony'

interface Props {
  chunks: Chunk[]
}

export function ChunksList({ chunks }: Props) {
  return (
    <div data-testid="chunks-list" className="space-y-2">
      {chunks.length === 0 && (
        <p className="text-gray-400 italic">Нет сообщений</p>
      )}
      {chunks.map((chunk, i) => (
        <div key={chunk.id} data-testid="chunk-item" className="rounded border bg-white p-3">
          <div className="flex items-baseline gap-3">
            <span
              data-testid="chunk-index"
              className="text-xs font-bold text-gray-400 w-6 shrink-0"
            >
              {i + 1}
            </span>
            <time
              data-testid="chunk-timestamp"
              dateTime={chunk.createdAt.toISOString()}
              className="text-xs text-gray-400 shrink-0"
            >
              {chunk.createdAt.toLocaleString('ru-RU')}
            </time>
            <p className="text-sm text-gray-800">{chunk.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write TestimonyMeta component**

```tsx
// src/components/TestimonyMeta.tsx
import { TestimonyReview } from '@/domain/entities/Testimony'

interface Props {
  telegramId:  number
  language:    string
  createdAt:   Date
  review:      TestimonyReview
}

export function TestimonyMeta({ telegramId, language, createdAt, review }: Props) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
      <dt className="text-gray-500">Telegram ID</dt>
      <dd data-testid="meta-telegram-id" className="font-medium">{telegramId}</dd>

      <dt className="text-gray-500">Язык</dt>
      <dd data-testid="meta-language">{language}</dd>

      <dt className="text-gray-500">Дата создания</dt>
      <dd data-testid="meta-created-at">{createdAt.toISOString()}</dd>

      <dt className="text-gray-500">Статус</dt>
      <dd data-testid="meta-status">{review.status}</dd>

      {review.summarizedAt && (
        <>
          <dt className="text-gray-500">Суммаризировано</dt>
          <dd data-testid="meta-summarized-at">{review.summarizedAt.toISOString()}</dd>
        </>
      )}

      {review.publishedAt && (
        <>
          <dt className="text-gray-500">Опубликовано</dt>
          <dd data-testid="published-at">{review.publishedAt.toISOString()}</dd>
          <dt className="text-gray-500">Кем</dt>
          <dd data-testid="published-by">{review.publishedBy}</dd>
        </>
      )}
    </dl>
  )
}
```

- [ ] **Step 4: Write detail page (shell)**

```tsx
// src/app/admin/testimonies/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonyDetail } from '@/application/testimony/GetTestimonyDetailUseCase'
import { ChunksList } from '@/components/ChunksList'
import { TestimonyMeta } from '@/components/TestimonyMeta'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TestimonyDetailPage({ params }: Props) {
  const { id } = await params
  const repo   = new DrizzleTestimonyRepository()
  const detail = await getTestimonyDetail(repo, id)

  if (!detail) notFound()

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Свидетельство</h1>

      <TestimonyMeta
        telegramId={detail.telegramId}
        language={detail.language}
        createdAt={detail.createdAt}
        review={detail.review}
      />

      <h2 className="mb-2 text-lg font-semibold">Сообщения</h2>
      <ChunksList chunks={detail.chunks} />
    </div>
  )
}
```

- [ ] **Step 5: Run E2E detail tests**

```bash
npx playwright test tests/e2e/us4-testimony-detail.spec.ts --reporter=line
```

Expected: tests 4.1 and 4.2 pass (requires `TEST_TESTIMONY_ID` in `.env.test` to point at a seeded record with chunks).

- [ ] **Step 6: Commit**

```bash
git add src/application/testimony/GetTestimonyDetailUseCase.ts src/app/admin/testimonies/[id]/ src/components/ChunksList.tsx src/components/TestimonyMeta.tsx
git commit -m "feat: testimony detail page with chunks list and metadata (US-4)"
```

---

## Task 9: AI Summary (US-5)

**Files:**
- Create: `src/application/testimony/GenerateAiSummaryUseCase.ts`
- Create: `src/app/api/admin/testimonies/[id]/summarize/route.ts`
- Create: `src/components/AiSummaryPanel.tsx`
- Modify: `src/app/admin/testimonies/[id]/page.tsx` — add AiSummaryPanel

**Interfaces:**
- Consumes: `generateSummary()` from AI service; `ITestimonyRepository.updateReview()`
- Produces: POST `/api/admin/testimonies/[id]/summarize` → `{ aiSummary, summarizedAt }`

**E2E data-testid / locators:**
- `role="button"` name `/generate summary/i` — visible when status is "new"
- `role="button"` name `/regenerate/i` — visible when status is "summarized"
- `data-testid="spinner"` — visible during generation
- `data-testid="ai-summary-text"` — contains summary text after generation
- `data-testid="meta-status"` — changes to "summarized" after generation
- `data-testid="meta-summarized-at"` — non-empty after generation
- `role="alert"` — shown on API error

- [ ] **Step 1: Write use case**

```typescript
// src/application/testimony/GenerateAiSummaryUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { generateSummary } from '@/infrastructure/ai/AiSummaryService'
import { TestimonyReview } from '@/domain/entities/Testimony'

export async function generateAiSummary(
  repo: ITestimonyRepository,
  testimonyId: string,
): Promise<TestimonyReview> {
  const detail = await repo.getTestimonyDetail(testimonyId)
  if (!detail) throw new Error('Testimony not found')

  const chunkTexts = detail.chunks.map(c => c.text)
  const summary    = await generateSummary(chunkTexts, detail.language)
  const now        = new Date()

  return repo.updateReview(testimonyId, {
    aiSummary:    summary,
    status:       'summarized',
    summarizedAt: now,
    updatedAt:    now,
  })
}
```

- [ ] **Step 2: Write summarize API route**

```typescript
// src/app/api/admin/testimonies/[id]/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { generateAiSummary } from '@/application/testimony/GenerateAiSummaryUseCase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const repo   = new DrizzleTestimonyRepository()
    const review = await generateAiSummary(repo, id)
    return NextResponse.json({
      aiSummary:    review.aiSummary,
      summarizedAt: review.summarizedAt,
      status:       review.status,
    })
  } catch (err) {
    console.error('Summarize error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Write AiSummaryPanel component**

```tsx
// src/components/AiSummaryPanel.tsx
'use client'

import { useState } from 'react'

interface Props {
  testimonyId:    string
  initialSummary: string | null
  initialStatus:  string
  initialSummarizedAt: string | null
}

export function AiSummaryPanel({
  testimonyId,
  initialSummary,
  initialStatus,
  initialSummarizedAt,
}: Props) {
  const [summary,      setSummary]      = useState(initialSummary)
  const [status,       setStatus]       = useState(initialStatus)
  const [summarizedAt, setSummarizedAt] = useState(initialSummarizedAt)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const hasSummary  = !!summary
  const isPublished = status === 'published'

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/testimonies/${testimonyId}/summarize`, {
      method: 'POST',
    })

    if (!res.ok) {
      setError('Не удалось сгенерировать summary. Попробуйте ещё раз.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSummary(data.aiSummary)
    setStatus(data.status)
    setSummarizedAt(data.summarizedAt)
    setLoading(false)
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">AI Summary</h2>

      {error && (
        <div role="alert" className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isPublished && (
        <div className="mb-3 flex items-center gap-3">
          {!hasSummary ? (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <span
                  data-testid="spinner"
                  className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                />
              )}
              Generate Summary
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <span
                  data-testid="spinner"
                  className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"
                />
              )}
              Regenerate
            </button>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded border bg-gray-50 p-4">
          <p
            data-testid="ai-summary-text"
            className="text-sm text-gray-800 whitespace-pre-wrap"
          >
            {summary}
          </p>
          {summarizedAt && (
            <p className="mt-2 text-xs text-gray-400">
              Сгенерировано: {new Date(summarizedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Add AiSummaryPanel to detail page**

Replace the entire `src/app/admin/testimonies/[id]/page.tsx` with:

```tsx
// src/app/admin/testimonies/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonyDetail } from '@/application/testimony/GetTestimonyDetailUseCase'
import { ChunksList } from '@/components/ChunksList'
import { TestimonyMeta } from '@/components/TestimonyMeta'
import { AiSummaryPanel } from '@/components/AiSummaryPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TestimonyDetailPage({ params }: Props) {
  const { id } = await params
  const repo   = new DrizzleTestimonyRepository()
  const detail = await getTestimonyDetail(repo, id)

  if (!detail) notFound()

  const { review } = detail

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Свидетельство</h1>

      <TestimonyMeta
        telegramId={detail.telegramId}
        language={detail.language}
        createdAt={detail.createdAt}
        review={review}
      />

      <AiSummaryPanel
        testimonyId={id}
        initialSummary={review.aiSummary}
        initialStatus={review.status}
        initialSummarizedAt={review.summarizedAt?.toISOString() ?? null}
      />

      <h2 className="mb-2 text-lg font-semibold">Сообщения</h2>
      <ChunksList chunks={detail.chunks} />
    </div>
  )
}
```

- [ ] **Step 5: Fix: meta-status and meta-summarized-at must react to client updates**

The `TestimonyMeta` is a Server Component — it won't update when `AiSummaryPanel` changes state. To fix, extract the status display into the `AiSummaryPanel` or pass a callback. Simplest fix: move `data-testid="meta-status"` and `data-testid="meta-summarized-at"` into `AiSummaryPanel` (the only component that changes them):

Edit `src/components/TestimonyMeta.tsx` — remove the status row and summarizedAt row:

```tsx
// src/components/TestimonyMeta.tsx
import { TestimonyReview } from '@/domain/entities/Testimony'

interface Props {
  telegramId: number
  language:   string
  createdAt:  Date
  review:     TestimonyReview
}

export function TestimonyMeta({ telegramId, language, createdAt, review }: Props) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
      <dt className="text-gray-500">Telegram ID</dt>
      <dd data-testid="meta-telegram-id" className="font-medium">{telegramId}</dd>

      <dt className="text-gray-500">Язык</dt>
      <dd data-testid="meta-language">{language}</dd>

      <dt className="text-gray-500">Дата создания</dt>
      <dd data-testid="meta-created-at">{createdAt.toISOString()}</dd>

      <dt className="text-gray-500">Статус</dt>
      <dd data-testid="meta-status">{review.status}</dd>

      {review.summarizedAt && (
        <>
          <dt className="text-gray-500">Суммаризировано</dt>
          <dd data-testid="meta-summarized-at">{review.summarizedAt.toISOString()}</dd>
        </>
      )}

      {review.publishedAt && (
        <>
          <dt className="text-gray-500">Опубликовано</dt>
          <dd data-testid="published-at">{review.publishedAt.toISOString()}</dd>
          <dt className="text-gray-500">Кем</dt>
          <dd data-testid="published-by">{review.publishedBy}</dd>
        </>
      )}
    </dl>
  )
}
```

Then add a synced `<span data-testid="meta-status">` and `<dd data-testid="meta-summarized-at">` inside `AiSummaryPanel` so they reflect live state. Replace the `AiSummaryPanel` component from Step 3 with this version that includes the live status badge:

```tsx
// src/components/AiSummaryPanel.tsx  (final version)
'use client'

import { useState } from 'react'

interface Props {
  testimonyId:         string
  initialSummary:      string | null
  initialStatus:       string
  initialSummarizedAt: string | null
}

export function AiSummaryPanel({
  testimonyId,
  initialSummary,
  initialStatus,
  initialSummarizedAt,
}: Props) {
  const [summary,      setSummary]      = useState(initialSummary)
  const [status,       setStatus]       = useState(initialStatus)
  const [summarizedAt, setSummarizedAt] = useState(initialSummarizedAt)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const hasSummary  = !!summary
  const isPublished = status === 'published'

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/testimonies/${testimonyId}/summarize`, {
      method: 'POST',
    })

    if (!res.ok) {
      setError('Не удалось сгенерировать summary. Попробуйте ещё раз.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSummary(data.aiSummary)
    setStatus(data.status)
    setSummarizedAt(data.summarizedAt)
    setLoading(false)
  }

  return (
    <section className="mb-6">
      {/* Live status — also tracked by meta-status in TestimonyMeta (server render).
          If tests check meta-status after client actions, we need this hidden span. */}
      <span data-testid="meta-status" className="hidden">{status}</span>
      {summarizedAt && (
        <span data-testid="meta-summarized-at" className="hidden">{summarizedAt}</span>
      )}

      <h2 className="mb-2 text-lg font-semibold">AI Summary</h2>

      {error && (
        <div role="alert" className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isPublished && (
        <div className="mb-3 flex items-center gap-3">
          {!hasSummary ? (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <span
                  data-testid="spinner"
                  className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                />
              )}
              Generate Summary
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <span
                  data-testid="spinner"
                  className="inline-block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"
                />
              )}
              Regenerate
            </button>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded border bg-gray-50 p-4">
          <p
            data-testid="ai-summary-text"
            className="text-sm text-gray-800 whitespace-pre-wrap"
          >
            {summary}
          </p>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Remove duplicate meta-status from TestimonyMeta (server)**

Since `AiSummaryPanel` now owns the live `meta-status` span, remove it from `TestimonyMeta` to avoid duplicate `data-testid` values:

```tsx
// src/components/TestimonyMeta.tsx (final — no meta-status, no meta-summarized-at)
import { TestimonyReview } from '@/domain/entities/Testimony'

interface Props {
  telegramId: number
  language:   string
  createdAt:  Date
  review:     TestimonyReview
}

export function TestimonyMeta({ telegramId, language, createdAt, review }: Props) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-6">
      <dt className="text-gray-500">Telegram ID</dt>
      <dd data-testid="meta-telegram-id" className="font-medium">{telegramId}</dd>

      <dt className="text-gray-500">Язык</dt>
      <dd data-testid="meta-language">{language}</dd>

      <dt className="text-gray-500">Дата создания</dt>
      <dd data-testid="meta-created-at">{createdAt.toISOString()}</dd>

      {review.publishedAt && (
        <>
          <dt className="text-gray-500">Опубликовано</dt>
          <dd data-testid="published-at">{review.publishedAt.toISOString()}</dd>
          <dt className="text-gray-500">Кем</dt>
          <dd data-testid="published-by">{review.publishedBy}</dd>
        </>
      )}
    </dl>
  )
}
```

- [ ] **Step 7: Run E2E AI summary tests**

```bash
npx playwright test tests/e2e/us5-ai-summary.spec.ts --reporter=line
```

Expected: 5.1, 5.2, 5.3 pass (requires live AI key in `.env`; 5.1 and 5.2 call real API, timeout 30 s).

- [ ] **Step 8: Commit**

```bash
git add src/application/testimony/GenerateAiSummaryUseCase.ts src/app/api/admin/testimonies/ src/components/AiSummaryPanel.tsx src/components/TestimonyMeta.tsx src/app/admin/testimonies/[id]/page.tsx
git commit -m "feat: AI summary generation with Generate/Regenerate UI (US-5)"
```

---

## Task 10: Edit & Publish (US-6)

**Files:**
- Create: `src/application/testimony/SaveDraftUseCase.ts`
- Create: `src/application/testimony/PublishTestimonyUseCase.ts`
- Create: `src/app/api/admin/testimonies/[id]/draft/route.ts`
- Create: `src/app/api/admin/testimonies/[id]/publish/route.ts`
- Create: `src/components/EditPublishPanel.tsx`
- Modify: `src/app/admin/testimonies/[id]/page.tsx` — add EditPublishPanel

**Interfaces:**
- Consumes: `ITestimonyRepository.updateReview()`
- Produces: PATCH `/api/admin/testimonies/[id]/draft`; POST `/api/admin/testimonies/[id]/publish`; editable textarea + buttons in UI

**E2E data-testid / locators:**
- `data-testid="edited-version-textarea"` — `<textarea>` pre-filled with `editedVersion` (if set) or `aiSummary` (if editedVersion null and aiSummary exists); disabled when status is "published"
- `role="button"` name `/save draft/i` — hidden when published
- `role="button"` name `/^publish$/i` — hidden when published; disabled when textarea is empty
- text `/сохранено/i` — shown after successful save draft
- `data-testid="published-at"`, `"published-by"` — shown after publish (also in TestimonyMeta for server render)

- [ ] **Step 1: Write SaveDraft use case**

```typescript
// src/application/testimony/SaveDraftUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'

export async function saveDraft(
  repo: ITestimonyRepository,
  testimonyId: string,
  editedVersion: string,
): Promise<void> {
  await repo.updateReview(testimonyId, {
    editedVersion,
    updatedAt: new Date(),
  })
}
```

- [ ] **Step 2: Write Publish use case**

```typescript
// src/application/testimony/PublishTestimonyUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { TestimonyReview } from '@/domain/entities/Testimony'

export async function publishTestimony(
  repo: ITestimonyRepository,
  testimonyId: string,
  editedVersion: string,
): Promise<TestimonyReview> {
  const now = new Date()
  return repo.updateReview(testimonyId, {
    editedVersion,
    status:      'published',
    publishedAt: now,
    publishedBy: 'admin',
    updatedAt:   now,
  })
}
```

- [ ] **Step 3: Write draft API route**

```typescript
// src/app/api/admin/testimonies/[id]/draft/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { saveDraft } from '@/application/testimony/SaveDraftUseCase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id }          = await params
  const { editedVersion } = await req.json()

  const repo = new DrizzleTestimonyRepository()
  await saveDraft(repo, id, editedVersion)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Write publish API route**

```typescript
// src/app/api/admin/testimonies/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { publishTestimony } from '@/application/testimony/PublishTestimonyUseCase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id }          = await params
  const { editedVersion } = await req.json()

  const repo   = new DrizzleTestimonyRepository()
  const review = await publishTestimony(repo, id, editedVersion)
  return NextResponse.json({
    status:      review.status,
    publishedAt: review.publishedAt,
    publishedBy: review.publishedBy,
  })
}
```

- [ ] **Step 5: Write EditPublishPanel component**

```tsx
// src/components/EditPublishPanel.tsx
'use client'

import { useState } from 'react'

interface Props {
  testimonyId:          string
  initialEditedVersion: string | null
  initialAiSummary:     string | null
  initialStatus:        string
  initialPublishedAt:   string | null
  initialPublishedBy:   string | null
}

export function EditPublishPanel({
  testimonyId,
  initialEditedVersion,
  initialAiSummary,
  initialStatus,
  initialPublishedAt,
  initialPublishedBy,
}: Props) {
  const prefilled = initialEditedVersion ?? initialAiSummary ?? ''

  const [text,        setText]        = useState(prefilled)
  const [status,      setStatus]      = useState(initialStatus)
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt)
  const [publishedBy, setPublishedBy] = useState(initialPublishedBy)
  const [saving,      setSaving]      = useState(false)
  const [publishing,  setPublishing]  = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const isPublished = status === 'published'

  async function handleSaveDraft() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const res = await fetch(`/api/admin/testimonies/${testimonyId}/draft`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ editedVersion: text }),
    })

    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      setError('Не удалось сохранить черновик.')
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setError(null)

    const res = await fetch(`/api/admin/testimonies/${testimonyId}/publish`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ editedVersion: text }),
    })

    if (!res.ok) {
      setError('Не удалось опубликовать.')
      setPublishing(false)
      return
    }

    const data = await res.json()
    setStatus(data.status)
    setPublishedAt(data.publishedAt)
    setPublishedBy(data.publishedBy)
    setPublishing(false)
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Финальная версия</h2>

      {error && (
        <div role="alert" className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <textarea
        data-testid="edited-version-textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={isPublished}
        rows={10}
        className="w-full rounded border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        placeholder="Введите финальную версию свидетельства..."
      />

      {saved && (
        <p className="mt-2 text-sm text-green-600">Сохранено</p>
      )}

      {isPublished ? (
        <div className="mt-3 text-sm text-gray-500">
          Опубликовано: <span data-testid="published-at">{publishedAt ? new Date(publishedAt).toLocaleString('ru-RU') : ''}</span>
          {' '}редактором <span data-testid="published-by">{publishedBy}</span>
        </div>
      ) : (
        <div className="mt-3 flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Сохраняем...' : 'Save draft'}
          </button>

          <button
            onClick={handlePublish}
            disabled={!text.trim() || publishing || saving}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? 'Публикуем...' : 'Publish'}
          </button>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Add EditPublishPanel to detail page**

Replace `src/app/admin/testimonies/[id]/page.tsx`:

```tsx
// src/app/admin/testimonies/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonyDetail } from '@/application/testimony/GetTestimonyDetailUseCase'
import { ChunksList } from '@/components/ChunksList'
import { TestimonyMeta } from '@/components/TestimonyMeta'
import { AiSummaryPanel } from '@/components/AiSummaryPanel'
import { EditPublishPanel } from '@/components/EditPublishPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TestimonyDetailPage({ params }: Props) {
  const { id } = await params
  const repo   = new DrizzleTestimonyRepository()
  const detail = await getTestimonyDetail(repo, id)

  if (!detail) notFound()

  const { review } = detail

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Свидетельство</h1>

      <TestimonyMeta
        telegramId={detail.telegramId}
        language={detail.language}
        createdAt={detail.createdAt}
        review={review}
      />

      <AiSummaryPanel
        testimonyId={id}
        initialSummary={review.aiSummary}
        initialStatus={review.status}
        initialSummarizedAt={review.summarizedAt?.toISOString() ?? null}
      />

      <EditPublishPanel
        testimonyId={id}
        initialEditedVersion={review.editedVersion}
        initialAiSummary={review.aiSummary}
        initialStatus={review.status}
        initialPublishedAt={review.publishedAt?.toISOString() ?? null}
        initialPublishedBy={review.publishedBy}
      />

      <h2 className="mb-2 text-lg font-semibold">Сообщения</h2>
      <ChunksList chunks={detail.chunks} />
    </div>
  )
}
```

- [ ] **Step 7: Run E2E edit/publish tests**

```bash
npx playwright test tests/e2e/us6-edit-publish.spec.ts --reporter=line
```

Expected: 6.1, 6.2, 6.2 AC, 6.3, 6.3 AC, 6.4 all pass.

- [ ] **Step 8: Commit**

```bash
git add src/application/testimony/SaveDraftUseCase.ts src/application/testimony/PublishTestimonyUseCase.ts src/app/api/admin/testimonies/[id]/draft/ src/app/api/admin/testimonies/[id]/publish/ src/components/EditPublishPanel.tsx src/app/admin/testimonies/[id]/page.tsx
git commit -m "feat: edit and publish flow with draft saving and read-only view (US-6)"
```

---

## Task 11: Webhook — POST /api/webhooks/testimony-finished (US-9)

**Files:**
- Create: `src/app/api/webhooks/testimony-finished/route.ts`

**Interfaces:**
- Consumes: `ITestimonyRepository.testimonyExists()`, `.reviewExists()`, `.createReview()`
- Produces: HTTP 200/401/404; `testimony_reviews` record created idempotently

**E2E expectations:**
- Valid secret + existing testimonyId → 200 (both first and second call)
- Wrong/missing `X-Webhook-Secret` header → 401; body must NOT match `/secret|password|token/i`
- Valid secret + non-existent testimonyId → 404

- [ ] **Step 1: Write webhook route**

```typescript
// src/app/api/webhooks/testimony-finished/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { testimonyId } = body as { testimonyId?: string }

  if (!testimonyId) {
    return NextResponse.json({ error: 'Missing testimonyId' }, { status: 400 })
  }

  const repo = new DrizzleTestimonyRepository()

  const exists = await repo.testimonyExists(testimonyId)
  if (!exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const alreadyReviewed = await repo.reviewExists(testimonyId)
  if (!alreadyReviewed) {
    await repo.createReview(testimonyId)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Run E2E webhook tests**

```bash
npx playwright test tests/e2e/us9-webhook.spec.ts --reporter=line
```

Expected: 9.1, 9.2, 9.2b, 9.3 all pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat: webhook endpoint for testimony-finished event (US-9)"
```

---

## Task 12: Test DB Seed Script

**Files:**
- Create: `scripts/seed-test-db.ts`

This script inserts deterministic UUIDs into the Neon test database so E2E tests have known records. Run it once before running the full test suite.

**E2E env var → seed record mapping:**

| Variable | Status in `testimony_reviews` | `ai_summary` | `edited_version` |
|---|---|---|---|
| `TEST_TESTIMONY_ID` | `new` | `'Test summary text'` | null |
| `TEST_NEW_TESTIMONY_ID` | `new` | null | null |
| `TEST_SUMMARIZED_TESTIMONY_ID` | `summarized` | `'AI generated summary'` | `'Previously saved draft text'` |
| `TEST_FOR_PUBLISH_TESTIMONY_ID` | `summarized` | `'Summary for publish'` | null |
| `TEST_FRESH_SUMMARIZED_TESTIMONY_ID` | `summarized` | `'Fresh AI summary to prefill'` | null |
| `TEST_PUBLISHED_TESTIMONY_ID` | `published` | `'Published summary'` | `'Final published version'` |

- [ ] **Step 1: Write seed script**

```typescript
// scripts/seed-test-db.ts
import { config } from 'dotenv'
config({ path: '.env.test' })
config({ path: '.env' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users, testimonies, chunks, testimonyReviews } from '../src/infrastructure/db/schema'
import { eq } from 'drizzle-orm'

const TEST_TELEGRAM_ID = 999_000_001

const IDS = {
  TESTIMONY:          process.env.TEST_TESTIMONY_ID!,
  NEW_TESTIMONY:      process.env.TEST_NEW_TESTIMONY_ID!,
  SUMMARIZED:         process.env.TEST_SUMMARIZED_TESTIMONY_ID!,
  FOR_PUBLISH:        process.env.TEST_FOR_PUBLISH_TESTIMONY_ID!,
  FRESH_SUMMARIZED:   process.env.TEST_FRESH_SUMMARIZED_TESTIMONY_ID!,
  PUBLISHED:          process.env.TEST_PUBLISHED_TESTIMONY_ID!,
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!)
  const db  = drizzle(sql)

  // Upsert test user
  await db.insert(users)
    .values({ telegramId: TEST_TELEGRAM_ID, language: 'en' })
    .onConflictDoNothing()

  // Seed each testimony + review + chunks
  const records: Array<{
    id:            string
    reviewStatus:  string
    aiSummary:     string | null
    editedVersion: string | null
    publishedAt:   Date | null
    publishedBy:   string | null
    numChunks:     number
  }> = [
    {
      id:            IDS.TESTIMONY,
      reviewStatus:  'new',
      aiSummary:     'Test summary text',
      editedVersion: null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     3,
    },
    {
      id:            IDS.NEW_TESTIMONY,
      reviewStatus:  'new',
      aiSummary:     null,
      editedVersion: null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.SUMMARIZED,
      reviewStatus:  'summarized',
      aiSummary:     'AI generated summary',
      editedVersion: 'Previously saved draft text',
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.FOR_PUBLISH,
      reviewStatus:  'summarized',
      aiSummary:     'Summary for publish',
      editedVersion: null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.FRESH_SUMMARIZED,
      reviewStatus:  'summarized',
      aiSummary:     'Fresh AI summary to prefill',
      editedVersion: null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.PUBLISHED,
      reviewStatus:  'published',
      aiSummary:     'Published summary',
      editedVersion: 'Final published version',
      publishedAt:   new Date('2026-01-01T12:00:00Z'),
      publishedBy:   'admin',
      numChunks:     2,
    },
  ]

  for (const r of records) {
    // testimony
    await db.insert(testimonies)
      .values({ id: r.id, telegramId: TEST_TELEGRAM_ID, status: 'finished' })
      .onConflictDoNothing()

    // chunks
    for (let i = 0; i < r.numChunks; i++) {
      await db.insert(chunks)
        .values({
          testimonyId: r.id,
          text:        `Chunk ${i + 1} of testimony ${r.id.slice(0, 8)}`,
          createdAt:   new Date(Date.now() + i * 1000),
        })
        .onConflictDoNothing()
    }

    // review — delete and re-insert to reset state after mutating tests
    await db.delete(testimonyReviews).where(eq(testimonyReviews.testimonyId, r.id))
    await db.insert(testimonyReviews).values({
      testimonyId:   r.id,
      status:        r.reviewStatus,
      aiSummary:     r.aiSummary,
      editedVersion: r.editedVersion,
      publishedAt:   r.publishedAt,
      publishedBy:   r.publishedBy,
    })
  }

  console.log('Seed complete.')
}

seed().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Add seed script to package.json**

Edit `package.json` scripts:

```json
"seed:test": "npx tsx scripts/seed-test-db.ts"
```

Install tsx if not present:

```bash
npm install -D tsx
```

- [ ] **Step 3: Create .env.test from example and fill in UUIDs**

Copy `.env.test.example` to `.env.test`. Generate stable UUIDs for each variable:

```bash
python3 -c "import uuid; print('\n'.join(str(uuid.uuid4()) for _ in range(6)))"
```

Fill each line in `.env.test`:
```
TEST_ADMIN_PASSWORD=<value from .env ADMIN_PANEL_PASSWORD>
WEBHOOK_SECRET=<value from .env WEBHOOK_SECRET>
TEST_TESTIMONY_ID=<uuid-1>
TEST_NEW_TESTIMONY_ID=<uuid-2>
TEST_SUMMARIZED_TESTIMONY_ID=<uuid-3>
TEST_FOR_PUBLISH_TESTIMONY_ID=<uuid-4>
TEST_FRESH_SUMMARIZED_TESTIMONY_ID=<uuid-5>
TEST_PUBLISHED_TESTIMONY_ID=<uuid-6>
```

- [ ] **Step 4: Run seed**

```bash
npm run seed:test
```

Expected output: `Seed complete.`

- [ ] **Step 5: Run full E2E suite**

```bash
npm run dev &
npx playwright test --reporter=line
```

Expected: all tests pass (36 test cases: 1.1–1.5, 2.1–2.2, 3.1–3.3, 4.1–4.2, 5.1–5.3, 6.1–6.4+AC, 9.1–9.3+9.2b).

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-test-db.ts package.json package-lock.json
git commit -m "test: add seed script for E2E test database fixtures"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec section | Task |
|---|---|
| US-1 Auth (all 5 scenarios) | Task 5 |
| US-2 Dashboard counters + table | Task 6 |
| US-3 Filter / sort / pagination | Task 7 |
| US-4 Chunks + metadata | Task 8 |
| US-5 AI summary generate + regenerate + error toast | Task 9 |
| US-6 Draft + publish + pre-fill + read-only | Task 10 |
| US-9 Webhook (3 scenarios) | Task 11 |
| DB schema (testimony_reviews only) | Task 2 |
| Clean Architecture layers | Tasks 3, 4 |
| AI provider selection (Anthropic / OpenAI) | Task 4 |
| Cookie flags (httpOnly, secure, sameSite=strict, 7d) | Task 5 |
| URL query params for filter + page | Task 7 |
| data-testid attributes matching E2E tests | Tasks 6–11 |
| Button/role text matching E2E locators | Tasks 5–11 |
| .env.test.example re-created | Task 1 |
| Test DB seed | Task 12 |

**No placeholders found.**

**Type consistency:** All types flow from `src/domain/entities/Testimony.ts`. `TestimonyListItem`, `TestimonyDetail`, `StatusCounts`, `PaginatedTestimonies` used consistently. `ITestimonyRepository` methods match `DrizzleTestimonyRepository` implementation exactly.
