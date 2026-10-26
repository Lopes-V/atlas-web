import Link from 'next/link';
import { ArrowUpRight, CircleAlert, Database, Inbox, type LucideIcon } from 'lucide-react';
import { dateTime } from '@/lib/finance';

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}
export function Empty({ title = 'Ainda não há registros por aqui.', description = 'Os dados aparecerão após a próxima execução do backend.', icon: Icon = Inbox, setup = false }: { title?: string; description?: string; icon?: LucideIcon; setup?: boolean }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} strokeWidth={1.5}/></span><h3>{title}</h3><p>{description}</p>{setup && <Link className="text-link" href="/configuracoes">Configurar conexão <ArrowUpRight size={15}/></Link>}</div>;
}
export function SectionError({ message }: { message: string | null }) {
  return message ? <div role="alert" className="section-error"><CircleAlert size={18}/><span>{message}</span></div> : null;
}
const statuses: Record<string, { text: string; tone: string }> = {
  VALID: { text: 'Válido', tone: 'positive' }, valid: { text: 'Válido', tone: 'positive' },
  STALE: { text: 'Desatualizado', tone: 'neutral' }, stale: { text: 'Desatualizado', tone: 'neutral' },
  invalid: { text: 'Dado inválido', tone: 'negative' }, INVALID: { text: 'Inválido', tone: 'negative' },
  OUTLIER: { text: 'Fora do padrão', tone: 'negative' }, INCOMPLETE: { text: 'Incompleto', tone: 'neutral' }, missing: { text: 'Sem cotação', tone: 'neutral' },
  SENT: { text: 'Enviado', tone: 'positive' }, PENDING: { text: 'Pendente', tone: 'neutral' }, SUPPRESSED: { text: 'Suprimido', tone: 'neutral' }, FAILED: { text: 'Falhou', tone: 'negative' },
  RUNNING: { text: 'Em execução', tone: 'info' }, SUCCEEDED: { text: 'Concluído', tone: 'positive' }, SKIPPED: { text: 'Ignorado', tone: 'neutral' },
  NONE: { text: 'Sem sinal', tone: 'neutral' }, WATCH: { text: 'Em observação', tone: 'info' }, INTERESTING: { text: 'Interessante', tone: 'positive' }, HIGH_INTEREST: { text: 'Alto interesse', tone: 'positive' },
};
export function Badge({ status }: { status: string }) {
  const style = statuses[status] ?? { text: status, tone: 'neutral' };
  return <span className={`badge ${style.tone}`}><span/>{style.text}</span>;
}
export function DataLimit({ count, limit, noun = 'registros' }: { count: number; limit: number; noun?: string }) {
  return count >= limit ? <p className="data-limit"><Database size={13}/> Exibindo os {limit} {noun} da consulta. Há um limite de leitura por seção.</p> : null;
}
export function Timestamp({ at, prefix = 'Referência' }: { at?: string | null; prefix?: string }) {
  return <span className="timestamp">{prefix}: {dateTime(at)}{at ? ' (Brasília)' : ''}</span>;
}
export function Stat({ label, value, note, icon: Icon, children }: { label: string; value: string; note?: string; icon: LucideIcon; children?: React.ReactNode }) {
  return <article className="stat"><div className="stat-label">{label}<Icon size={17} strokeWidth={1.6}/></div><div className="stat-value">{value}</div><div className="stat-note">{children ?? note ?? 'Aguardando registros'}</div></article>;
}
export const assetTypeLabels: Record<string, string> = { STOCK: 'Ação', EQUITY: 'Ação', ETF: 'ETF', REIT: 'Fundo imobiliário', FII: 'Fundo imobiliário', FIXED_INCOME: 'Renda fixa', BOND: 'Título', CRYPTO: 'Criptoativo', INDEX: 'Índice', FUND: 'Fundo' };
