import type { Role } from "./types";

export function homeFor(role: Role | string | null | undefined): string {
  if (role === "coach") return "/coach";
  if (role === "swimmer") return "/swimmer";
  if (role === "pending") return "/escolher";
  return "/";
}
