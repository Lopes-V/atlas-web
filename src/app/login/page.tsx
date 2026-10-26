import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
import { LoginForm } from '@/components/login-form';
import { authConfigured, isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/');
  return <main className="login-page"><section className="login-story"><Link href="/" aria-label="Atlas, início"><Brand/></Link><div><span className="eyebrow">Clareza para acompanhar seus investimentos</span><h1>Seu mercado.<br/>Uma nova<br/>perspectiva.</h1><p>Dados, análises e sua carteira.<br/>Tudo se conecta no Atlas.</p><div className="orbit-art" aria-hidden="true"><div/><div/><div/><ArrowUpRight/></div></div><p className="login-footnote"><ShieldCheck size={16}/> Seus dados financeiros ficam no seu ambiente.</p></section><section className="login-content"><span className="eyebrow muted">Bem-vindo ao Atlas</span><h2>Vamos olhar<br/>para o que importa.</h2><p className="muted">Entre para acompanhar seus investimentos.</p>{authConfigured() ? <LoginForm/> : <div className="setup-login"><p>Configure a senha e o segredo de sessão no servidor para habilitar o acesso aos seus dados.</p><Link className="button primary" href="/configuracoes">Ver configuração <ArrowUpRight size={16}/></Link><Link className="text-link" href="/">Explorar o painel vazio</Link></div>}<p className="login-disclaimer">Atlas é uma ferramenta de acompanhamento pessoal.<br/>As análises não constituem recomendação de investimento.</p></section></main>;
}
