import { generateToken, hashSessionToken } from './passwords';
import type { SessionRecord } from '../db/store';

export const SESSION_COOKIE = 'makaan_session';

export interface CreatedSession {
  token: string;
  record: SessionRecord;
}

export function createSession(userId: string, secret: string, ttlMs: number): CreatedSession {
  const token = generateToken();
  const now = new Date();
  const record: SessionRecord = {
    tokenHash: hashSessionToken(token, secret),
    userId,
    csrfToken: generateToken(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
  return { token, record };
}

export function sessionCookieOptions(isProduction: boolean, ttlMs: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
    maxAge: Math.floor(ttlMs / 1000),
  };
}
