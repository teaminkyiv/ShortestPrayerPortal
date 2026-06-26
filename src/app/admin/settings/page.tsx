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
