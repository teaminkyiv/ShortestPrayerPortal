// src/app/api/admin/settings/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifySession } from '@/lib/auth'
import {
  getApiKey, setApiKey, deleteApiKey,
} from '@/infrastructure/db/repositories/ApiKeyRepository'

async function authenticate(req: NextRequest): Promise<boolean> {
  const token = getTokenFromRequest(req)
  return !!token && await verifySession(token)
}

export async function GET(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [anthropic, openai] = await Promise.all([
    getApiKey('anthropic'),
    getApiKey('openai'),
  ])

  return NextResponse.json({
    anthropic: !!anthropic,
    openai:    !!openai,
  })
}

export async function PUT(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { provider?: string; key?: string }
  if (!body.provider || !body.key) {
    return NextResponse.json({ error: 'provider and key are required' }, { status: 400 })
  }
  if (body.provider !== 'anthropic' && body.provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await setApiKey(body.provider, body.key)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const provider = req.nextUrl.searchParams.get('provider')
  if (provider !== 'anthropic' && provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await deleteApiKey(provider)
  return NextResponse.json({ ok: true })
}
