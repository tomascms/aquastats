"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CoachShell } from "@/components/shells/coach-shell";
import { homeFor } from "@/lib/auth";
import { useAppState, useAuthBoot } from "@/lib/store";

export default function CoachLayout({ children }: LayoutProps<"/coach">) {
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();

  useEffect(() => {
    if (bootstrapped && role !== "coach") router.replace(homeFor(role));
  }, [bootstrapped, role, router]);

  if (!bootstrapped) {
    return <p className="px-5 py-16 text-center text-sm text-mute">A validar sessão…</p>;
  }
  if (bootError) {
    return <p className="px-5 py-16 text-center text-sm text-coral">{bootError}</p>;
  }
  if (role !== "coach") {
    return <p className="px-5 py-16 text-center text-sm text-mute">A redirecionar…</p>;
  }

  return <CoachShell>{children}</CoachShell>;
}
