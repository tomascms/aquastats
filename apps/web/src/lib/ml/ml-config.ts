"use client";

import { useEffect, useState } from "react";
import { CHAMPION, type ModelId } from "./production";

/*
 * Which model the coach sees, decided at run time (/api/ml-config) so it can be reverted at once
 * without a new build; until the answer arrives — or if it never does — the build's default holds.
 */

export type MlRoles = { champion: ModelId; challenger: ModelId; shadow: boolean };

const other = (model: ModelId): ModelId => (model === "atual" ? "estado" : "atual");
const BUILD: MlRoles = { champion: CHAMPION, challenger: other(CHAMPION), shadow: true };
const REFRESH_MS = 5 * 60_000;

let cached: { at: number; roles: Promise<MlRoles> } | null = null;

export function fetchMlRoles(): Promise<MlRoles> {
  if (cached && Date.now() - cached.at < REFRESH_MS) return cached.roles;
  const roles = fetch("/api/ml-config", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { champion?: ModelId | null; shadow?: boolean } | null) => {
      const champion = body?.champion === "estado" || body?.champion === "atual" ? body.champion : CHAMPION;
      return { champion, challenger: other(champion), shadow: body?.shadow !== false };
    })
    .catch(() => BUILD);
  cached = { at: Date.now(), roles };
  return roles;
}

export function useMlRoles(): MlRoles {
  const [roles, setRoles] = useState<MlRoles>(BUILD);
  useEffect(() => {
    let alive = true;
    void fetchMlRoles().then((value) => alive && setRoles(value));
    return () => {
      alive = false;
    };
  }, []);
  return roles;
}
