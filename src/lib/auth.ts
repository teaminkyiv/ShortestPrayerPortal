import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET!)
}

export async function createSession(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export function getSessionCookieOptions(isProduction: boolean) {
  return {
    name:     COOKIE_NAME,
    httpOnly: true,
    secure:   isProduction,
    sameSite: 'strict' as const,
    maxAge:   MAX_AGE_SECONDS,
    path:     '/',
  }
}

export function getTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE_NAME)?.value
}
