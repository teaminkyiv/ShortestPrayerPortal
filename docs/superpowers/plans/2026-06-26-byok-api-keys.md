# US-10 BYOK (Bring Your Own Key) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/admin/settings` page where the admin can store AI provider API keys in the database, used as a fallback when env vars are not set.

## User Stories

### US-10a — Settings page
As an admin, I can open `/admin/settings` and see forms for Anthropic and OpenAI API keys so I can configure AI without touching server env vars.

### US-10b — Save / delete API key
As an admin, I can save or delete an API key per provider. After saving I see "Key saved". After deleting the key field resets.

### US-10c — Explicit API key prompt when key is missing
As an admin, when I click "Generate Summary" and no API key is configured anywhere (neither env var nor DB), I see a clear message — **"No API key configured. Please add an API key in Settings to use AI summarization."** — with a direct clickable link to `/admin/settings`. The message must NOT say "try again" since retrying without a key will always fail.

### US-10d — Env var takes priority over DB key
As a developer, when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set as an env var, it is used instead of the DB-stored key so the DB key acts purely as a fallback.

**Architecture:** A new `api_keys` table in the existing Drizzle schema stores provider keys. A thin `ApiKeyRepository` wraps DB access. `AiSummaryService.generateSummary()` checks env vars first, then falls back to the repository. The settings UI is a server page + client form component, wired to three new API routes (GET/PUT/DELETE).

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM, Neon PostgreSQL (neon-http driver), Tailwind CSS, `@anthropic-ai/sdk`, `openai`.

## Global Constraints

- Drizzle schema lives at `src/infrastructure/db/schema.ts`; run `npm run db:push` to sync to Neon (no SQL migration files needed — project uses push workflow)
- DB client: `import { db } from '@/infrastructure/db/client'` (neon-http, serverless)
- Auth pattern for all API routes: `getTokenFromRequest(req)` → `verifySession(token)` from `@/lib/auth`
- All components follow existing Tailwind + React conventions; no new UI libraries
- `params` in App Router pages/routes is `Promise<{...}>` — must `await params`
- No E2E tests

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/infrastructure/db/schema.ts` | Modify | Add `apiKeys` table |
| `src/infrastructure/db/repositories/ApiKeyRepository.ts` | Create | `getApiKey`, `setApiKey`, `deleteApiKey` |
| `src/infrastructure/ai/AiSummaryService.ts` | Modify | Fallback to DB key if env var missing |
| `src/app/api/admin/settings/api-keys/route.ts` | Create | GET + PUT + DELETE handlers |
| `src/app/api/admin/testimonies/[id]/summarize/route.ts` | Modify | Catch `no_api_key` error → 422 |
| `src/components/ApiKeyForm.tsx` | Create | Client component with Anthropic + OpenAI forms |
| `src/app/admin/settings/page.tsx` | Create | Server page, fetches key presence, renders ApiKeyForm |
| `src/app/admin/layout.tsx` | Modify | Add "Настройки" nav link |
| `src/components/AiSummaryPanel.tsx` | Modify | Handle 422 `no_api_key` → show link to settings |

---

### Task 1: DB Schema — add `apiKeys` table

**Files:**
- Modify: `src/infrastructure/db/schema.ts`

**Interfaces:**
- Produces: `apiKeys` Drizzle table object (used by Task 2)

- [ ] **Step 1: Add the table to schema**

Open `src/infrastructure/db/schema.ts`. Add at the end (after the `testimonyReviews` table):

```typescript
export const apiKeys = pgTable('api_keys', {
  id:        uuid('id').primaryKey().defaultRandom(),
  provider:  text('provider').notNull().unique(), // 'anthropic' | 'openai'
  keyValue:  text('key_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

The existing imports already include `pgTable`, `uuid`, `text`, `timestamp` — no new imports needed.

- [ ] **Step 2: Push schema to Neon**

```bash
npm run db:push
```

Expected output: Drizzle prints `[✓] Changes applied` or similar. The `api_keys` table is created with a `UNIQUE(provider)` constraint.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/schema.ts
git commit -m "feat(db): add api_keys table for BYOK"
```

---

### Task 2: ApiKeyRepository

**Files:**
- Create: `src/infrastructure/db/repositories/ApiKeyRepository.ts`

**Interfaces:**
- Consumes: `apiKeys` table from `src/infrastructure/db/schema.ts`; `db` from `src/infrastructure/db/client.ts`
- Produces:
  - `getApiKey(provider: 'anthropic' | 'openai'): Promise<string | null>`
  - `setApiKey(provider: 'anthropic' | 'openai', key: string): Promise<void>`
  - `deleteApiKey(provider: 'anthropic' | 'openai'): Promise<void>`

- [ ] **Step 1: Create the repository file**

Create `src/infrastructure/db/repositories/ApiKeyRepository.ts`:

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../client'
import { apiKeys } from '../schema'

export type ApiProvider = 'anthropic' | 'openai'

export async function getApiKey(provider: ApiProvider): Promise<string | null> {
  const [row] = await db
    .select({ keyValue: apiKeys.keyValue })
    .from(apiKeys)
    .where(eq(apiKeys.provider, provider))
    .limit(1)
  return row?.keyValue ?? null
}

export async function setApiKey(provider: ApiProvider, key: string): Promise<void> {
  await db
    .insert(apiKeys)
    .values({ provider, keyValue: key })
    .onConflictDoUpdate({
      target: apiKeys.provider,
      set: { keyValue: key, updatedAt: new Date() },
    })
}

export async function deleteApiKey(provider: ApiProvider): Promise<void> {
  await db.delete(apiKeys).where(eq(apiKeys.provider, provider))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/db/repositories/ApiKeyRepository.ts
git commit -m "feat(db): add ApiKeyRepository for BYOK"
```

---

### Task 3: Update AiSummaryService to fall back to DB key

**Files:**
- Modify: `src/infrastructure/ai/AiSummaryService.ts`

**Interfaces:**
- Consumes: `getApiKey` from `@/infrastructure/db/repositories/ApiKeyRepository`
- Produces: `generateSummary` now throws `{ code: 'no_api_key' }` (plain object, not `Error`) when no key is available anywhere

- [ ] **Step 1: Rewrite AiSummaryService.ts**

Replace the full contents of `src/infrastructure/ai/AiSummaryService.ts`:

```typescript
// src/infrastructure/ai/AiSummaryService.ts
import { getApiKey } from '@/infrastructure/db/repositories/ApiKeyRepository'

export class NoApiKeyError extends Error {
  readonly code = 'no_api_key' as const
  constructor() {
    super('No AI provider API key configured')
    this.name = 'NoApiKeyError'
  }
}

export async function generateSummary(
  chunkTexts: string[],
  language: string,
): Promise<string> {
  const content = chunkTexts.join('\n---\n')
  const prompt = `Summarize the following personal testimony in ${language === 'ru' ? 'Russian' : language === 'uk' ? 'Ukrainian' : 'English'} (2-4 paragraphs). Preserve the speaker's voice and key spiritual details.\n\n${content}`

  const anthropicKey = process.env.ANTHROPIC_API_KEY || await getApiKey('anthropic')
  if (anthropicKey) {
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
    return block.text
  }

  const openaiKey = process.env.OPENAI_API_KEY || await getApiKey('openai')
  if (openaiKey) {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: openaiKey })
    const res = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return res.choices[0].message.content ?? ''
  }

  throw new NoApiKeyError()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/ai/AiSummaryService.ts
git commit -m "feat(ai): fall back to DB key if env var not set (BYOK)"
```

---

### Task 4: Update summarize route to handle `no_api_key`

**Files:**
- Modify: `src/app/api/admin/testimonies/[id]/summarize/route.ts`

**Interfaces:**
- Consumes: `NoApiKeyError` from `@/infrastructure/ai/AiSummaryService`
- Produces: Returns `{ error: 'no_api_key' }` with HTTP 422 when `NoApiKeyError` is thrown

- [ ] **Step 1: Update the route handler**

Replace the full contents of `src/app/api/admin/testimonies/[id]/summarize/route.ts`:

```typescript
// src/app/api/admin/testimonies/[id]/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { generateAiSummary } from '@/application/testimony/GenerateAiSummaryUseCase'
import { NoApiKeyError } from '@/infrastructure/ai/AiSummaryService'

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
    if (err instanceof NoApiKeyError) {
      return NextResponse.json({ error: 'no_api_key' }, { status: 422 })
    }
    console.error('Summarize error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/testimonies/[id]/summarize/route.ts
git commit -m "feat(api): return 422 no_api_key when no AI key configured"
```

---

### Task 5: API routes for managing API keys

**Files:**
- Create: `src/app/api/admin/settings/api-keys/route.ts`

**Interfaces:**
- Consumes: `getApiKey`, `setApiKey`, `deleteApiKey` from `@/infrastructure/db/repositories/ApiKeyRepository`
- Produces:
  - `GET /api/admin/settings/api-keys` → `{ anthropic: boolean, openai: boolean }`
  - `PUT /api/admin/settings/api-keys` body `{ provider: 'anthropic'|'openai', key: string }` → `{ ok: true }`
  - `DELETE /api/admin/settings/api-keys?provider=anthropic|openai` → `{ ok: true }`
  - All routes return 401 if not authenticated

- [ ] **Step 1: Create the directory and route file**

```bash
mkdir -p /Users/berdyshevo/Documents/MyProjects/ShortestPrayerPortal/src/app/api/admin/settings/api-keys
```

Create `src/app/api/admin/settings/api-keys/route.ts`:

```typescript
// src/app/api/admin/settings/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import {
  getApiKey, setApiKey, deleteApiKey,
} from '@/infrastructure/db/repositories/ApiKeyRepository'

async function authenticate(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req)
  return !!token && verifySession(token)
}

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [anthropic, openai] = await Promise.all([
    getApiKey('anthropic'),
    getApiKey('openai'),
  ])

  return NextResponse.json({
    anthropic: !!anthropic,
    openai:    !!openai,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { provider?: string; key?: string }
  if (!body.provider || !body.key) {
    return NextResponse.json({ error: 'provider and key are required' }, { status: 400 })
  }
  if (body.provider !== 'anthropic' && body.provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await setApiKey(body.provider, body.key)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provider = req.nextUrl.searchParams.get('provider')
  if (provider !== 'anthropic' && provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await deleteApiKey(provider)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/settings/api-keys/route.ts
git commit -m "feat(api): add GET/PUT/DELETE routes for BYOK api-keys"
```

---

### Task 6: ApiKeyForm client component

**Files:**
- Create: `src/components/ApiKeyForm.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/settings/api-keys`, `PUT /api/admin/settings/api-keys`, `DELETE /api/admin/settings/api-keys`
- Props: `initialAnthropicSet: boolean`, `initialOpenaiSet: boolean`

- [ ] **Step 1: Create the component**

Create `src/components/ApiKeyForm.tsx`:

```typescript
'use client'

import { useState } from 'react'

type Provider = 'anthropic' | 'openai'

interface ProviderRowProps {
  provider:   Provider
  label:      string
  isSet:      boolean
  onSaved:    (provider: Provider) => void
  onDeleted:  (provider: Provider) => void
}

function ProviderRow({ provider, label, isSet, onSaved, onDeleted }: ProviderRowProps) {
  const [key,     setKey]     = useState('')
  const [saving,  setSaving]  = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave() {
    if (!key.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/settings/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: key.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setKey('')
      setMessage({ type: 'success', text: 'Ключ сохранён' })
      onSaved(provider)
    } catch {
      setMessage({ type: 'error', text: 'Ошибка при сохранении' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/settings/api-keys?provider=${provider}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      setMessage({ type: 'success', text: 'Ключ удалён' })
      onDeleted(provider)
    } catch {
      setMessage({ type: 'error', text: 'Ошибка при удалении' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mb-6 rounded border bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-semibold text-gray-800">{label}</h3>
        {isSet
          ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">✓ Ключ установлен</span>
          : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Не установлен</span>
        }
      </div>

      {message && (
        <div
          aria-live="polite"
          className={`mb-3 rounded px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={isSet ? 'Введите новый ключ для замены' : 'Введите API ключ'}
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`API ключ для ${label}`}
        />
        <button
          onClick={handleSave}
          disabled={saving || !key.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        {isSet && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        )}
      </div>
    </div>
  )
}

interface Props {
  initialAnthropicSet: boolean
  initialOpenaiSet:    boolean
}

export function ApiKeyForm({ initialAnthropicSet, initialOpenaiSet }: Props) {
  const [anthropicSet, setAnthropicSet] = useState(initialAnthropicSet)
  const [openaiSet,    setOpenaiSet]    = useState(initialOpenaiSet)

  return (
    <div>
      <ProviderRow
        provider="anthropic"
        label="Anthropic (Claude)"
        isSet={anthropicSet}
        onSaved={() => setAnthropicSet(true)}
        onDeleted={() => setAnthropicSet(false)}
      />
      <ProviderRow
        provider="openai"
        label="OpenAI (GPT-4o)"
        isSet={openaiSet}
        onSaved={() => setOpenaiSet(true)}
        onDeleted={() => setOpenaiSet(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ApiKeyForm.tsx
git commit -m "feat(ui): add ApiKeyForm component for BYOK settings"
```

---

### Task 7: Settings page `/admin/settings`

**Files:**
- Create: `src/app/admin/settings/page.tsx`

**Interfaces:**
- Consumes: `getApiKey` from `@/infrastructure/db/repositories/ApiKeyRepository`; `ApiKeyForm` from `@/components/ApiKeyForm`

- [ ] **Step 1: Create the directory and page**

```bash
mkdir -p /Users/berdyshevo/Documents/MyProjects/ShortestPrayerPortal/src/app/admin/settings
```

Create `src/app/admin/settings/page.tsx`:

```typescript
// src/app/admin/settings/page.tsx
import { getApiKey } from '@/infrastructure/db/repositories/ApiKeyRepository'
import { ApiKeyForm } from '@/components/ApiKeyForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const [anthropicKey, openaiKey] = await Promise.all([
    getApiKey('anthropic'),
    getApiKey('openai'),
  ])

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Настройки</h1>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-700">AI API ключи</h2>
        <p className="mb-4 text-sm text-gray-500">
          Если установлена переменная среды <code className="rounded bg-gray-100 px-1">ANTHROPIC_API_KEY</code> или{' '}
          <code className="rounded bg-gray-100 px-1">OPENAI_API_KEY</code>, она используется в приоритете.
          Ключи ниже применяются только как запасной вариант.
        </p>
        <ApiKeyForm
          initialAnthropicSet={!!anthropicKey}
          initialOpenaiSet={!!openaiKey}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "feat(pages): add /admin/settings page for BYOK key management"
```

---

### Task 8: Add "Настройки" link to admin nav

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Add nav link**

In `src/app/admin/layout.tsx`, add a link after "Свидетельства":

```typescript
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b px-6 py-3">
        <nav className="flex gap-4 text-sm">
          <a href="/admin" className="font-semibold text-gray-700 hover:text-blue-600">Dashboard</a>
          <a href="/admin/testimonies" className="text-gray-600 hover:text-blue-600">Свидетельства</a>
          <a href="/admin/settings" className="text-gray-600 hover:text-blue-600">Настройки</a>
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(nav): add Settings link to admin navigation"
```

---

### Task 9: Update AiSummaryPanel to handle `no_api_key` response

**Files:**
- Modify: `src/components/AiSummaryPanel.tsx`

**Interfaces:**
- Consumes: `error: 'no_api_key'` in JSON body from 422 response on `/api/admin/testimonies/[id]/summarize`

- [ ] **Step 1: Update handleGenerate to detect no_api_key**

In `src/components/AiSummaryPanel.tsx`, replace the `handleGenerate` function body:

```typescript
  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/admin/testimonies/${testimonyId}/summarize`, {
      method: 'POST',
    })

    if (res.status === 422) {
      const data = await res.json()
      if (data.error === 'no_api_key') {
        setError('API ключ не настроен. Перейдите в настройки чтобы добавить ключ.')
        setLoading(false)
        return
      }
    }

    if (!res.ok) {
      setError('Не удалось сгенерировать summary. Попробуйте ещё раз.')
      setLoading(false)
      return
    }

    const data = await res.json()
    setSummary(data.aiSummary)
    setStatus(data.status)
    setSummarizedAt(data.summarizedAt)
    onStatusChange?.(data.status)
    setLoading(false)
  }
```

Also update the error display block in the JSX to render a link when the error is about the API key. Replace the existing error `<div>` block:

```tsx
      {error && (
        <div aria-live="assertive" aria-atomic="true" className="mb-3 rounded bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error.includes('API ключ не настроен') ? (
            <>
              API ключ не настроен.{' '}
              <a href="/admin/settings" className="underline hover:text-red-900">
                Перейти в настройки
              </a>
            </>
          ) : (
            error
          )}
        </div>
      )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AiSummaryPanel.tsx
git commit -m "feat(ui): show settings link when AI key not configured (BYOK)"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|-------------|------|
| DB schema `api_keys` table | Task 1 |
| Migration / schema push | Task 1 Step 2 |
| `getApiKey`, `setApiKey`, `deleteApiKey` repository | Task 2 |
| Env var priority → DB fallback → throw `no_api_key` | Task 3 |
| `GET /api/admin/settings/api-keys` → `{ anthropic: bool, openai: bool }` | Task 5 |
| `PUT /api/admin/settings/api-keys` → save key | Task 5 |
| `DELETE /api/admin/settings/api-keys?provider=...` → delete key | Task 5 |
| Summarize route catches `no_api_key` → 422 | Task 4 |
| AiSummaryPanel 422 handling with settings link | Task 9 |
| `/admin/settings` page with forms | Task 7 |
| `ApiKeyForm` client component | Task 6 |
| Nav link "Settings" | Task 8 |
| No-key error shows explicit message + link, not "try again" (US-10c) | Task 9 / AiSummaryPanel |

All requirements covered.

### Placeholder Scan

No TBD/TODO/placeholder text found.

### Type Consistency

- `ApiProvider = 'anthropic' | 'openai'` defined in Task 2, used consistently in Tasks 3, 5, 6, 7.
- `NoApiKeyError` defined in Task 3, imported in Task 4.
- `getApiKey`/`setApiKey`/`deleteApiKey` signatures defined in Task 2, consumed identically in Tasks 5 and 7.
