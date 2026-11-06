"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { instituteInitials } from "@prepzii/contracts";
import { clearRememberedActiveOrganization, rememberActiveOrganization, resolveActiveOrganization, type ActiveOrganizationSelection, WORKSPACE_SWITCH_EVENT } from "@/lib/client-org";

type Organization = { id: string; name: string; slug: string; logoUrl: string | null; status: string };

export function OrganizationSwitcher({ returnTo, selection, selectionPending = false }: {
  returnTo?: string;
  selection?: ActiveOrganizationSelection | null;
  selectionPending?: boolean;
} = {}) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [standaloneSelection, setStandaloneSelection] = useState<ActiveOrganizationSelection | null>(null);
  const active = selection === undefined ? standaloneSelection : selection;
  const standalone = selection === undefined;
  const [busy, setBusy] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

  const select = useCallback(async (slug: string) => {
    setSwitching(true);
    setError("");
    window.dispatchEvent(new CustomEvent(WORKSPACE_SWITCH_EVENT, { detail: true }));
    try {
      const response = await fetch("/api/organizations/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (response.ok) {
        const result = await response.json().catch(() => null) as ActiveOrganizationSelection | null;
        if (result?.organization?.id) rememberActiveOrganization(result);
        else clearRememberedActiveOrganization();
        // A document navigation discards cached routes and data from the previous institute.
        window.location.assign(returnTo ?? "/dashboard/workspace");
        return;
      }
    } catch {
      // Restore the current workspace if the selection request fails.
    }
    setError("Unable to switch workspace.");
    setSwitching(false);
    window.dispatchEvent(new CustomEvent(WORKSPACE_SWITCH_EVENT, { detail: false }));
  }, [returnTo]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [response, resolved] = await Promise.all([
          fetch("/api/organizations", { cache: "no-store" }),
          standalone ? resolveActiveOrganization() : null,
        ]);
        if (!response.ok) throw new Error("Workspace list unavailable");
        const data = await response.json();
        if (cancelled) return;
        setOrganizations(data.organizations ?? []);
        setStandaloneSelection(resolved);
      } catch {
        if (!cancelled) setError("Unable to load workspaces.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [standalone]);

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

  const activeName = active?.organization.name;
  const role = active?.role;
  const loading = busy || selectionPending;
  const canSwitch = !loading && !switching;
  const accessLabel = role
    ? `${role.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())} access`
    : organizations.length ? "Select a workspace" : "Create an institute";
  const triggerName = switching ? "Switching workspace…" : loading ? "Loading workspace…" : activeName ?? "No institute";
  const triggerStatus = switching ? "Loading institute" : error || accessLabel;

  return (
    <div ref={switcherRef} className={`org-switcher real-org-switcher${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="org-switcher-trigger"
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? open : undefined}
        aria-controls={canSwitch ? "organization-switcher-menu" : undefined}
        disabled={!canSwitch}
        onClick={() => canSwitch && setOpen((current) => !current)}
      >
        {!standalone && <span className="dashboard-sr-only">Switch institute workspace</span>}
        <span className="org-avatar" aria-hidden="true">{switching ? "…" : instituteInitials(activeName ?? "")}</span>
        <span className="org-switcher-copy">
          <strong>{triggerName}</strong>
          <small aria-live="polite">{triggerStatus}</small>
        </span>
        {canSwitch && (
          <ChevronDown className="org-switcher-chevron" aria-hidden="true" strokeWidth={2.2} />
        )}
      </button>

      {open && canSwitch && (
        <div id="organization-switcher-menu" className="org-switcher-menu" role="listbox" aria-label="Institute workspaces">
          <span className="org-switcher-menu-label">Switch workspace</span>
          {organizations.map((organization) => {
            const isActive = organization.slug === active?.organization.slug;
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
                  else if (returnTo) window.location.assign(returnTo);
                }}
              >
                <span className="org-option-avatar" aria-hidden="true">{instituteInitials(isActive ? activeName ?? organization.name : organization.name)}</span>
                <span className="org-option-copy">
                  <strong>{isActive ? activeName : organization.name}</strong>
                  <small>{organization.slug}</small>
                </span>
                {isActive && <Check className="org-option-check" aria-hidden="true" strokeWidth={2.4} />}
              </button>
            );
          })}

          <div
            style={{
              borderTop: "1px solid rgba(0, 0, 0, 0.08)",
              marginTop: "8px",
              paddingTop: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}
          >
            <Link
              href="/onboarding"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                color: "#1e293b",
                textDecoration: "none",
              }}
            >
              <Plus size={15} style={{ opacity: 0.7 }} />
              <span>Create new institute</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
