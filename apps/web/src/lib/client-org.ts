"use client";

import { useEffect, useState } from "react";

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
  document.cookie = `prepzii_org_id=${encodeURIComponent(orgId)}; path=/; SameSite=Lax; max-age=2592000;`;
  try {
    localStorage.setItem("prepzii_active_org_id", orgId);
  } catch {}
}

/** Refresh legacy API consumers when the validated institute selection changes. */
export function useActiveOrganizationId(): string | null {
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const update = () => setOrganizationId(getActiveOrganizationId());
    window.addEventListener("prepzii:organization-changed", update);
    void fetch("/api/organizations/active", { cache: "no-store" }).then(async (response) => {
      const result = response.ok ? await response.json() : null;
      if (!cancelled && result?.organization?.id) {
        setActiveOrganizationId(result.organization.id);
        update();
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      window.removeEventListener("prepzii:organization-changed", update);
    };
  }, []);
  return organizationId;
}
