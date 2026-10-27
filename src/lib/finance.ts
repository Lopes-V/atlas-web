import Decimal from 'decimal.js';

export type QuoteLike = { price: string; provider: string; currency_code: string; observed_at: string; quality: string };
export function quoteState(quote: Pick<QuoteLike, 'quality' | 'observed_at'> | null | undefined, now: number, maxAgeSeconds: number): 'valid' | 'stale' | 'invalid' | 'missing' {
  if (!quote) return 'missing';
  const time = Date.parse(quote.observed_at);
  if (!Number.isFinite(time) || time > now + 60_000) return 'invalid';
  if (quote.quality === 'STALE' || (quote.quality === 'VALID' && now - time > maxAgeSeconds * 1000)) return 'stale';
  return quote.quality === 'VALID' ? 'valid' : 'invalid';
}
export function priceChange(current: QuoteLike | undefined, previous: QuoteLike | undefined): string | null {
  if (!current || !previous || current.quality !== 'VALID' || previous.quality !== 'VALID' || current.provider !== previous.provider || current.currency_code !== previous.currency_code || Date.parse(current.observed_at) <= Date.parse(previous.observed_at)) return null;
  const base = new Decimal(previous.price);
  return base.greaterThan(0) ? new Decimal(current.price).minus(base).div(base).times(100).toString() : null;
}
export function portfolioReturn(value: string, cost: string): string | null {
  const base = new Decimal(cost);
  return base.greaterThan(0) ? new Decimal(value).minus(base).div(base).times(100).toString() : null;
}
export function latestBy<T>(records: readonly T[], key: (record: T) => string, timestamp: (record: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const record of records) {
    const previous = result.get(key(record));
    if (!previous || Date.parse(timestamp(record)) > Date.parse(timestamp(previous))) result.set(key(record), record);
  }
  return result;
}
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (input: string | number | null) => {
    let value = String(input ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(value)) value = "'" + value;
    return '"' + value.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
}
export function money(value: string | null | undefined, currency = 'BRL'): string {
  if (value == null) return '—';
  try {
    // Intl accepts decimal text directly; converting to Number loses cents at database precision.
    const exact = new Decimal(value).toFixed() as Intl.StringNumericLiteral;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(exact);
  } catch {
    return `${new Decimal(value).toFixed(2)} ${currency}`;
  }
}
export function percent(value: string | null | undefined, signed = true): string {
  if (value == null) return '—';
  const decimal = new Decimal(value);
  return `${signed && decimal.greaterThan(0) ? '+' : ''}${decimal.toFixed(2).replace('.', ',')}%`;
}
export function dateTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
export function shortDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short' }).format(new Date(value));
}
