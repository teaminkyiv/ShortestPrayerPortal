// src/infrastructure/ai/AiSummaryService.ts

export async function generateSummary(
  chunkTexts: string[],
  language: string,
): Promise<string> {
  const content = chunkTexts.join('\n---\n')
  const prompt = `Summarize the following personal testimony in ${language === 'ru' ? 'Russian' : language === 'uk' ? 'Ukrainian' : 'English'} (2-4 paragraphs). Preserve the speaker's voice and key spiritual details.\n\n${content}`

  if (process.env.ANTHROPIC_API_KEY) {
    const { Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = msg.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Anthropic')
    return block.text
  }

  if (process.env.OPENAI_API_KEY) {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return res.choices[0].message.content ?? ''
  }

  throw new Error('No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.')
}
