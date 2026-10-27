"use client";

import { useEffect, useState } from "react";

export type ActiveOrganization = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  status?: string;
};

export type ActiveOrganizationSelection = {
  organization: ActiveOrganization;
  role?: string;
};

let rememberedSelection: ActiveOrganizationSelection | null | undefined;
let rememberedSelectionAt = 0;
let activeOrganizationRequest: Promise<ActiveOrganizationSelection | null> | null = null;

function readRememberedSelection(): ActiveOrganizationSelection | null {
  return rememberedSelection && Date.now() - rememberedSelectionAt < 5_000
    ? rememberedSelection
    : null;
}

export function rememberActiveOrganization(selection: ActiveOrganizationSelection): void {
  rememberedSelection = selection;
  rememberedSelectionAt = Date.now();
  setActiveOrganizationId(selection.organization.id);
}

export function clearRememberedActiveOrganization(): void {
  rememberedSelection = null;
  rememberedSelectionAt = 0;
  if (typeof window === "undefined") return;
  document.cookie = "prepzii_org_id=; path=/; SameSite=Lax; max-age=0;";
  try {
    localStorage.removeItem("prepzii_active_org_id");
  } catch {}
}

export async function resolveActiveOrganization({
  refresh = false,
}: {
  refresh?: boolean;
} = {}): Promise<ActiveOrganizationSelection | null> {
  if (!refresh) {
    const remembered = readRememberedSelection();
    if (remembered) return remembered;
    if (activeOrganizationRequest) return activeOrganizationRequest;
  }

  activeOrganizationRequest = fetch("/api/organizations/active", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return null;
      const result = await response.json() as ActiveOrganizationSelection;
      if (!result.organization?.id) return null;
      rememberActiveOrganization(result);
      return result;
    })
    .catch(() => null)
    .finally(() => {
      activeOrganizationRequest = null;
    });

  const selection = await activeOrganizationRequest;
  if (!selection) clearRememberedActiveOrganization();
  return selection;
}

export function getActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)prepzii_org_id=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  try {
    return localStorage.getItem("prepzii_active_org_id");
  } catch {
    return null;
  }
}

export function setActiveOrganizationId(orgId: string): void {
  if (typeof window === "undefined") return;
  if (rememberedSelection?.organization.id !== orgId) {
    rememberedSelection = undefined;
    rememberedSelectionAt = 0;
  }
  document.cookie = `prepzii_org_id=${encodeURIComponent(orgId)}; path=/; SameSite=Lax; max-age=2592000;`;
  try {
    localStorage.setItem("prepzii_active_org_id", orgId);
  } catch {}
}

/** Refresh legacy API consumers when the validated institute selection changes. */
export function useActiveOrganizationId(): string | null {
  const [organizationId, setOrganizationId] = useState<string | null>(() => getActiveOrganizationId());
  useEffect(() => {
    let cancelled = false;
    const update = () => setOrganizationId(getActiveOrganizationId());
    window.addEventListener("prepzii:organization-changed", update);
    void resolveActiveOrganization().then((result) => {
      if (!cancelled && result?.organization.id) {
        update();
      }
    });
    return () => {
      cancelled = true;
      window.removeEventListener("prepzii:organization-changed", update);
    };
  }, []);
  return organizationId;
}
