import { z } from 'zod';

const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/);
const quality = z.enum(['VALID', 'STALE', 'INCOMPLETE', 'OUTLIER', 'INVALID']);
export const quoteSchema = z.object({ price: decimal, provider: z.string(), currency_code: z.string(), observed_at: timestamp, quality });
export const assetSchema = z.object({
  id, symbol: z.string(), name: z.string(), asset_type: z.string(),
  market: z.object({ code: z.string(), name: z.string(), country_code: z.string().nullable() }).nullable(),
  currency: z.object({ code: z.string() }).nullable(),
  quotes: z.array(quoteSchema),
});
export const snapshotSchema = z.object({ as_of: timestamp, market_value: decimal, total_cost_basis: decimal, unrealized_pnl: decimal });
export const portfolioSchema = z.object({
  id, name: z.string(), base_currency_code: z.string(), snapshots: z.array(snapshotSchema),
  transactions: z.array(z.object({ id, asset_id: id, transaction_type: z.enum(['BUY', 'SELL']), quantity: decimal, unit_price: decimal, fees: decimal, currency_code: z.string(), occurred_at: timestamp })),
});
export const opportunitySchema = z.object({
  id, asset_id: id, level: z.enum(['NONE', 'WATCH', 'INTERESTING', 'HIGH_INTEREST']), score: decimal, evidence_count: z.number().int().nonnegative(), evaluated_at: timestamp, policy_version: z.string(),
  ai: z.object({ summary: z.string(), classification: z.string(), risks: z.array(z.string()), finished_at: timestamp }).nullable(),
});
export const alertSchema = z.object({ id, asset_id: id, channel: z.string(), status: z.enum(['PENDING', 'SENT', 'SUPPRESSED', 'FAILED']), decided_at: timestamp, sent_at: timestamp.nullable() });
export const jobSchema = z.object({ id, job_name: z.string(), status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED']), scheduled_for: timestamp, started_at: timestamp, finished_at: timestamp.nullable(), error_code: z.string().nullable() });
export const fixedIncomeSchema = z.object({ id, asset_id: id, provider_symbol: z.string(), bond_type: z.string(), indexer: z.string(), maturity_date: z.iso.date(), currency_code: z.string(), provider: z.string() });
export const fixedSnapshotSchema = z.object({ asset_id: id, provider_symbol: z.string(), reference_date: z.iso.date(), buy_rate: decimal.nullable(), buy_price: decimal.nullable(), received_at: timestamp, quality });
export const candleSchema = z.object({ observed_at: timestamp, close: decimal, quality, provider: z.string() });

export type Asset = z.infer<typeof assetSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type Alert = z.infer<typeof alertSchema>;
export type Job = z.infer<typeof jobSchema>;
export type FixedIncome = z.infer<typeof fixedIncomeSchema>;
export type FixedSnapshot = z.infer<typeof fixedSnapshotSchema>;
export type Candle = z.infer<typeof candleSchema>;
export type Section<T> = { data: T[]; error: string | null; limit: number };
export type DashboardData = {
  mode: 'setup' | 'connected'; fetchedAt: string; maxAgeSeconds: number;
  assets: Section<Asset>; portfolios: Section<Portfolio>; opportunities: Section<Opportunity>;
  alerts: Section<Alert>; jobs: Section<Job>; fixedIncome: Section<FixedIncome>; fixedSnapshots: Section<FixedSnapshot>;
};
