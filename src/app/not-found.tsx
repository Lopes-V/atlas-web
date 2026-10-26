import Link from 'next/link';
export default function NotFound() {
  return <main className="error-screen"><p className="eyebrow">Atlas / 404</p><h1>Esta página saiu do radar.</h1><p>Volte à visão geral para continuar acompanhando seus investimentos.</p><Link className="button primary" href="/">Voltar para o início</Link></main>;
}
