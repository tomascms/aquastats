import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getServerT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: t("Análise de treino") };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
