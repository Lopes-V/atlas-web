'use client';
import Link from 'next/link';
import { ArrowUpRight, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { money, percent, priceChange, quoteState } from '@/lib/finance';
import type { Asset } from '@/lib/contracts';
import { assetTypeLabels, Badge, Timestamp } from './ui';

export function AssetTable({ assets, now, maxAge, hidden, favorites, onFavorite }: { assets: Asset[]; now: number; maxAge: number; hidden: boolean; favorites: string[]; onFavorite: (id: string) => void }) {
  return <div className="table-scroll"><table className="asset-table"><thead><tr><th><span className="sr-only">Favorito</span></th><th>Ativo</th><th>Mercado</th><th>Último preço</th><th>Entre coletas</th><th>Qualidade e referência</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{assets.map(asset => {
    const quote = asset.quotes[0];
    const state = quoteState(quote, now, maxAge);
    const variation = state === 'valid' ? priceChange(quote, asset.quotes[1]) : null;
    const down = variation != null && Number(variation) < 0;
    return <tr key={asset.id}><td><button className={`star-button ${favorites.includes(asset.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(asset.id) ? 'Remover' : 'Adicionar'} ${asset.symbol} ${favorites.includes(asset.id) ? 'dos' : 'aos'} favoritos`} aria-pressed={favorites.includes(asset.id)} onClick={() => onFavorite(asset.id)}><Star size={17} fill={favorites.includes(asset.id) ? 'currentColor' : 'none'}/></button></td><td><Link href={`/mercados?ativo=${asset.id}`} className="asset-identity"><span className="asset-monogram">{asset.symbol.slice(0, 2)}</span><span><strong>{asset.symbol}</strong><small>{asset.name}</small></span></Link></td><td><span className="table-main">{asset.market?.country_code ?? asset.market?.code ?? '—'}</span><small>{assetTypeLabels[asset.asset_type] ?? asset.asset_type}</small></td><td><strong className="number">{hidden ? '••••••' : state === 'invalid' || state === 'missing' ? '—' : money(quote.price, quote.currency_code)}</strong><small>{state === 'stale' ? 'Preço histórico' : quote?.currency_code ?? 'Sem preço'}</small></td><td><span className={`variation ${variation == null ? 'muted' : down ? 'negative-text' : 'positive-text'}`}>{hidden ? '••••' : variation == null ? '—' : <>{down ? <ArrowDown size={13}/> : <ArrowUp size={13}/>} {percent(variation)}</>}</span></td><td><Badge status={state}/><small><Timestamp at={quote?.observed_at} prefix="Coleta"/></small></td><td><Link href={`/mercados?ativo=${asset.id}`} className="icon-button" aria-label={`Ver detalhes de ${asset.symbol}`}><ArrowUpRight size={18}/></Link></td></tr>;
  })}</tbody></table></div>;
}
