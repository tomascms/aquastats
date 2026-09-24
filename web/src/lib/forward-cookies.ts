import { NextResponse } from "next/server";

export function forwardCookies(upstream: Response, response: NextResponse) {
  const cookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : upstream.headers.get("set-cookie")
        ? [upstream.headers.get("set-cookie") as string]
        : [];
  for (const cookie of cookies) {
    if (cookie) response.headers.append("set-cookie", cookie);
  }
}
