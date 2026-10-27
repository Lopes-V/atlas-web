import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { SESSION_COOKIE, verifySession, accessConfigured } from './session';

export function authConfigured(): boolean {
  return accessConfigured(process.env.ATLAS_ACCESS_PASSWORD, process.env.ATLAS_SESSION_SECRET);
}
export function sessionSecret(): string {
  return createHash('sha256').update(`${process.env.ATLAS_SESSION_SECRET}:${process.env.ATLAS_ACCESS_PASSWORD}`).digest('hex');
}
export async function isAuthenticated(): Promise<boolean> {
  if (!authConfigured()) return false;
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, sessionSecret());
}
