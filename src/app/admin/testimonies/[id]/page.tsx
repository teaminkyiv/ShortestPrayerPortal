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
