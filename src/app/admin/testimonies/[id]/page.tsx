// src/app/admin/testimonies/[id]/page.tsx
import { notFound } from 'next/navigation'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { getTestimonyDetail } from '@/application/testimony/GetTestimonyDetailUseCase'
import { ChunksList } from '@/components/ChunksList'
import { TestimonyMeta } from '@/components/TestimonyMeta'
import { TestimonyDetailClient } from '@/components/TestimonyDetailClient'

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
      <h1 className="mb-4 text-2xl font-bold">Testimony</h1>

      <TestimonyMeta
        telegramId={detail.telegramId}
        language={detail.language}
        createdAt={detail.createdAt}
        review={review}
      />

      <TestimonyDetailClient
        testimonyId={id}
        initialSummary={review.aiSummary}
        initialStatus={review.status}
        initialSummarizedAt={review.summarizedAt?.toISOString() ?? null}
        initialEditedVersion={review.editedVersion}
        initialPublishedAt={review.publishedAt?.toISOString() ?? null}
        initialPublishedBy={review.publishedBy}
      />

      <h2 className="mb-2 text-lg font-semibold">Messages</h2>
      <ChunksList chunks={detail.chunks} />
    </div>
  )
}
