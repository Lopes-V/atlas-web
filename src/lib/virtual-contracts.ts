import { z } from "zod";

// Monetary inputs never pass through JavaScript Number, including validation.
const exact = /^(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/;
const nonzero = (value: string) => /[1-9]/.test(value);
export const decimal = z
  .string()
  .regex(
    exact,
    "Use decimal positivo, até 20 inteiros e 18 casas; sem expoente.",
  );
const positive = decimal.refine(nonzero, "Informe um valor maior que zero.");
const timestamp = z.iso
  .datetime({ offset: true })
  .refine(
    (value) => Date.parse(value) <= Date.now(),
    "A data não pode estar no futuro.",
  );
const base = { occurred_at: timestamp };
const trade = {
  asset_id: z.uuid(),
  quantity: positive,
  unit_price: positive,
  fees: decimal,
};
export const operationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["DEPOSIT", "WITHDRAWAL", "FEE"]),
      ...base,
      amount: positive,
    })
    .strict(),
  z.object({ kind: z.enum(["BUY", "SELL"]), ...base, ...trade }).strict(),
  z
    .object({
      kind: z.literal("SWAP"),
      ...base,
      sell_asset_id: z.uuid(),
      sell_quantity: positive,
      sell_unit_price: positive,
      sell_fees: decimal,
      buy_asset_id: z.uuid(),
      buy_quantity: positive,
      buy_unit_price: positive,
      buy_fees: decimal,
    })
    .strict(),
  z
    .object({ kind: z.literal("REVERSAL"), ...base, reversal_of: z.uuid() })
    .strict(),
]);
export type OperationRequest = z.infer<typeof operationSchema>;
export const signedDecimal = z
  .string()
  .regex(/^-?(?:0|[1-9]\d{0,19})(?:\.\d{1,18})?$/);
export const walletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  base_currency_code: z.literal("USDT"),
});
export const historyEntrySchema = z.object({
  id: z.uuid(),
  sequence: z.number().int().safe(),
  kind: z.string(),
  occurred_at: z.string(),
  created_at: z.string(),
  request: operationSchema,
  reversed: z.boolean(),
  reversal_of: z.uuid().nullable(),
});
export const historySchema = z.object({
  operations: z.array(historyEntrySchema),
  total: z.number().int().safe(),
  next_before: z.number().int().safe().nullable(),
});
export const stateSchema = z.object({
  wallet: walletSchema,
  cash: signedDecimal,
  net_contributions: signedDecimal,
  realized_pnl: signedDecimal,
  fees: signedDecimal,
  cost_basis: signedDecimal,
  positions: z.array(
    z.object({
      asset_id: z.uuid(),
      symbol: z.string(),
      name: z.string(),
      quantity: signedDecimal,
      average_cost: signedDecimal,
      cost_basis: signedDecimal,
      price: signedDecimal.nullable(),
      observed_at: z.string().nullable(),
      market_value: signedDecimal.nullable(),
      unrealized_pnl: signedDecimal.nullable(),
      concentration_pct: signedDecimal.nullable(),
      unrealized_pnl_pct: signedDecimal.nullable().optional(),
    }),
  ),
  market_value: signedDecimal.nullable(),
  known_market_value: signedDecimal,
  unrealized_pnl: signedDecimal.nullable(),
  valuation_complete: z.boolean(),
  evaluated_at: z.string(),
  operations: z.array(historyEntrySchema),
  operations_total: z.number().int().safe(),
  next_before: z.number().int().safe().nullable(),
});
export const quoteSchema = z.object({
  price: positive,
  observed_at: z.string(),
  quality: z.string(),
  provider: z.string(),
  currency_code: z.literal("USDT"),
});
export const marketSchema = z.object({
  evaluated_at: z.string(),
  assets: z.array(
    z.object({
      id: z.uuid(),
      symbol: z.string(),
      name: z.string(),
      currency_code: z.literal("USDT"),
      quote: quoteSchema.nullable(),
    }),
  ),
});
export type WalletState = z.infer<typeof stateSchema>;
export type WalletHistory = z.infer<typeof historySchema>;
export type Market = z.infer<typeof marketSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[\\\u0000-\u0020]/.test(value))
    return "/virtual";
  try {
    const url = new URL(value, "https://local.invalid");
    if (
      url.origin !== "https://local.invalid" ||
      url.pathname !== "/virtual" ||
      url.hash
    )
      return "/virtual";
    const entries = [...url.searchParams.entries()];
    if (!entries.length) return "/virtual";
    return entries.length === 1 &&
      entries[0][0] === "carteira" &&
      z.uuid().safeParse(entries[0][1]).success
      ? `/virtual?carteira=${entries[0][1]}`
      : "/virtual";
  } catch {
    return "/virtual";
  }
}
export function usableQuote(value: unknown, now: number): boolean {
  const parsed = quoteSchema.safeParse(value);
  if (!parsed.success) return false;
  const q = parsed.data,
    age = now - Date.parse(q.observed_at);
  return (
    q.provider.toLowerCase() === "kraken" &&
    q.quality === "VALID" &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 120_000
  );
}

export function localInputToISO(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function sameOrigin(
  origin: string | null,
  host: string | null,
  protocol: string,
): boolean {
  if (!origin || !host || !["http:", "https:"].includes(protocol)) return false;
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      parsed.host === host &&
      parsed.protocol === protocol
    );
  } catch {
    return false;
  }
}
export function virtualMoney(value: string): string {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value as Intl.StringNumericLiteral)} USDT`;
}
