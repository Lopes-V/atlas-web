"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearTokens,
  safeError,
  saveTokens,
  userRequest,
  virtualSession,
} from "@/lib/virtual-auth";
import { safeReturnTo, sameOrigin } from "@/lib/virtual-contracts";
export type AccountResult = { error?: string; message?: string };
export async function accountAction(
  _previous: AccountResult,
  form: FormData,
): Promise<AccountResult> {
  const parsed = z
    .object({
      email: z.email().max(254),
      password: z.string().min(1).max(1024),
      mode: z.enum(["login", "signup"]),
    })
    .safeParse(Object.fromEntries(form));
  // returnTo is not part of the Auth payload.
  if (!parsed.success)
    return { error: "Informe email válido e senha individual." };
  if (parsed.data.mode === "signup" && parsed.data.password.length < 8)
    return {
      error: "Use uma senha de pelo menos 8 caracteres para criar a conta.",
    };
  try {
    const { email, password, mode } = parsed.data;
    const requestHeaders = await headers(),
      origin = requestHeaders.get("origin");
    const protocol = `${requestHeaders.get("x-forwarded-proto") ?? "https"}:`;
    if (
      mode === "signup" &&
      !sameOrigin(origin, requestHeaders.get("host"), protocol)
    )
      return {
        error: "Origem de cadastro inválida. Reabra a página da sua conta.",
      };
    const signupPath = `/auth/v1/signup?redirect_to=${encodeURIComponent(`${origin}/conta`)}`;
    const response = await userRequest(
      mode === "signup" ? signupPath : "/auth/v1/token?grant_type=password",
      undefined,
      { email, password },
    );
    if (mode === "signup")
      return {
        message:
          "Se o cadastro for aceito, confira seu email para confirmação antes de entrar. Nenhuma sessão foi iniciada.",
      };
    await saveTokens(response);
  } catch (error) {
    return { error: safeError(error) };
  }
  redirect(safeReturnTo(form.get("returnTo")));
}
export async function accountLogout() {
  try {
    const session = await virtualSession();
    if (session)
      await userRequest("/auth/v1/logout", session.token, {}, "POST");
  } catch {
    /* Always clear this browser's individual session, including a revoked remote session. */
  }
  await clearTokens();
  redirect("/conta");
}
