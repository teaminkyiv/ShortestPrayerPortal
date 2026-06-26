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
