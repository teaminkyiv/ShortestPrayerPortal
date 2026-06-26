// src/app/api/admin/testimonies/[id]/draft/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { saveDraft } from '@/application/testimony/SaveDraftUseCase'

export async function PATCH(
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
  await saveDraft(repo, id, editedVersion)
  return NextResponse.json({ ok: true })
}
