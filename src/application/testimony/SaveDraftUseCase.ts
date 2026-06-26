// src/application/testimony/SaveDraftUseCase.ts
import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'

export async function saveDraft(
  repo: ITestimonyRepository,
  testimonyId: string,
  editedVersion: string,
): Promise<void> {
  await repo.updateReview(testimonyId, {
    editedVersion,
    updatedAt: new Date(),
  })
}
