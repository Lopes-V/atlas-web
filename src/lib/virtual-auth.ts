import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";

export const ACCESS_COOKIE = "atlas-virtual-access";
export const REFRESH_COOKIE = "atlas-virtual-refresh";
export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
export class VirtualError extends Error {
  constructor(
    public readonly code: "setup" | "auth" | "unavailable" | "request",
    message: string,
  ) {
    super(message);
  }
}
export function virtualConfig() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !key.startsWith("sb_publishable_"))
    throw new VirtualError(
      "setup",
      "O acesso individual ainda não foi configurado neste ambiente.",
    );
  return { url: url.replace(/\/$/, ""), key };
}
export function safeError(error: unknown): string {
  return error instanceof VirtualError
    ? error.message
    : "Não foi possível confirmar a solicitação. Tente novamente com a mesma chave; não duplique o registro.";
}
export async function userRequest(
  path: string,
  token?: string,
  body?: unknown,
  method?: string,
): Promise<unknown> {
  const { url, key } = virtualConfig();
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        apikey: key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new VirtualError(
      "unavailable",
      "Serviço temporariamente indisponível. Tente novamente com a mesma chave.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403)
      throw new VirtualError(
        "auth",
        "Sessão inválida ou acesso recusado. Entre novamente na sua conta individual.",
      );
    if (["PGRST202", "PGRST205", "42P01", "42883"].includes(data?.code))
      throw new VirtualError(
        "setup",
        "A carteira virtual ainda não foi ativada neste ambiente. O administrador precisa concluir a configuração.",
      );
    if (response.status >= 500)
      throw new VirtualError(
        "unavailable",
        "Serviço temporariamente indisponível. Tente novamente com a mesma chave.",
      );
    if (response.status === 429)
      throw new VirtualError(
        "request",
        "Muitas tentativas. Aguarde um minuto antes de tentar novamente.",
      );
    if (path.includes("/auth/"))
      throw new VirtualError(
        "request",
        "Não foi possível entrar ou cadastrar. Confira email, senha e a confirmação do email.",
      );
    // PostgreSQL messages may contain payloads. Display only reviewed categories.
    const message =
      typeof data?.message === "string" ? data.message.toLowerCase() : "";
    if (/idempot|payload|request.*conflict/.test(message))
      throw new VirtualError(
        "request",
        "Esta chave já pertence a outra solicitação. Restaure os dados anteriores ou inicie um novo registro.",
      );
    if (/insufficient|negative|balance|position/.test(message))
      throw new VirtualError(
        "request",
        "Saldo ou posição insuficiente no histórico. Revise também operações retroativas e estornos.",
      );
    throw new VirtualError(
      "request",
      "Registro recusado. Confira valores, ativos, datas e histórico antes de tentar novamente com a mesma chave.",
    );
  }
  if (response.status === 204) return null;
  return response.json();
}
const userSchema = z.object({ id: z.uuid(), email: z.string().optional() });
export async function verifyAccess(token: string) {
  try {
    const user = userSchema.parse(await userRequest("/auth/v1/user", token));
    return { user, token };
  } catch (error) {
    if (error instanceof VirtualError && error.code === "auth") return null;
    throw error;
  }
}
const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive().max(86400),
});
export async function saveTokens(value: unknown) {
  const tokens = tokensSchema.parse(value);
  const verified = await verifyAccess(tokens.access_token);
  if (!verified)
    throw new VirtualError(
      "auth",
      "Não foi possível verificar a sessão individual.",
    );
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, tokens.access_token, {
    ...cookieOptions,
    maxAge: tokens.expires_in,
  });
  jar.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...cookieOptions,
    maxAge: 30 * 86400,
  });
  return verified;
}
export async function clearTokens() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE])
    jar.set(name, "", { ...cookieOptions, maxAge: 0 });
}
export async function virtualSession(refresh = false) {
  const jar = await cookies(),
    access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    const verified = await verifyAccess(access);
    if (verified) return verified;
  }
  if (refresh && jar.get(REFRESH_COOKIE)?.value)
    return saveTokens(
      await userRequest("/auth/v1/token?grant_type=refresh_token", undefined, {
        refresh_token: jar.get(REFRESH_COOKIE)!.value,
      }),
    );
  return null;
}
export async function requireVirtualSession() {
  const session = await virtualSession(true);
  if (!session)
    throw new VirtualError(
      "auth",
      "Entre na sua conta individual para continuar.",
    );
  return session;
}
