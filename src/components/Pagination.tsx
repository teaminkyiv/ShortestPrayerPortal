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
        Previous
      </button>
      <span className="text-sm text-gray-600">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1 rounded border text-sm disabled:opacity-40"
      >
        Next
      </button>
    </div>
  )
}
