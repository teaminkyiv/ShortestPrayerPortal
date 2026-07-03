import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getApiKey, setApiKey, deleteApiKey,
} from '@/infrastructure/db/repositories/ApiKeyRepository'

async function requireAuth(): Promise<NextResponse | null> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

export async function GET() {
  const denied = await requireAuth()
  if (denied) return denied

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
  const denied = await requireAuth()
  if (denied) return denied

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
  const denied = await requireAuth()
  if (denied) return denied

  const provider = req.nextUrl.searchParams.get('provider')
  if (provider !== 'anthropic' && provider !== 'openai') {
    return NextResponse.json({ error: 'provider must be anthropic or openai' }, { status: 400 })
  }

  await deleteApiKey(provider)
  return NextResponse.json({ ok: true })
}
