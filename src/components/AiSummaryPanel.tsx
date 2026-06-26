// src/components/AiSummaryPanel.tsx  (final version)
'use client'

import { useState } from 'react'

interface Props {
  testimonyId:         string
  initialSummary:      string | null
  initialStatus:       string
  initialSummarizedAt: string | null
  onStatusChange?:     (status: string) => void
  externalStatus?:     string
}

export function AiSummaryPanel({
  testimonyId,
  initialSummary,
  initialStatus,
  initialSummarizedAt,
  onStatusChange,
  externalStatus,
}: Props) {
  const [summary,      setSummary]      = useState(initialSummary)
  const [status,       setStatus]       = useState(initialStatus)
  const [summarizedAt, setSummarizedAt] = useState(initialSummarizedAt)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const hasSummary  = !!summary
  // Use externalStatus if provided (allows parent to sync publish state)
  const displayStatus = externalStatus ?? status
  const isPublished = displayStatus === 'published'

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

  return (
    <section className="mb-6">
      {/* Live status — updated by AI generation and synced from publish action */}
      <span data-testid="meta-status" className="sr-only">{displayStatus}</span>
      {summarizedAt && (
        <span data-testid="meta-summarized-at" className="hidden">{summarizedAt}</span>
      )}

      <h2 className="mb-2 text-lg font-semibold">AI Summary</h2>

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
