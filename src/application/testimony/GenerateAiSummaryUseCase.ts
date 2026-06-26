// src/application/testimony/GenerateAiSummaryUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { generateSummary } from '@/infrastructure/ai/AiSummaryService'
import { TestimonyReview } from '@/domain/entities/Testimony'

export async function generateAiSummary(
  repo: ITestimonyRepository,
  testimonyId: string,
): Promise<TestimonyReview> {
  const detail = await repo.getTestimonyDetail(testimonyId)
  if (!detail) throw new Error('Testimony not found')

  const chunkTexts = detail.chunks.map(c => c.text)
  const summary    = await generateSummary(chunkTexts, detail.language)
  const now        = new Date()

  return repo.updateReview(testimonyId, {
    aiSummary:    summary,
    status:       'summarized',
    summarizedAt: now,
    updatedAt:    now,
  })
}
