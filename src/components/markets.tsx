'use client';
import Link from 'next/link';
import { ArrowLeft, Download, Search, Star, X, ScanLine } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import type { Candle, Section } from '@/lib/contracts';
import { money, percent, priceChange, quoteState, toCsv, dateTime } from '@/lib/finance';
import type { CommonViewProps } from './overview';
import { RangeControl } from './overview';
import { AssetTable } from './asset-table';
import { Chart } from './chart';
import { assetTypeLabels, Badge, DataLimit, Empty, SectionError, Timestamp } from './ui';

export function updateQuery(key: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  window.history.replaceState(null, '', url);
}
export function downloadCsv(name: string, headers: string[], rows: (string | number | null)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function Markets({ data, hidden, favorites, onFavorite, history, range, setRange }: CommonViewProps & { history: Section<Candle>; range: number; setRange: (days: number) => void }) {
  const search = useSearchParams();
  const query = search.get('q') ?? '', market = search.get('mercado') ?? '', type = search.get('tipo') ?? '', favoriteOnly = search.get('favoritos') === '1';
  const selected = data.assets.data.find(asset => asset.id === search.get('ativo'));
  const now = Date.parse(data.fetchedAt);
  const markets = Array.from(new Map(data.assets.data.flatMap(asset => asset.market ? [[asset.market.code, asset.market.name] as const] : [])).entries());
  const types = Array.from(new Set(data.assets.data.map(asset => asset.asset_type)));
  const filtered = data.assets.data.filter(asset => `${asset.symbol} ${asset.name}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) && (!market || asset.market?.code === market) && (!type || asset.asset_type === type) && (!favoriteOnly || favorites.includes(asset.id)));
  function exportAssets() {
    downloadCsv('atlas-mercados.csv', ['Ativo', 'Nome', 'Moeda', 'Preço observado', 'Qualidade', 'Referência UTC', 'Fonte'], filtered.map(asset => {
      const quote = asset.quotes[0], state = quoteState(quote, now, data.maxAgeSeconds);
      return [asset.symbol, asset.name, quote?.currency_code ?? null, state === 'invalid' || state === 'missing' ? null : quote?.price ?? null, state, quote?.observed_at ?? null, quote?.provider ?? null];
    }));
  }
  if (selected) {
    const quote = selected.quotes[0], state = quoteState(quote, now, data.maxAgeSeconds);
    const change = state === 'valid' ? priceChange(quote, selected.quotes[1]) : null;
    const validHistory = history.data.filter(point => point.quality === 'VALID' && Date.parse(point.observed_at) <= now && Date.parse(point.observed_at) >= now - range * 86400000);
    return <><Link href="/mercados" className="back-link"><ArrowLeft size={16}/> Voltar aos mercados</Link><section className="panel asset-detail"><div className="asset-detail-heading"><span className="asset-monogram large">{selected.symbol.slice(0, 2)}</span><div><span className="eyebrow muted">{selected.market?.name ?? 'Mercado'} / {assetTypeLabels[selected.asset_type] ?? selected.asset_type}</span><h1>{selected.symbol}</h1><p>{selected.name}</p></div><button className={`button outline ${favorites.includes(selected.id) ? 'favorite-active' : ''}`} onClick={() => onFavorite(selected.id)} aria-pressed={favorites.includes(selected.id)}><Star size={16} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'}/>{favorites.includes(selected.id) ? 'Nos favoritos' : 'Adicionar aos favoritos'}</button></div><div className="asset-price"><strong>{hidden ? '••••••' : state === 'missing' || state === 'invalid' ? '—' : money(quote.price, quote.currency_code)}</strong><span className={change && Number(change) < 0 ? 'negative-text' : 'positive-text'}>{hidden ? '••••' : percent(change)}</span><Badge status={state}/></div><Timestamp at={quote?.observed_at}/><div className="detail-chart-head"><h2>Histórico de fechamento</h2><RangeControl value={range} onChange={setRange}/></div><SectionError message={history.error}/><Chart points={[...validHistory].reverse().map(point => ({ at: point.observed_at, value: point.close }))} currency={selected.currency?.code} hidden={hidden} label={`Histórico de ${selected.symbol}`}/><div className="detail-metadata"><div><span>Fonte</span><strong>{quote?.provider ?? 'Sem registro'}</strong></div><div><span>Moeda</span><strong>{selected.currency?.code ?? '—'}</strong></div><div><span>Tipo</span><strong>{assetTypeLabels[selected.asset_type] ?? selected.asset_type}</strong></div><div><span>Última observação</span><strong>{dateTime(quote?.observed_at)}</strong></div></div><p className="small muted">Somente fechamentos diários marcados como válidos, da fonte da última cotação. Até 366 registros; períodos com dados inválidos ou ausentes são omitidos. Variação entre as duas últimas coletas, sem equivalência garantida à variação diária.</p></section></>;
  }
  return <><div className="page-intro"><div><span className="eyebrow muted">Uma visão mais ampla</span><h1>Mercados</h1><p>Encontre os ativos que fazem sentido acompanhar.</p></div><button className="button outline" onClick={exportAssets} disabled={!filtered.length || hidden} title={hidden ? 'Exiba os valores para exportar' : 'Exportar ativos filtrados'}><Download size={16}/> Exportar CSV</button></div><section className="panel"><div className="filter-bar"><label className="search-field"><Search size={18}/><span className="sr-only">Buscar ativos</span><input placeholder="Buscar por ativo ou empresa" value={query} onChange={event => updateQuery('q', event.target.value)}/>{query && <button aria-label="Limpar busca" className="icon-button" onClick={() => updateQuery('q', '')}><X size={14}/></button>}</label><select aria-label="Filtrar por mercado" value={market} onChange={event => updateQuery('mercado', event.target.value)}><option value="">Todos os mercados</option>{markets.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><select aria-label="Filtrar por tipo" value={type} onChange={event => updateQuery('tipo', event.target.value)}><option value="">Todos os tipos</option>{types.map(value => <option key={value} value={value}>{assetTypeLabels[value] ?? value}</option>)}</select><button className={`button filter-favorites ${favoriteOnly ? 'active' : ''}`} aria-pressed={favoriteOnly} onClick={() => updateQuery('favoritos', favoriteOnly ? '' : '1')}><Star size={16}/> Favoritos</button></div><div className="table-caption"><span>{filtered.length} {filtered.length === 1 ? 'ativo' : 'ativos'} nesta consulta</span><span>Preços na moeda de origem</span></div><SectionError message={data.assets.error}/>{filtered.length ? <AssetTable assets={filtered} now={now} maxAge={data.maxAgeSeconds} hidden={hidden} favorites={favorites} onFavorite={onFavorite}/> : <Empty title={data.assets.data.length ? 'Nenhum ativo com esses filtros.' : 'Seu mercado começa aqui.'} description={data.assets.data.length ? 'Experimente outra busca ou remova os filtros.' : 'Os ativos e as cotações do backend aparecerão após a conexão e a coleta.'} icon={ScanLine} setup={data.mode === 'setup'}/>}<DataLimit count={data.assets.data.length} limit={data.assets.limit} noun="ativos"/></section><section className="mint-note"><span className="empty-icon"><ScanLine size={21}/></span><div><h3>O preço também tem contexto.</h3><p>Cada cotação carrega sua fonte, horário e qualidade. Dados antigos são identificados; dados inválidos não exibem preços nem variações.</p></div></section></>;
}
