// src/application/testimony/PublishTestimonyUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { TestimonyReview } from '@/domain/entities/Testimony'

export async function publishTestimony(
  repo: ITestimonyRepository,
  testimonyId: string,
  editedVersion: string,
): Promise<TestimonyReview> {
  const detail = await repo.getTestimonyDetail(testimonyId)
  if (!detail) throw new Error('Testimony not found')
  if (detail.review.status === 'published') {
    throw new Error('Testimony is already published')
  }
  const now = new Date()
  return repo.updateReview(testimonyId, {
    editedVersion,
    status:      'published',
    publishedAt: now,
    publishedBy: 'admin',
    updatedAt:   now,
  })
}
