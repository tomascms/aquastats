"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NovaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/coach/competicoes");
  }, [router]);
  return <p className="text-sm text-mute">Os resultados metem-se em Competição…</p>;
}
