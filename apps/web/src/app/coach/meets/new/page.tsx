"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MeetNewRedirect() {
  return (
    <Suspense fallback={<p className="text-sm text-mute">A abrir competições…</p>}>
      <Go />
    </Suspense>
  );
}

function Go() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/coach/competicoes");
  }, [router]);
  return <p className="text-sm text-mute">A abrir competições…</p>;
}
