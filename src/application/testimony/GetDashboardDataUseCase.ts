import { ITestimonyRepository } from '@/domain/repositories/ITestimonyRepository'
import { StatusCounts, TestimonyListItem } from '@/domain/entities/Testimony'

export interface DashboardData {
  counts: StatusCounts
  recent: TestimonyListItem[]
}

export async function getDashboardData(
  repo: ITestimonyRepository,
): Promise<DashboardData> {
  const [counts, recent] = await Promise.all([
    repo.getStatusCounts(),
    repo.getRecentTestimonies(20),
  ])
  return { counts, recent }
}
