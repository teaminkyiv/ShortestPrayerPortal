import { eq } from 'drizzle-orm'
import { db } from '../client'
import { apiKeys } from '../schema'

export type ApiProvider = 'anthropic' | 'openai'

export async function getApiKey(provider: ApiProvider): Promise<string | null> {
  const [row] = await db
    .select({ keyValue: apiKeys.keyValue })
    .from(apiKeys)
    .where(eq(apiKeys.provider, provider))
    .limit(1)
  return row?.keyValue ?? null
}

export async function setApiKey(provider: ApiProvider, key: string): Promise<void> {
  await db
    .insert(apiKeys)
    .values({ provider, keyValue: key })
    .onConflictDoUpdate({
      target: apiKeys.provider,
      set: { keyValue: key, updatedAt: new Date() },
    })
}

export async function deleteApiKey(provider: ApiProvider): Promise<void> {
  await db.delete(apiKeys).where(eq(apiKeys.provider, provider))
}
