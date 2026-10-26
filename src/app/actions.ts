'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfigured, sessionSecret } from '@/lib/auth';
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_DURATION } from '@/lib/session';

// A single operator, bounded per-process attempt window. See README for deployment limits.
let attempts = { count: 0, resetAt: 0 };
export async function login(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
  if (!authConfigured()) return { error: 'O acesso ainda não foi configurado no servidor.' };
  const now = Date.now();
  if (now >= attempts.resetAt) attempts = { count: 0, resetAt: now + 60_000 };
  if (attempts.count >= 10) return { error: 'Muitas tentativas. Aguarde um minuto antes de tentar novamente.' };
  const password = form.get('password');
  attempts.count++;
  if (typeof password !== 'string' || password.length > 1024 || !passwordMatches(password, process.env.ATLAS_ACCESS_PASSWORD!)) return { error: 'Senha incorreta. Confira e tente novamente.' };
  attempts.count = 0;
  (await cookies()).set(SESSION_COOKIE, createSession(sessionSecret()), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DURATION / 1000 });
  redirect('/');
}
export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
