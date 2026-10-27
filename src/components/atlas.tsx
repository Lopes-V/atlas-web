'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Activity, ArrowUpRight, Bell, ChartNoAxesCombined, ChevronRight, CircleHelp, Database, Eye, EyeOff, Globe2, LayoutDashboard, Layers, LogOut, Menu, Radio, RefreshCw, Settings2, ShieldCheck, Telescope, Wallet, X, type LucideIcon } from 'lucide-react';
import type { Candle, DashboardData, Section } from '@/lib/contracts';
import { dateTime, money, quoteState } from '@/lib/finance';
import { usePreference } from '@/lib/preferences';
import { logout } from '@/app/actions';
import { Brand } from './brand';
import { Crypto } from './crypto';
import { Overview } from './overview';
import { Markets, updateQuery } from './markets';
import { PortfolioView } from './portfolio';
import { Opportunities, Alerts, FixedIncome, System } from './records';
import { Settings, type Configuration } from './settings';

const nav: { href: string; label: string; icon: LucideIcon; group?: string }[] = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/cripto', label: 'Cripto', icon: ChartNoAxesCombined },
  { href: '/mercados', label: 'Mercados', icon: Globe2 },
  { href: '/carteira', label: 'Minha carteira', icon: Wallet },
  { href: '/oportunidades', label: 'Oportunidades', icon: Telescope },
  { href: '/renda-fixa', label: 'Renda fixa', icon: Layers },
  { href: '/alertas', label: 'Alertas', icon: Bell, group: 'Acompanhamento' },
  { href: '/sistema', label: 'Estado do sistema', icon: Activity },
];
function parseFavorites(value: string): string[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []; } catch { return []; }
}
export function Atlas({ data, route, history, configuration }: { data: DashboardData; route: string; history: Section<Candle>; configuration: Configuration }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (data.mode !== 'connected') return;
    const refresh = () => {
      if (document.hidden || !navigator.onLine || pending) return;
      startTransition(() => router.refresh());
    };
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [data.mode, pending, router]);
  const [hiddenPreference, setHidden] = usePreference('hidden', 'false');
  const hidden = hiddenPreference === 'true';
  const [favoritePreference, setFavorites] = usePreference('favorites', '[]');
  const favorites = parseFavorites(favoritePreference);
  const onFavorite = (id: string) => setFavorites(JSON.stringify(favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id]));
  const rangeParam = Number(search.get('periodo') ?? '30');
  const range = [7, 30, 90, 365].includes(rangeParam) ? rangeParam : 30;
  const setRange = (value: number) => updateQuery('periodo', String(value));
  const portfolio = data.portfolios.data.find(row => row.id === search.get('carteira')) ?? data.portfolios.data[0];
  const setPortfolio = (id: string) => updateQuery('carteira', id);
  const sectionErrors = [data.crypto, data.assets, data.portfolios, data.opportunities, data.alerts, data.jobs, data.fixedIncome, data.fixedSnapshots].some(section => Boolean(section.error));
  const currentLabel = nav.find(item => item.href === `/${route}`)?.label ?? 'Configurações';
  const connectionLabel = data.mode === 'setup' ? 'Conexão pendente' : sectionErrors ? 'Consulta com falhas' : 'Dados sincronizados';
  const common = { data, hidden, favorites, onFavorite };
  const closeMenu = () => setMobileMenu(false);
  return <div className="app-shell"><a className="skip-link" href="#conteudo">Pular para o conteúdo</a>{mobileMenu && <button className="sidebar-backdrop" onClick={closeMenu} aria-label="Fechar navegação"/>}<aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Navegação principal"><div className="sidebar-brand"><Link href="/" onClick={closeMenu} aria-label="Atlas, visão geral"><Brand/></Link><button className="icon-button mobile-close" onClick={closeMenu} aria-label="Fechar menu"><X size={20}/></button></div><span className="workspace-tag">Seu espaço de investimentos</span><div className="sidebar-divider"/><span className="nav-label">Meu workspace</span><nav>{nav.map(({ href, label, icon: Icon, group }) => <div key={href}>{group && <span className="nav-label section-label">{group}</span>}<Link className={`nav-link ${`/${route}` === href ? 'active' : ''}`} href={href} aria-current={`/${route}` === href ? 'page' : undefined} onClick={closeMenu}><Icon size={18} strokeWidth={1.6}/><span>{label}</span>{href === '/alertas' && data.alerts.data.some(row => row.status === 'PENDING') && <span className="nav-count">{data.alerts.data.filter(row => row.status === 'PENDING').length}</span>}</Link></div>)}</nav><div className="sidebar-spacer"/><div className="sidebar-tip"><span className="tip-icon"><ChartNoAxesCombined size={19}/></span><strong>Olhe além dos números.</strong><p>Uma boa análise começa<br/>com uma visão completa.</p><Link href="/sistema" onClick={closeMenu}>Conheça o seu sistema <ArrowUpRight size={14}/></Link></div><Link className={`nav-link settings-link ${route === 'configuracoes' ? 'active' : ''}`} aria-current={route === 'configuracoes' ? 'page' : undefined} href="/configuracoes" onClick={closeMenu}><Settings2 size={18} strokeWidth={1.6}/><span>Configurações</span></Link><div className="sidebar-profile"><span className="profile-avatar">EU</span><span><strong>Meu espaço</strong><small>Acesso pessoal</small></span>{configuration.access ? <form action={logout}><button className="icon-button" title="Sair" aria-label="Sair do Atlas"><LogOut size={17}/></button></form> : <Link className="icon-button" href="/login" aria-label="Acessar conta"><ChevronRight size={18}/></Link>}</div></aside><div className="main-shell"><header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={() => setMobileMenu(true)} aria-expanded={mobileMenu} aria-label="Abrir menu"><Menu size={21}/></button><span className="breadcrumb-root">Meu workspace</span><ChevronRight size={14}/><span>{currentLabel}</span></div><div className="topbar-actions"><span className={`connection-status ${sectionErrors ? 'has-error' : data.mode}`} title={`Última consulta: ${dateTime(data.fetchedAt)}`}><span/>{connectionLabel}</span><span className="topbar-separator"/><Link href="/configuracoes#sobre" className="icon-button" aria-label="Ajuda e informações"><CircleHelp size={19} strokeWidth={1.5}/></Link><Link href="/alertas" className="icon-button alert-link" aria-label="Ver alertas"><Bell size={19} strokeWidth={1.5}/>{data.alerts.data.some(row => row.status === 'PENDING') && <span/>}</Link></div></header><div className="market-strip">{data.assets.data.length > 0 ? data.assets.data.slice(0, 4).map(asset => {
    const quote = asset.quotes[0], state = quoteState(quote, Date.parse(data.fetchedAt), data.maxAgeSeconds);
    return <Link href={`/mercados?ativo=${asset.id}`} key={asset.id}><strong>{asset.symbol}</strong><span>{hidden ? '••••' : state === 'invalid' || state === 'missing' ? '—' : money(quote.price, quote.currency_code)}</span><small>{state === 'valid' ? dateTime(quote.observed_at) : state === 'stale' ? 'Histórico' : 'Sem cotação válida'}</small></Link>;
  }) : <><div><Globe2 size={14}/><strong>Brasil</strong><span>BRAPI</span></div><div><Globe2 size={14}/><strong>Estados Unidos</strong><span>Twelve Data</span></div><div><Wallet size={14}/><strong>Sua carteira</strong><span>Histórico patrimonial</span></div><div><ShieldCheck size={14}/><strong>Análises</strong><span>Baseadas em evidências</span></div></>}</div><main className="page-content" id="conteudo"><div className="workspace-toolbar"><span className="current-date" title={data.mode === 'connected' ? 'Atualização automática a cada 30 segundos enquanto a aba estiver visível' : undefined}>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(data.fetchedAt))}</span><div><button className="toolbar-button" onClick={() => setHidden(String(!hidden))} aria-pressed={hidden} title={hidden ? 'Exibir valores' : 'Ocultar valores'}>{hidden ? <EyeOff size={16}/> : <Eye size={16}/>}<span>{hidden ? 'Exibir valores' : 'Ocultar valores'}</span></button><button className="toolbar-button" onClick={() => startTransition(() => router.refresh())} disabled={pending}><RefreshCw size={15} className={pending ? 'spinning' : ''}/>{pending ? 'Atualizando…' : 'Atualizar'}</button></div></div>{data.mode === 'setup' && route !== 'configuracoes' && <div className="setup-banner"><span className="setup-banner-icon"><Database size={18}/></span><p><strong>Seu espaço está pronto. Vamos conectar os dados?</strong><span>Conecte seu ambiente para acompanhar seus investimentos por aqui.</span></p><Link href="/configuracoes">Configurar conexão <ArrowUpRight size={15}/></Link></div>}{route === '' && <Overview {...common} portfolio={portfolio} setPortfolio={setPortfolio} range={range} setRange={setRange}/>} {route === 'cripto' && <Crypto data={data} hidden={hidden}/>} {route === 'mercados' && <Markets {...common} history={history} range={range} setRange={setRange}/>} {route === 'carteira' && <PortfolioView data={data} hidden={hidden} portfolio={portfolio} setPortfolio={setPortfolio} range={range} setRange={setRange}/>} {route === 'oportunidades' && <Opportunities data={data}/>} {route === 'alertas' && <Alerts data={data}/>} {route === 'renda-fixa' && <FixedIncome data={data} hidden={hidden}/>} {route === 'sistema' && <System data={data}/>} {route === 'configuracoes' && <Settings configuration={configuration}/>}<footer className="page-footer"><span><Brand compact/> Atlas <span className="footer-divider">/</span> Seu mercado, em perspectiva.</span><span>Informação para acompanhar. Decisões com você.</span><span className="footer-source"><Radio size={12}/> Investment Bot</span></footer></main></div></div>;
}
