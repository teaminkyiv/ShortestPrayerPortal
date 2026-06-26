import { NextRequest, NextResponse } from 'next/server'
import { createSession, getSessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PANEL_PASSWORD) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { password } = body as { password?: string }

  if (password !== process.env.ADMIN_PANEL_PASSWORD) {
    return NextResponse.json({ error: 'Неверный пароль' }, { status: 401 })
  }

  const token = await createSession()
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieOpts = getSessionCookieOptions(isProduction)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(cookieOpts.name, token, {
    httpOnly: cookieOpts.httpOnly,
    secure:   cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    maxAge:   cookieOpts.maxAge,
    path:     cookieOpts.path,
  })
  return response
}
