import { Suspense } from 'react'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonies } from '@/application/testimony/GetTestimoniesUseCase'
import { TestimoniesTable } from '@/components/TestimoniesTable'
import { FilterTabs } from '@/components/FilterTabs'

export const dynamic = 'force-dynamic'
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
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

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
