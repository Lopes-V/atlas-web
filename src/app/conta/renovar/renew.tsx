"use client";
import { useEffect, useRef } from "react";
export function RenewSession({ returnTo }: { returnTo: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.requestSubmit();
  }, []);
  return (
    <form ref={form} action="/conta/renovar/sessao" method="post">
      <input type="hidden" name="returnTo" value={returnTo} />
      <button className="button primary">Renovar sessão</button>
    </form>
  );
}
