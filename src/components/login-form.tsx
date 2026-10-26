'use client';
import { useActionState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { login } from '@/app/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: '' });
  return <form action={action} className="login-form"><label htmlFor="password">Senha de acesso</label><div className="password-field"><LockKeyhole size={18}/><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} autoFocus placeholder="Digite sua senha"/></div>{state.error && <p role="alert" className="form-error">{state.error}</p>}<button className="button primary" disabled={pending}>{pending ? 'Entrando…' : 'Acessar meu painel'}<ArrowRight size={17}/></button><p className="small muted">Acesso pessoal. Sua sessão expira em 8 horas.</p></form>;
}
