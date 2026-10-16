"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Organization = { id: string; name: string; slug: string; logoUrl: string | null; status: string };

export function OrganizationSwitcher() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(true);

  const select = useCallback(async (slug: string, refresh = true) => {
    setBusy(true);
    const response = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (response.ok) {
      const result = await response.json();
      setActiveSlug(result.organization.slug);
      setRole(result.role);
      if (refresh) router.refresh();
    }
    setBusy(false);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [listResponse, activeResponse] = await Promise.all([
        fetch("/api/organizations"),
        fetch("/api/organizations/active"),
      ]);
      if (cancelled || !listResponse.ok) return setBusy(false);
      const list = (await listResponse.json()).organizations as Organization[];
      const active = activeResponse.ok ? await activeResponse.json() : null;
      setOrganizations(list);
      if (active?.organization?.slug) {
        setActiveSlug(active.organization.slug);
        setRole(active.role ?? "");
        setBusy(false);
        return;
      }
      if (list[0]) await select(list[0].slug, false);
      else setBusy(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [select]);

  const active = organizations.find((organization) => organization.slug === activeSlug);
  const initials = (active?.name ?? "PrepZii").split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="org-switcher real-org-switcher">
      <span className="org-avatar">{initials}</span>
      <span className="org-switcher-copy">
        <select
          aria-label="Active institute"
          value={activeSlug}
          disabled={busy || organizations.length === 0}
          onChange={(event) => void select(event.target.value)}
        >
          {organizations.length === 0 && <option value="">No institute</option>}
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.slug}>{organization.name}</option>
          ))}
        </select>
        <small>{busy ? "Checking access…" : role.replaceAll("_", " ") || "Create an institute"}</small>
      </span>
    </div>
  );
}
