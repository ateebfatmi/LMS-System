"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { OrganizationMemberDirectoryRecord } from "@prepzii/contracts";
import { Badge, Button, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MemberImportDialog } from "@/components/member-import-dialog";

type Organization = { id: string; name: string; slug: string };
type DirectoryRole = "STUDENT" | "TEACHER";
type Pagination = { page: number; perPage: number; total: number; pages: number };

export function MemberDirectory({ role }: { role: DirectoryRole }) {
  const isStudent = role === "STUDENT";
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMemberDirectoryRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, perPage: 25, total: 0, pages: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<OrganizationMemberDirectoryRecord | null>(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (active: Organization, query: string, targetPage: number) => {
    setLoading(true);
    const parameters = new URLSearchParams({ role, page: String(targetPage), perPage: "25" });
    if (query.trim()) parameters.set("search", query.trim());
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/members?${parameters}`);
    const result = await response.json();
    if (response.ok) {
      setMembers(result.members);
      setPagination(result.pagination);
      setError("");
    } else setError(result.error ?? "Unable to load directory.");
    setLoading(false);
  }, [role]);

  useEffect(() => {
    async function resolveOrganization() {
      const activeResponse = await fetch("/api/organizations/active");
      let active = activeResponse.ok ? (await activeResponse.json()).organization as Organization | null : null;
      if (!active) {
        const listResponse = await fetch("/api/organizations");
        const first = listResponse.ok ? ((await listResponse.json()).organizations as Organization[])[0] : null;
        if (first) {
          const selection = await fetch("/api/organizations/active", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug: first.slug }),
          });
          if (selection.ok) active = (await selection.json()).organization;
        }
      }
      setOrganization(active);
      if (!active) {
        setLoading(false);
        setError("Create or join an institute before managing members.");
      }
    }
    void resolveOrganization();
  }, []);

  useEffect(() => {
    if (!organization) return;
    const timer = window.setTimeout(() => void load(organization, search, page), 250);
    return () => window.clearTimeout(timer);
  }, [load, organization, page, search]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !editing) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/members`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        memberId: editing.id,
        role: editing.role,
        status: form.get("status"),
        displayName: form.get("displayName"),
        phone: text("phone"),
        alternatePhone: text("alternatePhone"),
        rollNumber: text("rollNumber"),
        employeeCode: text("employeeCode"),
        guardianName: text("guardianName"),
        guardianPhone: text("guardianPhone"),
        qualification: text("qualification"),
        subjectSpecialization: text("subjectSpecialization"),
        joinedOn: text("joinedOn"),
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save profile.");
    else {
      setEditing(null);
      await load(organization, search, page);
    }
    setSaving(false);
  }

  return (
    <DashboardLayout
      title={isStudent ? "Student directory" : "Faculty directory"}
      subtitle={organization ? `${organization.name} · Authoritative member records` : "Select an institute"}
      action={<div className="directory-actions"><Button variant="outline" onClick={() => setImporting(true)}>Import CSV</Button><Link className="pz-button pz-button-primary" href="/dashboard/members">＋ Invite {isStudent ? "student" : "faculty"}</Link></div>}
    >
      <div className="metrics-grid directory-metrics">
        <MetricCard label={isStudent ? "Students found" : "Faculty found"} value={String(pagination.total)} detail="Tenant-scoped records" accent="yellow" />
        <MetricCard label="Page" value={`${pagination.page} / ${Math.max(pagination.pages, 1)}`} detail="25 records per page" accent="navy" />
      </div>

      <div className="filter-bar directory-filter">
        <input className="search-input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={isStudent ? "Search name, email, or roll number…" : "Search name, email, or employee code…"} />
        <span>{loading ? "Loading…" : `${pagination.total} result${pagination.total === 1 ? "" : "s"}`}</span>
      </div>

      {error && <div className="form-error directory-error" role="alert">{error}</div>}
      <div className="data-table-wrap">
        <table className="data-table member-table">
          <thead><tr><th>Member</th><th>{isStudent ? "Roll number" : "Employee code"}</th><th>Batches</th><th>{isStudent ? "Guardian" : "Specialization"}</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {!loading && members.length === 0 && <tr><td colSpan={6} className="table-empty">No matching members.</td></tr>}
            {members.map((member) => (
              <tr key={member.id}>
                <td><strong>{member.displayName}</strong><small>{member.email}{member.phone ? ` · ${member.phone}` : ""}</small></td>
                <td><code>{isStudent ? member.rollNumber || "Not assigned" : member.employeeCode || "Not assigned"}</code></td>
                <td><div className="member-batches">{member.batches.length ? member.batches.map((batch) => <Badge key={batch.id} variant="neutral" size="sm">{batch.name}</Badge>) : <span>Unassigned</span>}</div></td>
                <td>{isStudent ? <><strong>{member.guardianName || "Not recorded"}</strong><small>{member.guardianPhone}</small></> : <><strong>{member.subjectSpecialization || "Not recorded"}</strong><small>{member.qualification}</small></>}</td>
                <td><Badge variant={member.status === "ACTIVE" ? "success" : "neutral"} size="sm">{member.status}</Badge></td>
                <td><Button variant="secondary" className="btn-xs" onClick={() => setEditing(member)}>Edit profile</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="directory-pagination">
        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>← Previous</Button>
        <span>Page {pagination.page} of {Math.max(pagination.pages, 1)}</span>
        <Button variant="outline" disabled={page >= pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next →</Button>
      </div>

      {editing && (
        <div className="modal-backdrop" role="presentation">
          <form className="member-editor" onSubmit={save}>
            <header><div><h2>Edit {isStudent ? "student" : "faculty"} profile</h2><p>{editing.email}</p></div><button type="button" onClick={() => setEditing(null)} aria-label="Close">✕</button></header>
            <div className="member-editor-grid">
              <label>Display name<input name="displayName" required defaultValue={editing.displayName} /></label>
              <label>Status<select name="status" defaultValue={editing.status === "PENDING" ? "ACTIVE" : editing.status}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option></select></label>
              <label>Phone<input name="phone" defaultValue={editing.phone ?? ""} /></label>
              <label>Alternate phone<input name="alternatePhone" defaultValue={editing.alternatePhone ?? ""} /></label>
              {isStudent ? <><label>Roll number<input name="rollNumber" defaultValue={editing.rollNumber ?? ""} /></label><label>Guardian name<input name="guardianName" defaultValue={editing.guardianName ?? ""} /></label><label>Guardian phone<input name="guardianPhone" defaultValue={editing.guardianPhone ?? ""} /></label></> : <><label>Employee code<input name="employeeCode" defaultValue={editing.employeeCode ?? ""} /></label><label>Subject specialization<input name="subjectSpecialization" defaultValue={editing.subjectSpecialization ?? ""} /></label><label className="editor-wide">Qualification<input name="qualification" defaultValue={editing.qualification ?? ""} /></label></>}
              <label>Joined on<input name="joinedOn" type="date" defaultValue={editing.joinedOn ?? ""} /></label>
            </div>
            <footer><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button></footer>
          </form>
        </div>
      )}
      {importing && organization && <MemberImportDialog organizationSlug={organization.slug} role={role} onClose={() => setImporting(false)} onCommitted={() => load(organization, search, page)} />}
    </DashboardLayout>
  );
}
