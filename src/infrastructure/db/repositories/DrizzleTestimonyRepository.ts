// src/infrastructure/db/repositories/DrizzleTestimonyRepository.ts
import { eq, desc, count, and, sql } from 'drizzle-orm'
import { db } from '../client'
import {
  users, testimonies, chunks, testimonyReviews,
} from '../schema'
import { ITestimonyRepository, GetTestimoniesOptions } from '@/domain/repositories/ITestimonyRepository'
import {
  StatusCounts, TestimonyListItem, TestimonyDetail,
  TestimonyReview, PaginatedTestimonies,
} from '@/domain/entities/Testimony'

export class DrizzleTestimonyRepository implements ITestimonyRepository {
  async getStatusCounts(): Promise<StatusCounts> {
    const rows = await db
      .select({ status: testimonyReviews.status, cnt: count() })
      .from(testimonyReviews)
      .groupBy(testimonyReviews.status)

    const result: StatusCounts = { new: 0, summarized: 0, published: 0 }
    for (const row of rows) {
      if (row.status === 'new') result.new = Number(row.cnt)
      else if (row.status === 'summarized') result.summarized = Number(row.cnt)
      else if (row.status === 'published') result.published = Number(row.cnt)
    }
    return result
  }

  async getRecentTestimonies(limit: number): Promise<TestimonyListItem[]> {
    const rows = await db
      .select({
        id:         testimonies.id,
        telegramId: testimonies.telegramId,
        language:   users.language,
        createdAt:  testimonies.createdAt,
        status:     testimonyReviews.status,
      })
      .from(testimonyReviews)
      .innerJoin(testimonies, eq(testimonyReviews.testimonyId, testimonies.id))
      .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
      .orderBy(desc(testimonies.createdAt))
      .limit(limit)

    return rows.map(r => ({
      id:         r.id,
      telegramId: r.telegramId,
      language:   r.language,
      createdAt:  r.createdAt!,
      status:     r.status as 'new' | 'summarized' | 'published',
    }))
  }

  async getTestimonies(opts: GetTestimoniesOptions): Promise<PaginatedTestimonies> {
    const { status, page, pageSize } = opts
    const offset = (page - 1) * pageSize

    const whereClause = status === 'all'
      ? undefined
      : eq(testimonyReviews.status, status)

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id:         testimonies.id,
          telegramId: testimonies.telegramId,
          language:   users.language,
          createdAt:  testimonies.createdAt,
          status:     testimonyReviews.status,
        })
        .from(testimonyReviews)
        .innerJoin(testimonies, eq(testimonyReviews.testimonyId, testimonies.id))
        .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
        .where(whereClause)
        .orderBy(desc(testimonies.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(testimonyReviews)
        .where(whereClause),
    ])

    return {
      items: rows.map(r => ({
        id:         r.id,
        telegramId: r.telegramId,
        language:   r.language,
        createdAt:  r.createdAt!,
        status:     r.status as 'new' | 'summarized' | 'published',
      })),
      total:    Number(total),
      page,
      pageSize,
    }
  }

  async getTestimonyDetail(id: string): Promise<TestimonyDetail | null> {
    const [row] = await db
      .select({
        id:           testimonies.id,
        telegramId:   testimonies.telegramId,
        language:     users.language,
        createdAt:    testimonies.createdAt,
        reviewId:          testimonyReviews.id,
        reviewStatus:      testimonyReviews.status,
        aiSummary:         testimonyReviews.aiSummary,
        editedVersion:     testimonyReviews.editedVersion,
        summarizedAt:      testimonyReviews.summarizedAt,
        publishedAt:       testimonyReviews.publishedAt,
        publishedBy:       testimonyReviews.publishedBy,
        reviewCreatedAt:   testimonyReviews.createdAt,
        reviewUpdatedAt:   testimonyReviews.updatedAt,
      })
      .from(testimonies)
      .innerJoin(users, eq(testimonies.telegramId, users.telegramId))
      .innerJoin(testimonyReviews, eq(testimonyReviews.testimonyId, testimonies.id))
      .where(eq(testimonies.id, id))

    if (!row) return null

    const chunkRows = await db
      .select()
      .from(chunks)
      .where(eq(chunks.testimonyId, id))
      .orderBy(chunks.createdAt)

    return {
      id:         row.id,
      telegramId: row.telegramId,
      language:   row.language,
      createdAt:  row.createdAt!,
      review: {
        id:            row.reviewId,
        testimonyId:   row.id,
        status:        row.reviewStatus as 'new' | 'summarized' | 'published',
        aiSummary:     row.aiSummary,
        editedVersion: row.editedVersion,
        summarizedAt:  row.summarizedAt,
        publishedAt:   row.publishedAt,
        publishedBy:   row.publishedBy,
        createdAt:     row.reviewCreatedAt!,
        updatedAt:     row.reviewUpdatedAt!,
      },
      chunks: chunkRows.map(c => ({
        id:          c.id,
        testimonyId: c.testimonyId,
        text:        c.text,
        createdAt:   c.createdAt!,
      })),
    }
  }

  async testimonyExists(id: string): Promise<boolean> {
    const [row] = await db
      .select({ id: testimonies.id })
      .from(testimonies)
      .where(eq(testimonies.id, id))
      .limit(1)
    return !!row
  }

  async reviewExists(testimonyId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: testimonyReviews.id })
      .from(testimonyReviews)
      .where(eq(testimonyReviews.testimonyId, testimonyId))
      .limit(1)
    return !!row
  }

  async createReview(testimonyId: string): Promise<TestimonyReview> {
    const [row] = await db
      .insert(testimonyReviews)
      .values({ testimonyId, status: 'new' })
      .returning()
    return this.mapReview(row)
  }

  async updateReview(
    testimonyId: string,
    data: Partial<Pick<TestimonyReview, 'status' | 'aiSummary' | 'editedVersion' | 'summarizedAt' | 'publishedAt' | 'publishedBy' | 'updatedAt'>>
  ): Promise<TestimonyReview> {
    const [row] = await db
      .update(testimonyReviews)
      .set({
        ...(data.status !== undefined      && { status:        data.status }),
        ...(data.aiSummary !== undefined   && { aiSummary:     data.aiSummary }),
        ...(data.editedVersion !== undefined && { editedVersion: data.editedVersion }),
        ...(data.summarizedAt !== undefined && { summarizedAt:  data.summarizedAt }),
        ...(data.publishedAt !== undefined  && { publishedAt:   data.publishedAt }),
        ...(data.publishedBy !== undefined  && { publishedBy:   data.publishedBy }),
        updatedAt: new Date(),
      })
      .where(eq(testimonyReviews.testimonyId, testimonyId))
      .returning()
    return this.mapReview(row)
  }

  private mapReview(row: typeof testimonyReviews.$inferSelect): TestimonyReview {
    return {
      id:            row.id,
      testimonyId:   row.testimonyId,
      status:        row.status as 'new' | 'summarized' | 'published',
      aiSummary:     row.aiSummary,
      editedVersion: row.editedVersion,
      summarizedAt:  row.summarizedAt,
      publishedAt:   row.publishedAt,
      publishedBy:   row.publishedBy,
      createdAt:     row.createdAt!,
      updatedAt:     row.updatedAt!,
    }
  }
}
