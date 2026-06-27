'use client'

import { useState } from 'react'

interface Props {
  testimonyId:          string
  initialEditedVersion: string | null
  initialAiSummary:     string | null
  initialStatus:        string
  initialPublishedAt:   string | null
  initialPublishedBy:   string | null
  onStatusChange?:      (status: string) => void
}

export function EditPublishPanel({
  testimonyId,
  initialEditedVersion,
  initialAiSummary,
  initialStatus,
  initialPublishedAt,
  initialPublishedBy,
  onStatusChange,
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
      setError('Failed to save draft.')
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
      setError('Failed to publish.')
      setPublishing(false)
      return
    }

    const data = await res.json()
    setStatus(data.status)
    setPublishedAt(data.publishedAt)
    setPublishedBy(data.publishedBy)
    onStatusChange?.(data.status)
    setPublishing(false)
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">Final version</h2>

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
        placeholder="Enter the final version of the testimony..."
      />

      {saved && (
        <p className="mt-2 text-sm text-green-600">Saved</p>
      )}

      {isPublished ? (
        <div className="mt-3 text-sm text-gray-500">
          Published: <span data-testid="published-at">{publishedAt ? new Date(publishedAt).toLocaleString('en-US') : ''}</span>
          {' '}by <span data-testid="published-by">{publishedBy}</span>
        </div>
      ) : (
        <div className="mt-3 flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save draft'}
          </button>

          <button
            onClick={handlePublish}
            disabled={!text.trim() || publishing || saving}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      )}
    </section>
  )
}
