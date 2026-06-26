// src/infrastructure/ai/AiSummaryService.ts
import { getApiKey } from '@/infrastructure/db/repositories/ApiKeyRepository'

export class NoApiKeyError extends Error {
  readonly code = 'no_api_key' as const
  constructor() {
    super('No AI provider API key configured')
    this.name = 'NoApiKeyError'
  }
}

export async function generateSummary(
  chunkTexts: string[],
  language: string,
): Promise<string> {
  const content = chunkTexts.join('\n---\n')
  const prompt = `Summarize the following personal testimony in ${language === 'ru' ? 'Russian' : language === 'uk' ? 'Ukrainian' : 'English'} (2-4 paragraphs). Preserve the speaker's voice and key spiritual details.\n\n${content}`

  const anthropicKey = process.env.ANTHROPIC_API_KEY || await getApiKey('anthropic')
  if (anthropicKey) {
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: anthropicKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
    return block.text
  }

  const openaiKey = process.env.OPENAI_API_KEY || await getApiKey('openai')
  if (openaiKey) {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: openaiKey })
    const res = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return res.choices[0].message.content ?? ''
  }

  throw new NoApiKeyError()
}
