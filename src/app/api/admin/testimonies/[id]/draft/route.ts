import { NextRequest, NextResponse } from 'next/server'
import { DrizzleTestimonyRepository } from '@/infrastructure/db/repositories/DrizzleTestimonyRepository'
import { saveDraft } from '@/application/testimony/SaveDraftUseCase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }          = await params
  const { editedVersion } = await req.json().catch(() => ({}))

  const repo = new DrizzleTestimonyRepository()
  await saveDraft(repo, id, editedVersion)
  return NextResponse.json({ ok: true })
}
