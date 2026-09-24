"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function MeetResultsRedirect() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  useEffect(() => {
    router.replace(`/coach/competicoes/${params.id}/resultados`);
  }, [params.id, router]);
  return <p className="text-sm text-mute">A abrir resultados…</p>;
}
