"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { api } from "@/lib/api";
import { useT } from "@/i18n/provider";

export default function ConfirmPage() {
  const t = useT();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    void api("/api/v1/auth/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setState("ok"))
      .catch(() => setState("error"));
  }, [token]);

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">{t("Confirmar email")}</h1>
      <p className="mt-6 text-sm text-mute" role="status">
        {state === "pending" && t("A confirmar…")}
        {state === "ok" && t("Email confirmado. Já podes usar a conta.")}
        {state === "error" && t("Este link já não é válido.")}
      </p>
      <p className="mt-4 text-sm">
        <Link href="/" className="text-mute hover:text-mist">
          {t("Entrar")}
        </Link>
      </p>
    </AuthFrame>
  );
}
