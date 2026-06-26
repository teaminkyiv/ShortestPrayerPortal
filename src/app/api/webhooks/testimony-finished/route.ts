// src/app/api/webhooks/testimony-finished/route.ts
import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  const expected = process.env.WEBHOOK_SECRET
  if (!secret || !expected || !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { testimonyId } = body as { testimonyId?: string }

  if (!testimonyId) {
    return NextResponse.json({ error: 'Missing testimonyId' }, { status: 400 })
  }

  const repo = new DrizzleTestimonyRepository()

  const exists = await repo.testimonyExists(testimonyId)
  if (!exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const alreadyReviewed = await repo.reviewExists(testimonyId)
  if (!alreadyReviewed) {
    await repo.createReview(testimonyId)
  }

  return NextResponse.json({ ok: true })
}
