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
        body: JSON.stringify({ provider, keyValue: key.trim() }),
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
    <div className="mb-6 rounded border bg-white p-4" data-testid={`api-key-form-${provider}`}>
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
          {...(message.type === 'success' ? { 'data-testid': 'api-key-saved-notice' } : {})}
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
          data-testid={`api-key-input-${provider}`}
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
            {deleting ? 'Удаление…' : 'Удалить ключ'}
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
