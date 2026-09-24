"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SwimmerShell } from "@/components/shells/swimmer-shell";
import { homeFor } from "@/lib/auth";
import { useAppState, useAuthBoot } from "@/lib/store";

export default function SwimmerLayout({ children }: LayoutProps<"/swimmer">) {
  const router = useRouter();
  const { role } = useAppState();
  const { bootstrapped, bootError } = useAuthBoot();

  useEffect(() => {
    if (bootstrapped && role !== "swimmer") router.replace(homeFor(role));
  }, [bootstrapped, role, router]);

  if (!bootstrapped) {
    return <p className="px-5 py-16 text-center text-sm text-mute">A validar sessão…</p>;
  }
  if (bootError) {
    return <p className="px-5 py-16 text-center text-sm text-coral">{bootError}</p>;
  }
  if (role !== "swimmer") {
    return <p className="px-5 py-16 text-center text-sm text-mute">A redirecionar…</p>;
  }

  return <SwimmerShell>{children}</SwimmerShell>;
}
