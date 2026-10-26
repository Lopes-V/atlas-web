import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { SESSION_COOKIE, verifySession } from './session';

export function authConfigured(): boolean {
  return (process.env.ATLAS_ACCESS_PASSWORD?.length ?? 0) >= 12 && (process.env.ATLAS_SESSION_SECRET?.length ?? 0) >= 32;
}
export function sessionSecret(): string {
  return createHash('sha256').update(`${process.env.ATLAS_SESSION_SECRET}:${process.env.ATLAS_ACCESS_PASSWORD}`).digest('hex');
}
export async function isAuthenticated(): Promise<boolean> {
  if (!authConfigured()) return false;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
}
