"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VirtualWallet } from "./virtual-wallet";
import type { WalletResearch } from "@/lib/wallet-tools";
import type { Market, Wallet, WalletState } from "@/lib/virtual-contracts";

export type WalletScreenSnapshot = {
  wallets: Wallet[];
  state: WalletState | null;
  market: Market | null;
  research?: WalletResearch;
  receivedAt: string;
  createKey: string;
  operationKey: string;
};

// The server keys this boundary by requested wallet. Confirmed snapshots carry
// the verified user identity; a new identity rekeys the private child. A transient
// Auth outage retains that child hidden/inert until the same user is reverified.
// No private financial draft enters browser storage.
export function VirtualWalletScreen({
  snapshot,
  error,
  retryable,
  identity,
}: {
  snapshot: WalletScreenSnapshot | null;
  error: string;
  retryable: boolean;
  identity: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState<{
    identity: string;
    snapshot: WalletScreenSnapshot;
  } | null>(snapshot && identity ? { identity, snapshot } : null);
  if (
    snapshot &&
    identity &&
    (confirmed?.snapshot !== snapshot || confirmed.identity !== identity)
  )
    setConfirmed({ identity, snapshot });
  else if (
    confirmed &&
    ((!snapshot && !retryable) || (identity && confirmed.identity !== identity))
  )
    setConfirmed(null);
  const retained =
    snapshot && identity
      ? { identity, snapshot }
      : retryable && confirmed && (!identity || confirmed.identity === identity)
        ? confirmed
        : null;
  return (
    <>
      {error && (
        <section className="virtual-panel">
          <p role="alert">
            {retained && !identity
              ? "Não foi possível verificar sua sessão. Os rascunhos estão temporariamente ocultos e os envios pausados até confirmar o acesso."
              : retained
                ? "Não foi possível atualizar. Exibindo a última leitura confirmada; os dados podem estar desatualizados. Seus rascunhos foram preservados e novos envios estão pausados."
                : error}
          </p>
          <button
            className="button"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            {pending ? "Atualizando leitura…" : "Tentar atualizar leitura"}
          </button>
        </section>
      )}
      {retained && (
        <div hidden={!identity} inert={!identity} aria-hidden={!identity}>
          <VirtualWallet
            key={retained.identity}
            {...retained.snapshot}
            writesPaused={!!error || !identity}
          />
        </div>
      )}
    </>
  );
}
