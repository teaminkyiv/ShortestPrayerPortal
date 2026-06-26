// scripts/seed-test-db.ts
import { config } from 'dotenv'
config({ path: '.env.test' })
config({ path: '.env' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { users, testimonies, chunks, testimonyReviews } from '../src/infrastructure/db/schema'
import { eq } from 'drizzle-orm'

const TEST_TELEGRAM_ID = 999_000_001

const IDS = {
  TESTIMONY:          process.env.TEST_TESTIMONY_ID!,
  NEW_TESTIMONY:      process.env.TEST_NEW_TESTIMONY_ID!,
  SUMMARIZED:         process.env.TEST_SUMMARIZED_TESTIMONY_ID!,
  FOR_PUBLISH:        process.env.TEST_FOR_PUBLISH_TESTIMONY_ID!,
  FRESH_SUMMARIZED:   process.env.TEST_FRESH_SUMMARIZED_TESTIMONY_ID!,
  PUBLISHED:          process.env.TEST_PUBLISHED_TESTIMONY_ID!,
}

async function seed() {
  const sql = neon(process.env.DATABASE_URL!)
  const db  = drizzle(sql)

  // Upsert test user
  await db.insert(users)
    .values({ telegramId: TEST_TELEGRAM_ID, language: 'en' })
    .onConflictDoNothing()

  // Seed each testimony + review + chunks
  const records: Array<{
    id:            string
    reviewStatus:  string
    aiSummary:     string | null
    editedVersion: string | null
    summarizedAt:  Date | null
    publishedAt:   Date | null
    publishedBy:   string | null
    numChunks:     number
  }> = [
    {
      id:            IDS.TESTIMONY,
      reviewStatus:  'new',
      aiSummary:     'Test summary text',
      editedVersion: null,
      summarizedAt:  null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     3,
    },
    {
      id:            IDS.NEW_TESTIMONY,
      reviewStatus:  'new',
      aiSummary:     null,
      editedVersion: null,
      summarizedAt:  null,
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.SUMMARIZED,
      reviewStatus:  'summarized',
      aiSummary:     'AI generated summary',
      editedVersion: 'Previously saved draft text',
      summarizedAt:  new Date('2026-01-15T10:00:00Z'),
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.FOR_PUBLISH,
      reviewStatus:  'summarized',
      aiSummary:     'Summary for publish',
      editedVersion: null,
      summarizedAt:  new Date('2026-01-15T10:00:00Z'),
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.FRESH_SUMMARIZED,
      reviewStatus:  'summarized',
      aiSummary:     'Fresh AI summary to prefill',
      editedVersion: null,
      summarizedAt:  new Date('2026-01-15T10:00:00Z'),
      publishedAt:   null,
      publishedBy:   null,
      numChunks:     2,
    },
    {
      id:            IDS.PUBLISHED,
      reviewStatus:  'published',
      aiSummary:     'Published summary',
      editedVersion: 'Final published version',
      summarizedAt:  null,
      publishedAt:   new Date('2026-01-01T12:00:00Z'),
      publishedBy:   'admin',
      numChunks:     2,
    },
  ]

  for (const r of records) {
    // testimony
    await db.insert(testimonies)
      .values({ id: r.id, telegramId: TEST_TELEGRAM_ID, status: 'finished' })
      .onConflictDoNothing()

    // chunks
    for (let i = 0; i < r.numChunks; i++) {
      await db.insert(chunks)
        .values({
          testimonyId: r.id,
          text:        `Chunk ${i + 1} of testimony ${r.id.slice(0, 8)}`,
          createdAt:   new Date(Date.now() + i * 1000),
        })
        .onConflictDoNothing()
    }

    // review — delete and re-insert to reset state after mutating tests
    await db.delete(testimonyReviews).where(eq(testimonyReviews.testimonyId, r.id))
    await db.insert(testimonyReviews).values({
      testimonyId:   r.id,
      status:        r.reviewStatus,
      aiSummary:     r.aiSummary,
      editedVersion: r.editedVersion,
      summarizedAt:  r.summarizedAt,
      publishedAt:   r.publishedAt,
      publishedBy:   r.publishedBy,
    })
  }

  console.log('Seed complete.')
}

seed().catch(err => { console.error(err); process.exit(1) })
