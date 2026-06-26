import { ITestimonyRepository, GetTestimoniesOptions } from '@/domain/repositories/ITestimonyRepository'
import { PaginatedTestimonies } from '@/domain/entities/Testimony'

export async function getTestimonies(
  repo: ITestimonyRepository,
  opts: GetTestimoniesOptions,
): Promise<PaginatedTestimonies> {
  return repo.getTestimonies(opts)
}
