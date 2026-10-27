import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { accountLogout } from "@/app/conta/actions";
import {
  REFRESH_COOKIE,
  safeError,
  virtualConfig,
  virtualSession,
  VirtualError,
} from "@/lib/virtual-auth";
import { walletList, walletMarket, walletState } from "@/lib/virtual-api";
import { VirtualWalletScreen } from "@/components/virtual-wallet-screen";
import type { Market, Wallet, WalletState } from "@/lib/virtual-contracts";
export const dynamic = "force-dynamic";
export default async function VirtualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  let session,
    error = "",
    retryable = false;
  try {
    virtualConfig();
    session = await virtualSession();
  } catch (cause) {
    error = safeError(cause);
    retryable = cause instanceof VirtualError && cause.code === "unavailable";
  }
  const selected = (await searchParams).carteira;
  if (!session && !error) {
    const path =
      selected && z.uuid().safeParse(selected).success
        ? `/virtual?carteira=${selected}`
        : "/virtual";
    if ((await cookies()).has(REFRESH_COOKIE))
      redirect(`/conta/renovar?returnTo=${encodeURIComponent(path)}`);
    redirect(`/conta?returnTo=${encodeURIComponent(path)}`);
  }
  let wallets: Wallet[] = [],
    state: WalletState | null = null,
    market: Market | null = null;
  if (session) {
    try {
      wallets = await walletList(session.token);
      const wallet = selected
        ? wallets.find((row) => row.id === selected)
        : wallets[0];
      if (selected && !wallet)
        error =
          "Esta carteira não pertence à sua conta ou não está disponível.";
      else {
        market = await walletMarket(session.token);
        if (wallet) state = await walletState(session.token, wallet.id);
      }
    } catch (cause) {
      error = safeError(cause);
      retryable = cause instanceof VirtualError && cause.code === "unavailable";
    }
  }
  return (
    <div className="virtual-shell">
      <header className="virtual-header">
        <Link href="/virtual" className="virtual-wordmark">
          Atlas <span>/ carteira virtual</span>
        </Link>
        <div>
          <span>{session?.user.email}</span>
          {session && (
            <form action={accountLogout}>
              <button className="toolbar-button">
                Sair da conta individual
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="virtual-main">
        <div className="virtual-hero">
          <p className="eyebrow">Registro pessoal · USDT</p>
          <h1>Carteira virtual</h1>
          <p>
            Suas posições em perspectiva. Cada lançamento é declarado por você.
          </p>
          <small>
            Sem conexão com corretoras, custódia ou ordens reais. USDT não é USD
            ou BRL.
          </small>
        </div>
        <VirtualWalletScreen
          key={selected ?? "default"}
          identity={session?.user.id ?? null}
          snapshot={
            error
              ? null
              : {
                  wallets,
                  state,
                  market,
                  createKey: randomUUID(),
                  operationKey: randomUUID(),
                }
          }
          error={error}
          retryable={retryable}
        />
        <footer className="virtual-footer">
          Atlas · Dados privados da conta individual. Horários de Brasília.
          Cotações Kraken válidas por até 120 segundos. Atualização de leitura a
          cada 30 segundos com a aba visível.
        </footer>
      </main>
    </div>
  );
}
