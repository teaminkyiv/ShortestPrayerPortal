import {
  pgTable, uuid, bigint, text, timestamp,
} from 'drizzle-orm/pg-core'

// Read-only tables owned by the bot — never ALTER
export const users = pgTable('users', {
  telegramId: bigint('telegram_id', { mode: 'number' }).primaryKey(),
  language:   text('language').notNull(),
  firstName:  text('first_name'),
  lastName:   text('last_name'),
  username:   text('username'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const testimonies = pgTable('testimonies', {
  id:         uuid('id').primaryKey().defaultRandom(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull()
                .references(() => users.telegramId),
  status:     text('status').notNull().default('not_started'),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const chunks = pgTable('chunks', {
  id:          uuid('id').primaryKey().defaultRandom(),
  testimonyId: uuid('testimony_id').notNull().references(() => testimonies.id),
  text:        text('text').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// Admin panel table — created via migration
export const testimonyReviews = pgTable('testimony_reviews', {
  id:            uuid('id').primaryKey().defaultRandom(),
  testimonyId:   uuid('testimony_id').notNull().unique().references(() => testimonies.id),
  status:        text('status').notNull().default('new'),
  aiSummary:     text('ai_summary'),
  editedVersion: text('edited_version'),
  summarizedAt:  timestamp('summarized_at'),
  publishedAt:   timestamp('published_at'),
  publishedBy:   text('published_by'),
  createdAt:     timestamp('created_at').defaultNow(),
  updatedAt:     timestamp('updated_at').defaultNow(),
})

export const apiKeys = pgTable('api_keys', {
  id:        uuid('id').primaryKey().defaultRandom(),
  provider:  text('provider').notNull().unique(), // 'anthropic' | 'openai'
  keyValue:  text('key_value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
