import { safeReturnTo } from "@/lib/virtual-contracts";
import { RenewSession } from "./renew";
export const dynamic = "force-dynamic";
export default async function RenewalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <main className="virtual-account">
      <h1>Renovar sessão individual</h1>
      <p>A confirmação usa uma solicitação segura ao servidor.</p>
      <RenewSession returnTo={safeReturnTo((await searchParams).returnTo)} />
    </main>
  );
}
