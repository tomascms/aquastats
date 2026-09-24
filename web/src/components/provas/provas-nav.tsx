"use client";

import { AnaliseTabs } from "@/components/analise/analise-tabs";

export function ProvasNav({ role = "coach" }: { role?: "coach" | "swimmer" }) {
  return <AnaliseTabs role={role} />;
}
