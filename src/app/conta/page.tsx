import Link from "next/link";
import { redirect } from "next/navigation";
import { VirtualAccount } from "@/components/virtual-account";
import { safeReturnTo } from "@/lib/virtual-contracts";
import { safeError, virtualConfig, virtualSession } from "@/lib/virtual-auth";
export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams,
    returnTo = safeReturnTo(search.returnTo);
  let error = "",
    signedIn = false;
  try {
    virtualConfig();
    signedIn = !!(await virtualSession());
  } catch (cause) {
    error = safeError(cause);
  }
  if (signedIn) redirect(returnTo);
  return (
    <main className="virtual-account">
      <Link className="virtual-wordmark" href="/virtual">
        Atlas <span>/ carteira virtual</span>
      </Link>
      <section className="virtual-panel">
        <p className="eyebrow">Conta individual</p>
        <h1>Seu espaço, sua carteira.</h1>
        <p>
          Registre operações virtuais em USDT e acompanhe seu histórico privado.
        </p>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <VirtualAccount returnTo={returnTo} />
        )}
      </section>
      <p className="muted">
        Sem custódia, transferências ou ordens reais. A senha compartilhada do
        painel legado não dá acesso à carteira.
      </p>
    </main>
  );
}
