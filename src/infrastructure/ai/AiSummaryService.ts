// src/infrastructure/ai/AiSummaryService.ts
import { getApiKey } from "@/infrastructure/db/repositories/ApiKeyRepository";

export class NoApiKeyError extends Error {
  readonly code = "no_api_key" as const;
  constructor() {
    super("No AI provider API key configured");
    this.name = "NoApiKeyError";
  }
}

export async function generateSummary(
  chunkTexts: string[],
  language: string,
): Promise<string> {
  const content = chunkTexts.join("\n---\n");
  const languageName =
    language === "ru" ? "Russian" : language === "uk" ? "Ukrainian" : "English";
  const prompt = `
  Write a cohesive narrative summary of this testimony in ${languageName}.
- Write as a flowing, readable story (not bullet points)
- Maximum 200 words
- Write in first person, as if the person is telling their story
- Cover naturally: who they are, their spiritual background, their inner condition before calling on the Lord, what caused them to call on Him, and what changed afterward
- Use only what was actually said — do not invent details

Respond with ONLY the summary text, no labels or headers.

Here is the testimony text to summarize:
${content}
  `;

  const anthropicKey =
    process.env.ANTHROPIC_API_KEY || (await getApiKey("anthropic"));
  if (anthropicKey) {
    const { Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: anthropicKey });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    if (block.type !== "text")
      throw new Error("Unexpected response type from Anthropic");
    return block.text;
  }

  const openaiKey = process.env.OPENAI_API_KEY || (await getApiKey("openai"));
  if (openaiKey) {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: openaiKey });
    const res = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
    });
    return res.choices[0].message.content ?? "";
  }

  throw new NoApiKeyError();
}
