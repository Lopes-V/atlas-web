"use client";
import { useActionState, useState } from "react";
import { accountAction } from "@/app/conta/actions";
export function VirtualAccount({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState("login");
  const [state, action, pending] = useActionState(accountAction, {});
  return (
    <>
      <div className="virtual-tabs">
        <button
          type="button"
          aria-pressed={mode === "login"}
          onClick={() => setMode("login")}
        >
          Entrar na conta
        </button>
        <button
          type="button"
          aria-pressed={mode === "signup"}
          onClick={() => setMode("signup")}
        >
          Criar conta
        </button>
      </div>
      <form action={action} className="virtual-form">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label>
          Senha individual
          <input
            name="password"
            type="password"
            minLength={mode === "signup" ? 8 : 1}
            maxLength={1024}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
          />
        </label>
        {state.error && (
          <p role="alert" className="form-error">
            {state.error}
          </p>
        )}
        {state.message && <p role="status">{state.message}</p>}
        <button className="button primary" disabled={pending}>
          {pending ? "Aguarde…" : mode === "signup" ? "Cadastrar" : "Entrar"}
        </button>
      </form>
      <p className="muted">
        O cadastro pode exigir confirmação por email. Use a identidade
        individual da carteira.
      </p>
    </>
  );
}
