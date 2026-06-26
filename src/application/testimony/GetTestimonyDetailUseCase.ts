import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { TestimonyDetail } from '@/domain/entities/Testimony'

export async function getTestimonyDetail(
  repo: ITestimonyRepository,
  id: string,
): Promise<TestimonyDetail | null> {
  return repo.getTestimonyDetail(id)
}
