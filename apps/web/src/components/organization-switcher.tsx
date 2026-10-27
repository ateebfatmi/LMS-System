"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rememberActiveOrganization, resolveActiveOrganization } from "@/lib/client-org";

type Organization = { id: string; name: string; slug: string; logoUrl: string | null; status: string };

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeSlug, setActiveSlug] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

  const select = useCallback(async (slug: string, refresh = true) => {
    setBusy(true);
    setError("");
    const response = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (response.ok) {
      const result = await response.json();
      rememberActiveOrganization(result);
      setActiveSlug(result.organization.slug);
      setRole(result.role);
      window.dispatchEvent(new CustomEvent("prepzii:organization-changed", { detail: { role: result.role } }));
      if (refresh) window.location.reload();
    } else {
      setError("Unable to switch workspace");
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [listResponse, active] = await Promise.all([
        fetch("/api/organizations"),
        resolveActiveOrganization(),
      ]);
      if (cancelled || !listResponse.ok) return setBusy(false);
      const list = (await listResponse.json()).organizations as Organization[];
      setOrganizations(list);
      if (active?.organization?.slug) {
        setActiveSlug(active.organization.slug);
        setRole(active.role ?? "");
        setBusy(false);
        return;
      }
      if (list[0]) {
        await select(list[0].slug, false);
      } else {
        setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [select]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePress(event: PointerEvent) {
      if (!switcherRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const active = organizations.find((organization) => organization.slug === activeSlug);
  const initialsFor = (name: string) =>
    name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  const initials = initialsFor(active?.name ?? "PrepZii");
  const canSwitch = organizations.length > 1 && !busy;
  const accessLabel = role
    ? `${role.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())} access`
    : "Create an institute";

  return (
    <div ref={switcherRef} className={`org-switcher real-org-switcher${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="org-switcher-trigger"
        aria-label={canSwitch ? `Switch institute. Current institute: ${active?.name}` : `Current institute: ${active?.name ?? "None"}`}
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? open : undefined}
        aria-controls={canSwitch ? "organization-switcher-menu" : undefined}
        disabled={!canSwitch}
        onClick={() => canSwitch && setOpen((current) => !current)}
      >
        <span className="org-avatar" aria-hidden="true">{initials}</span>
        <span className="org-switcher-copy">
          <strong>{busy ? "Loading workspace…" : active?.name ?? "No institute"}</strong>
          <small aria-live="polite">{error || accessLabel}</small>
        </span>
        {canSwitch && (
          <ChevronDown className="org-switcher-chevron" aria-hidden="true" strokeWidth={2.2} />
        )}
      </button>

      {open && canSwitch && (
        <div id="organization-switcher-menu" className="org-switcher-menu" role="listbox" aria-label="Institute workspaces">
          <span className="org-switcher-menu-label">Switch workspace</span>
          {organizations.map((organization) => {
            const isActive = organization.slug === activeSlug;
            return (
              <button
                key={organization.id}
                type="button"
                className={`org-switcher-option${isActive ? " is-active" : ""}`}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setOpen(false);
                  if (!isActive) void select(organization.slug);
                }}
              >
                <span className="org-option-avatar" aria-hidden="true">{initialsFor(organization.name)}</span>
                <span className="org-option-copy">
                  <strong>{organization.name}</strong>
                  <small>{organization.slug}</small>
                </span>
                {isActive && <Check className="org-option-check" aria-hidden="true" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
