// src/app/api/admin/testimonies/[id]/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { generateAiSummary } from '@/application/testimony/GenerateAiSummaryUseCase'
import { NoApiKeyError } from '@/infrastructure/ai/AiSummaryService'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const repo   = new DrizzleTestimonyRepository()
    const review = await generateAiSummary(repo, id)
    return NextResponse.json({
      aiSummary:    review.aiSummary,
      summarizedAt: review.summarizedAt,
      status:       review.status,
    })
  } catch (err) {
    if (err instanceof NoApiKeyError) {
      return NextResponse.json({ error: 'no_api_key' }, { status: 422 })
    }
    console.error('Summarize error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
