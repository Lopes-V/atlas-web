import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'atlas-session';
export const SESSION_DURATION = 8 * 60 * 60 * 1000;
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(`atlas-session:v1:${value}`).digest('base64url');
export function createSession(secret: string, now = Date.now()): string {
  const payload = `${now + SESSION_DURATION}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${sign(payload, secret)}`;
}
export function verifySession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || token.length > 256 || secret.length < 32) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1])) return false;
  const expires = Number(parts[0]);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + SESSION_DURATION) return false;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`, secret));
  const actual = Buffer.from(parts[2]);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function passwordMatches(actual: string, expected: string): boolean {
  return timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
