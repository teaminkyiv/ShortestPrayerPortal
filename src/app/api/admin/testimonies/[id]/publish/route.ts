// src/app/api/admin/testimonies/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { publishTestimony } from '@/application/testimony/PublishTestimonyUseCase'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getTokenFromRequest(req)
  if (!token || !(await verifySession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
