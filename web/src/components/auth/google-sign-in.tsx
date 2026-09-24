"use client";

import { useEffect } from "react";
import { writeInviteCookie } from "@/lib/invite";

export function GoogleSignIn({
  invite = "",
  disabled,
}: {
  invite?: string;
  disabled?: boolean;
}) {
  useEffect(() => {
    if (invite) writeInviteCookie(invite);
  }, [invite]);

  const startUrl = invite
    ? `/api/v1/auth/google/start?invite=${encodeURIComponent(invite)}`
    : "/api/v1/auth/google/start";

  return (
    <div>
      <div className="my-6 flex items-center gap-3 text-xs text-mute">
        <span className="h-px flex-1 bg-line" />
        ou
        <span className="h-px flex-1 bg-line" />
      </div>
      <a
        href={startUrl}
        aria-disabled={disabled}
        className={`mx-auto flex h-10 w-full max-w-[400px] items-center justify-center gap-3 rounded-md border border-line bg-white text-sm font-medium text-[#1f1f1f] shadow-sm transition hover:bg-[#f8f9fa] ${
          disabled ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <GoogleMark />
        Continuar com Google
      </a>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.56 2.98-2.26 5.5-4.82 7.18l7.73 6.01c4.52-4.18 7.12-10.33 7.12-17.66z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.55l7.98-6.18z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6.01c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
