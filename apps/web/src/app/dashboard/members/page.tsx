"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { id: string; name: string; slug: string };
type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

const roles = [
  ["TEACHER", "Teacher"],
  ["STUDENT", "Student"],
  ["ACADEMIC_COORDINATOR", "Academic coordinator"],
  ["ACCOUNTANT", "Accountant"],
  ["PARENT", "Parent"],
  ["COACHING_ADMIN", "Coaching admin"],
] as const;

export default function MembersPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [createdLink, setCreatedLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadInvitations = useCallback(async (slug: string) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(slug)}/invitations`);
    if (response.ok) setInvitations((await response.json()).invitations);
  }, []);

  useEffect(() => {
    async function load() {
      const activeResponse = await fetch("/api/organizations/active");
      let active = activeResponse.ok ? (await activeResponse.json()).organization as Organization | null : null;
      if (!active) {
        const listResponse = await fetch("/api/organizations");
        const first = listResponse.ok ? ((await listResponse.json()).organizations as Organization[])[0] : null;
        if (first) {
          const selectResponse = await fetch("/api/organizations/active", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug: first.slug }),
          });
          if (selectResponse.ok) active = (await selectResponse.json()).organization;
        }
      }
      setOrganization(active);
      if (active) await loadInvitations(active.slug);
    }
    void load();
  }, [loadInvitations]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;
    setBusy(true);
    setError("");
    setCreatedLink("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ email: form.get("email"), role: form.get("role"), expiresInDays: 7 }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to create invitation.");
    else {
      setCreatedLink(`${window.location.origin}${result.acceptPath}`);
      event.currentTarget.reset();
      await loadInvitations(organization.slug);
    }
    setBusy(false);
  }

  async function revoke(invitationId: string) {
    if (!organization) return;
    const response = await fetch(
      `/api/organizations/${encodeURIComponent(organization.slug)}/invitations/${invitationId}`,
      { method: "DELETE" },
    );
    if (response.ok) await loadInvitations(organization.slug);
    else setError((await response.json()).error ?? "Unable to revoke invitation.");
  }

  return (
    <DashboardLayout title="Members & invitations" subtitle={organization ? `${organization.name} · Access management` : "Select an institute"}>
      <div className="members-grid">
        <section className="panel invitation-panel">
          <h2>Invite a member</h2>
          <p>Invitations expire after seven days and only work for the verified email below.</p>
          <form className="onboarding-form" onSubmit={createInvitation}>
            <label>Email address<input name="email" type="email" required placeholder="teacher@example.com" /></label>
            <label>Organization role<select name="role" defaultValue="TEACHER">{roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="pz-button pz-button-primary" disabled={busy || !organization}>{busy ? "Creating…" : "Create secure invite"}</button>
          </form>
          {createdLink && (
            <div className="invite-link-result">
              <strong>Invitation created</strong>
              <input readOnly value={createdLink} aria-label="Invitation link" />
              <button className="pz-button pz-button-outline" onClick={() => void navigator.clipboard.writeText(createdLink)}>Copy link</button>
            </div>
          )}
        </section>

        <section className="panel invitation-list-panel">
          <h2>Recent invitations</h2>
          <div className="invitation-list">
            {invitations.length === 0 && <p className="empty-state">No invitations yet.</p>}
            {invitations.map((invitation) => (
              <article key={invitation.id} className="invitation-row">
                <div><strong>{invitation.email}</strong><small>{invitation.role.replaceAll("_", " ")} · expires {new Date(invitation.expires_at).toLocaleDateString()}</small></div>
                <span className={`invite-status status-${invitation.status.toLowerCase()}`}>{invitation.status}</span>
                {invitation.status === "PENDING" && <button onClick={() => void revoke(invitation.id)}>Revoke</button>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
