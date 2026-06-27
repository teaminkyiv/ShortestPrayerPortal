export type TestimonyStatus = 'new' | 'summarized' | 'published'

export interface TestimonyReview {
  id: string
  testimonyId: string
  status: TestimonyStatus
  aiSummary: string | null
  editedVersion: string | null
  summarizedAt: Date | null
  publishedAt: Date | null
  publishedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Chunk {
  id: string
  testimonyId: string
  text: string
  createdAt: Date
}

export interface TestimonyListItem {
  id: string
  telegramId: number
  firstName: string | null
  lastName: string | null
  username: string | null
  language: string
  createdAt: Date
  status: TestimonyStatus
}

export interface TestimonyDetail {
  id: string
  telegramId: number
  firstName: string | null
  lastName: string | null
  username: string | null
  language: string
  createdAt: Date
  review: TestimonyReview
  chunks: Chunk[]
}

export interface StatusCounts {
  new: number
  summarized: number
  published: number
}

export interface PaginatedTestimonies {
  items: TestimonyListItem[]
  total: number
  page: number
  pageSize: number
}
