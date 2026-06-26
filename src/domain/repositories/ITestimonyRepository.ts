import {
  StatusCounts,
  TestimonyListItem,
  TestimonyDetail,
  TestimonyReview,
  TestimonyStatus,
  PaginatedTestimonies,
} from '../entities/Testimony'

export interface GetTestimoniesOptions {
  status: TestimonyStatus | 'all'
  page: number
  pageSize: number
}

export interface ITestimonyRepository {
  getStatusCounts(): Promise<StatusCounts>
  getRecentTestimonies(limit: number): Promise<TestimonyListItem[]>
  getTestimonies(opts: GetTestimoniesOptions): Promise<PaginatedTestimonies>
  getTestimonyDetail(id: string): Promise<TestimonyDetail | null>
  testimonyExists(id: string): Promise<boolean>
  reviewExists(testimonyId: string): Promise<boolean>
  createReview(testimonyId: string): Promise<TestimonyReview>
  updateReview(
    testimonyId: string,
    data: Partial<Pick<TestimonyReview, 'status' | 'aiSummary' | 'editedVersion' | 'summarizedAt' | 'publishedAt' | 'publishedBy' | 'updatedAt'>>
  ): Promise<TestimonyReview>
}
