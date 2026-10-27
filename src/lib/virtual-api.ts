import "server-only";
import { z } from "zod";
import { userRequest, VirtualError } from "./virtual-auth";
import {
  historySchema,
  marketSchema,
  operationSchema,
  stateSchema,
  walletSchema,
} from "./virtual-contracts";
export async function walletList(token: string) {
  return z
    .array(walletSchema)
    .parse(
      await userRequest(
        "/rest/v1/virtual_wallets?select=id,name,base_currency_code&order=created_at.asc",
        token,
      ),
    );
}
export async function walletState(token: string, id: string) {
  return stateSchema.parse(
    await userRequest("/rest/v1/rpc/virtual_wallet_state", token, {
      p_wallet_id: z.uuid().parse(id),
    }),
  );
}
export async function walletMarket(token: string) {
  return marketSchema.parse(
    await userRequest("/rest/v1/rpc/virtual_wallet_market", token, {}),
  );
}
export async function walletHistory(token: string, id: string, before: number) {
  return historySchema.parse(
    await userRequest("/rest/v1/rpc/virtual_wallet_history", token, {
      p_wallet_id: z.uuid().parse(id),
      p_before: z.number().int().safe().positive().parse(before),
      p_limit: 50,
    }),
  );
}
export async function createWallet(token: string, name: string, key: string) {
  const value = z.string().trim().min(1).max(80).safeParse(name);
  if (!value.success)
    throw new VirtualError(
      "request",
      "Informe um nome de carteira com até 80 caracteres.",
    );
  return z
    .uuid()
    .parse(
      await userRequest("/rest/v1/rpc/virtual_wallet_create", token, {
        p_name: value.data,
        p_key: z.uuid().parse(key),
      }),
    );
}
export async function applyOperation(
  token: string,
  id: string,
  request: unknown,
  key: string,
) {
  const parsed = operationSchema.safeParse(request);
  if (!parsed.success)
    throw new VirtualError(
      "request",
      parsed.error.issues[0]?.message ?? "Revise os dados da operação.",
    );
  return z
    .uuid()
    .parse(
      await userRequest("/rest/v1/rpc/virtual_wallet_apply", token, {
        p_wallet_id: z.uuid().parse(id),
        p_request: parsed.data,
        p_key: z.uuid().parse(key),
      }),
    );
}
