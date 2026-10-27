"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { operationSchema } from "@/lib/virtual-contracts";
import {
  requireVirtualSession,
  safeError,
  VirtualError,
} from "@/lib/virtual-auth";
import {
  applyOperation,
  createWallet,
  walletHistory,
  walletState,
} from "@/lib/virtual-api";
export type MutationResult = {
  error?: string;
  success?: string;
  walletId?: string;
  key?: string;
  rejection?: "definitive" | "uncertain";
};
export async function createWalletAction(
  _previous: MutationResult,
  form: FormData,
): Promise<MutationResult> {
  try {
    const { token } = await requireVirtualSession();
    const walletId = await createWallet(
      token,
      String(form.get("name") ?? ""),
      String(form.get("key") ?? ""),
    );
    await walletState(token, walletId);
    revalidatePath("/virtual");
    return { walletId, success: "Carteira criada.", key: randomUUID() };
  } catch (error) {
    return { error: safeError(error), key: String(form.get("key") ?? "") };
  }
}
export async function recordOperationAction(
  _previous: MutationResult,
  form: FormData,
): Promise<MutationResult> {
  let phase: "before" | "write" | "read" = "before";
  try {
    const { token } = await requireVirtualSession();
    const fields = Object.fromEntries(
      [...form.entries()].filter(([name]) => !name.startsWith("$ACTION_")),
    );
    const { key, walletId, ...request } = fields;
    const parsed = operationSchema.safeParse(request);
    if (!parsed.success)
      return {
        error:
          parsed.error.issues[0]?.message ?? "Revise os dados da operação.",
        key: String(key ?? ""),
        rejection:
          _previous.rejection === "uncertain" ? "uncertain" : "definitive",
      };
    phase = "write";
    await applyOperation(token, String(walletId), request, String(key));
    phase = "read";
    await walletState(token, String(walletId));
    revalidatePath("/virtual");
    return {
      success: "Registro confirmado no livro virtual.",
      key: randomUUID(),
    };
  } catch (error) {
    return {
      error: safeError(error),
      key: String(form.get("key") ?? ""),
      rejection:
        phase === "write" &&
        _previous.rejection !== "uncertain" &&
        error instanceof VirtualError &&
        error.transactionRejected
          ? "definitive"
          : "uncertain",
    };
  }
}
export async function historyAction(walletId: string, before: number) {
  try {
    const { token } = await requireVirtualSession();
    return { history: await walletHistory(token, walletId, before) };
  } catch (error) {
    return { error: safeError(error) };
  }
}
