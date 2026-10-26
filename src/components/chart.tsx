'use client';
import { useId, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { shortDate, money } from '@/lib/finance';

export type ChartPoint = { at: string; value: string };
export function Chart({ points, currency = 'BRL', hidden = false, label = 'Evolução do patrimônio' }: { points: ChartPoint[]; currency?: string; hidden?: boolean; label?: string }) {
  const id = useId().replaceAll(':', '');
  const [hover, setHover] = useState<number | null>(null);
  const values = points.map(point => Number(point.value));
  const min = Math.min(...values), max = Math.max(...values);
  const padding = (max - min) * 0.18 || Math.abs(max) * 0.05 || 1;
  const low = min - padding, high = max + padding;
  const dates = points.map(point => Date.parse(point.at));
  const first = dates[0], last = dates.at(-1) ?? first;
  const x = (index: number) => 72 + (last === first ? 0.5 : (dates[index] - first) / (last - first)) * 794;
  const y = (index: number) => 18 + (1 - (values[index] - low) / (high - low)) * 190;
  if (points.length < 2) return <div className="chart-empty"><div className="chart-grid"/><div className="chart-empty-content"><span className="empty-icon"><ChartNoAxesCombined size={23}/></span><strong>Uma boa visão começa com dados.</strong><p>{points.length === 1 ? 'Há um registro disponível. A evolução aparece a partir do segundo.' : 'O histórico aparecerá aqui após a coleta dos primeiros registros.'}</p></div><span className="chart-empty-baseline">Histórico de registros</span></div>;
  const line = points.map((_, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(index).toFixed(2)}`).join(' ');
  const selected = hover == null ? null : points[hover];
  return <div className="chart-wrap"><svg viewBox="0 0 900 245" role="img" aria-label={label} onMouseLeave={() => setHover(null)}><title>{label}. {points.length} registros de {shortDate(points[0].at)} a {shortDate(points.at(-1)!.at)}.</title><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#008254" stopOpacity=".15"/><stop offset="100%" stopColor="#008254" stopOpacity="0"/></linearGradient></defs>{[0, 1, 2, 3].map(tick => <g key={tick}><line x1="72" x2="866" y1={18 + tick * 63.3} y2={18 + tick * 63.3} stroke="#ebebec" strokeDasharray="4 5"/><text x="0" y={22 + tick * 63.3} fill="#64666a" fontSize="10">{hidden ? '••••' : new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(high - tick * (high - low) / 3)}</text></g>)}<path d={`${line} L${x(points.length - 1)},208 L${x(0)},208 Z`} fill={`url(#${id})`}/><path d={line} fill="none" stroke="#008254" strokeWidth="2.5" strokeLinejoin="round"/>{points.map((point, index) => <circle key={`${point.at}-${index}`} cx={x(index)} cy={y(index)} r={hover === index ? 5 : 2.5} fill="#008254" onMouseEnter={() => setHover(index)}/>) }{[0, Math.floor((points.length - 1) / 2), points.length - 1].map((index, i) => <text key={i} x={x(index)} y="237" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fill="#64666a" fontSize="10">{shortDate(points[index].at)}</text>)}</svg>{selected && <div className="chart-tooltip" role="status">{shortDate(selected.at)} <strong>{hidden ? '••••••' : money(selected.value, currency)}</strong></div>}<details className="chart-data"><summary>Ver dados do gráfico</summary><div className="table-scroll"><table><thead><tr><th>Data</th><th>Valor ({currency})</th></tr></thead><tbody>{points.map((point, index) => <tr key={index}><td>{shortDate(point.at)}</td><td>{hidden ? '••••••' : money(point.value, currency)}</td></tr>)}</tbody></table></div></details></div>;
}
