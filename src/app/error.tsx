'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-screen"><p className="eyebrow">Atlas</p><h1>Não foi possível abrir o painel.</h1><p>Tente novamente. Se o problema continuar, confira a configuração do servidor.</p><button className="button primary" onClick={reset}>Tentar novamente</button><Link className="text-link" href="/configuracoes">Ver configuração</Link></main>;
}
