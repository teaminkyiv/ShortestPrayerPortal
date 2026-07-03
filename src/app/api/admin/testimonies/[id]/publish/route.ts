import { NextRequest, NextResponse } from 'next/server'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { publishTestimony } from '@/application/testimony/PublishTestimonyUseCase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }          = await params
  const { editedVersion } = await req.json().catch(() => ({}))

  const repo = new DrizzleTestimonyRepository()
  try {
    const review = await publishTestimony(repo, id, editedVersion)
    return NextResponse.json({ status: review.status, publishedAt: review.publishedAt, publishedBy: review.publishedBy })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to publish'
    const status = msg.includes('already published') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
