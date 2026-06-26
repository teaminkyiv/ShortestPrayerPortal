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

  function maskKey(raw: string): string {
    return raw.slice(0, 6) + '****' + raw.slice(-4)
  }

  const keys = []
  if (anthropic) keys.push({ provider: 'anthropic', maskedKey: maskKey(anthropic) })
  if (openai)    keys.push({ provider: 'openai',    maskedKey: maskKey(openai) })

  return NextResponse.json({ keys })
}

export async function PUT(req: NextRequest) {
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as { provider?: string; keyValue?: string }
  if (!body.provider || !body.keyValue) {
    return NextResponse.json({ error: 'provider and keyValue are required' }, { status: 400 })
  }
  if (body.provider !== 'anthropic' && body.provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await setApiKey(body.provider, body.keyValue)
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
