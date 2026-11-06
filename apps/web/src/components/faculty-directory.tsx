"use client";

import { BookOpen, Mail, Search, Upload, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FacultyAccountStatus, FacultyBatch, FacultyDirectoryResult, FacultyTeacher } from "@prepzii/contracts";
import { hasPermission, type InstituteRole } from "@prepzii/authorization";
import { Badge, Button, Select } from "@prepzii/ui";
import { DashboardLayout, useDashboardInstitute } from "@/components/dashboard-layout";
import { MemberImportDialog } from "@/components/member-import-dialog";

type Directory = FacultyDirectoryResult & { page: number; pageSize: number };
type DialogState =
  | { kind: "add" | "import" }
  | { kind: "view" | "edit" | "assign" | "invite"; teacher: FacultyTeacher };
const accountLabels: Record<FacultyAccountStatus, string> = {
  ACTIVE: "Active", INVITED: "Invited", PENDING: "Pending", INACTIVE: "Inactive", SUSPENDED: "Suspended",
};

export function FacultyDirectory() {
  return (
    <DashboardLayout title="Faculty directory" subtitle="Manage teacher profiles, batch assignments, and account access.">
      <FacultyWorkspace />
    </DashboardLayout>
  );
}

async function fetchJson<T>(url: string, fallback: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error ?? fallback);
  return result as T;
}

function FacultyWorkspace() {
  const institute = useDashboardInstitute();
  const organization = institute?.selection.organization;
  const canManage = hasPermission(institute?.selection.role as InstituteRole, "members:manage");
  const endpoint = organization ? `/api/organizations/${encodeURIComponent(organization.slug)}/faculty` : "";
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), search });
    if (batch) params.set("batchId", batch);
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchJson<Directory>(`${endpoint}?${params}`, "Unable to load faculty.", { signal: controller.signal });
        if (!controller.signal.aborted) setDirectory(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load faculty.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search ? 220 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [batch, endpoint, page, revision, search]);

  function refresh(message?: string) {
    if (message) setNotice(message);
    setRevision((current) => current + 1);
  }

  function clearFilters() {
    setSearch("");
    setBatch("");
    setPage(1);
  }

  const hasFilters = Boolean(search.trim() || batch);
  const batches = directory?.batches ?? [];
  const teachers = directory?.teachers ?? [];
  const pages = Math.max(1, Math.ceil((directory?.total ?? 0) / (directory?.pageSize ?? 25)));

  return (
    <section className="faculty-directory" aria-label="Faculty management">
      <div className="faculty-toolbar">
        <div className="faculty-filters">
          <label className="faculty-search">
            <Search size={18} aria-hidden="true" />
            <input aria-label="Search teachers" placeholder="Search teachers…" maxLength={120} value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <Select aria-label="Filter teachers by batch" value={batch} onChange={(value) => { setBatch(value); setPage(1); }}>
            <option value="">All batches</option>
            {batches.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </Select>
        </div>
        {canManage && <div className="faculty-toolbar-actions">
          <Button variant="outline" onClick={() => setDialog({ kind: "import" })}><Upload size={16} aria-hidden="true" /> Import CSV</Button>
          <Button onClick={() => setDialog({ kind: "add" })} disabled={!directory}><UserPlus size={17} aria-hidden="true" /> Add Teacher</Button>
        </div>}
      </div>

      {notice && <p className="success-banner" role="status">{notice}</p>}
      {error && <p className="form-error directory-error" role="alert">{error}</p>}
      <div className="faculty-results" aria-busy={loading}>
        {loading ? <p className="faculty-loading" role="status">Loading faculty…</p> : error ? (
          <div className="faculty-empty"><Button variant="outline" onClick={() => refresh()}>Try again</Button></div>
        ) : teachers.length === 0 ? (
          <div className="faculty-empty">
            <span className="faculty-empty-icon">{hasFilters ? <Search aria-hidden="true" /> : <Users aria-hidden="true" />}</span>
            <h2>{hasFilters ? "No teachers match your filters." : "No teachers added yet."}</h2>
            <p>{hasFilters ? "Try another name, email, subject, or batch." : "Add a teacher profile and assign batches. Send an invitation when they’re ready to sign in."}</p>
            {hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              : canManage && <Button onClick={() => setDialog({ kind: "add" })}>Add Your First Teacher</Button>}
          </div>
        ) : (
          <>
            <table className="faculty-table" role="table" aria-label="Teachers">
              <thead role="rowgroup"><tr role="row">
                {["Teacher", "Specialization", "Assigned batches", "Account status", "Actions"].map((label) => <th role="columnheader" scope="col" key={label}>{label}</th>)}
              </tr></thead>
              <tbody role="rowgroup">{teachers.map((teacher) => (
                <tr key={teacher.id} role="row">
                  <td role="cell"><strong>{teacher.displayName}</strong><small>{teacher.email}</small></td>
                  <td role="cell"><span className="faculty-mobile-label" aria-hidden="true">Specialization</span>{teacher.subjectSpecialization || "Not specified"}</td>
                  <td role="cell"><span className="faculty-mobile-label" aria-hidden="true">Assigned batches</span><BatchBadges batches={teacher.batches} /></td>
                  <td role="cell"><span className="faculty-mobile-label" aria-hidden="true">Account status</span><AccountBadge status={teacher.status} /></td>
                  <td role="cell"><div className="faculty-row-actions">
                    <Button variant="outline" onClick={() => setDialog({ kind: "view", teacher })}>View</Button>
                    {canManage && <>
                      <Button variant="outline" onClick={() => setDialog({ kind: "edit", teacher })}>Edit</Button>
                      {(teacher.status === "PENDING" || teacher.status === "INVITED" || teacher.status === "ACTIVE") &&
                        <Button variant="outline" onClick={() => setDialog({ kind: "assign", teacher })}>Assign Batch</Button>}
                      {(teacher.status === "PENDING" || teacher.status === "INVITED") &&
                        <Button variant="outline" onClick={() => setDialog({ kind: "invite", teacher })}>{teacher.status === "INVITED" ? "Invitation" : "Invite"}</Button>}
                    </>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="faculty-pagination" aria-label="Faculty pagination">
              <span>{directory?.total} {directory?.total === 1 ? "teacher" : "teachers"} · Page {directory?.page} of {pages}</span>
              <div>
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <Button variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>

      {dialog?.kind === "import" && organization && (
        <MemberImportDialog organizationSlug={organization.slug} role="TEACHER" onClose={() => setDialog(null)}
          onCommitted={async () => { clearFilters(); refresh("Faculty import complete."); }} />
      )}
      {dialog?.kind === "view" && (
        <TeacherDetails endpoint={endpoint} teacher={dialog.teacher} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "invite" && (
        <TeacherInvitation key={dialog.teacher.id} endpoint={endpoint} teacher={dialog.teacher}
          onClose={() => setDialog(null)} onCreated={() => refresh()} />
      )}
      {(dialog?.kind === "add" || dialog?.kind === "edit" || dialog?.kind === "assign") && (
        <TeacherEditor endpoint={endpoint} mode={dialog.kind} teacher={"teacher" in dialog ? dialog.teacher : undefined}
          batches={batches} onClose={() => setDialog(null)}
          onSaved={(message, inviteTeacher) => {
            if (dialog.kind === "add") clearFilters();
            refresh(message);
            setDialog(inviteTeacher ? { kind: "invite", teacher: inviteTeacher } : null);
          }} />
      )}
    </section>
  );
}

function AccountBadge({ status }: { status: FacultyAccountStatus }) {
  return <Badge size="sm" variant={status === "ACTIVE" ? "success" : status === "INVITED" ? "info" : status === "SUSPENDED" ? "danger" : "neutral"}>{accountLabels[status]}</Badge>;
}

function BatchBadges({ batches }: { batches: FacultyBatch[] }) {
  return <div className="member-batches">{batches.length ? batches.map((batch) => (
    <Badge variant="neutral" size="sm" key={batch.id}>{batch.name}</Badge>
  )) : <span>Unassigned</span>}</div>;
}

function FacultyDialog({ title, description, children, onClose, busy = false }: {
  title: string; description: string; children: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog className="faculty-dialog" ref={dialog} aria-labelledby="faculty-dialog-title"
      aria-describedby="faculty-dialog-description" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <div><h2 id="faculty-dialog-title">{title}</h2><p id="faculty-dialog-description">{description}</p></div>
        <button className="faculty-dialog-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button>
      </header>
      {children}
    </dialog>
  );
}

function TeacherEditor({ endpoint, mode, teacher, batches, onClose, onSaved }: {
  endpoint: string; mode: "add" | "edit" | "assign"; teacher?: FacultyTeacher; batches: FacultyBatch[];
  onClose: () => void; onSaved: (message: string, inviteTeacher?: FacultyTeacher) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = new Set(teacher?.batches.map(({ id }) => id));
  const title = mode === "add" ? "Add Teacher" : mode === "edit" ? "Edit teacher profile" : "Assign batches";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim() || null;
    const subjectSpecialization = String(form.get("subjectSpecialization") ?? "").trim() || null;
    const profile = { displayName, email, phone, subjectSpecialization };
    const batchIds = form.getAll("batchIds");
    setSaving(true);
    setError("");
    try {
      const result = await fetchJson<{ memberId: string }>(endpoint, "Unable to save the teacher.", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: mode, memberId: teacher?.id, profile, batchIds }),
      });
      const invite = mode === "add" && form.has("invite");
      const message = mode === "add" ? "Teacher added. Their account is pending activation."
        : mode === "edit" ? "Teacher profile updated." : "Batch assignments updated.";
      onSaved(message, invite ? {
        id: result.memberId, ...profile, emailEditable: true, status: "PENDING", batches: batches.filter(({ id }) => batchIds.includes(id)),
        joinedOn: null, qualification: null, schedule: [],
      } : undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save the teacher.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FacultyDialog title={title} description={mode === "add" ? "Save a profile now. The teacher can sign in after accepting an invitation."
      : mode === "edit" ? "Update the teacher’s contact and teaching details." : `Choose the batches ${teacher?.displayName} is responsible for.`}
      onClose={onClose} busy={saving}>
      <form className="faculty-form" onSubmit={save}>
        <fieldset disabled={saving}>
          {mode !== "assign" && <div className="faculty-form-grid">
            <label>Full name<input name="displayName" required minLength={2} maxLength={160} defaultValue={teacher?.displayName} autoComplete="name" /></label>
            <label>Email<input name="email" type="email" required maxLength={320} defaultValue={teacher?.email} autoComplete="email"
              readOnly={mode === "edit" && !teacher?.emailEditable} /></label>
            <label>Phone <span>(optional)</span><input name="phone" type="tel" maxLength={30} defaultValue={teacher?.phone ?? ""} autoComplete="tel" /></label>
            <label>Subject or specialization <span>(optional)</span><input name="subjectSpecialization" maxLength={240} defaultValue={teacher?.subjectSpecialization ?? ""} /></label>
          </div>}
          {mode !== "edit" && <fieldset className="faculty-batch-picker">
            <legend>Assigned batches <span>(optional)</span></legend>
            {batches.length ? <div>{batches.map((batch) => <label key={batch.id}>
              <input type="checkbox" name="batchIds" value={batch.id} defaultChecked={selected.has(batch.id)} /> {batch.name}
            </label>)}</div> : <p>No batches are configured in this workspace yet.</p>}
          </fieldset>}
          {mode === "add" && <label className="faculty-invite-option">
            <input type="checkbox" name="invite" /> Continue to invitation after saving
          </label>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Add Teacher" : mode === "assign" ? "Save assignments" : "Save profile"}</Button>
          </footer>
        </fieldset>
      </form>
    </FacultyDialog>
  );
}

function TeacherDetails({ endpoint, teacher, onClose }: { endpoint: string; teacher: FacultyTeacher; onClose: () => void }) {
  const [details, setDetails] = useState<FacultyTeacher | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ memberId: teacher.id });
    void fetchJson<FacultyDirectoryResult>(`${endpoint}?${query}`, "Unable to load teaching responsibilities.", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setDetails(result.teachers[0]); })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [endpoint, teacher.id]);
  const profile = details ?? teacher;
  return (
    <FacultyDialog title={profile.displayName} description="Teacher profile and teaching responsibilities" onClose={onClose}>
      <dl className="faculty-profile">
        <div><dt>Email</dt><dd>{profile.email}</dd></div>
        <div><dt>Phone</dt><dd>{profile.phone || "Not specified"}</dd></div>
        <div><dt>Subject or specialization</dt><dd>{profile.subjectSpecialization || "Not specified"}</dd></div>
        <div><dt>Account status</dt><dd><AccountBadge status={profile.status} /></dd></div>
        {profile.qualification && <div><dt>Qualification</dt><dd>{profile.qualification}</dd></div>}
        {profile.joinedOn && <div><dt>Joined on</dt><dd>{profile.joinedOn}</dd></div>}
      </dl>
      <section className="faculty-responsibilities">
        <h3><BookOpen size={18} aria-hidden="true" /> Teaching responsibilities</h3>
        <h4>Assigned batches</h4><BatchBadges batches={profile.batches} />
        <h4>Timetable</h4>
        {error ? <p role="alert">{error}</p> : !details ? <p role="status">Loading timetable…</p> : details.schedule.length ? (
          <ul>{details.schedule.map((slot) => <li key={slot.id}><strong>{slot.subject}</strong><span>{slot.batchName ? `${slot.batchName} · ` : ""}{slot.day} · {slot.time}</span></li>)}</ul>
        ) : <p>No scheduled teaching slots.</p>}
      </section>
      <footer><Button variant="outline" onClick={onClose}>Close</Button></footer>
    </FacultyDialog>
  );
}

function TeacherInvitation({ endpoint, teacher, onClose, onCreated }: {
  endpoint: string; teacher: FacultyTeacher; onClose: () => void; onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linkInput = useRef<HTMLInputElement>(null);

  async function invite(sendEmail: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchJson<{ acceptPath: string; emailSent: boolean }>(`${endpoint}/invite`, "Unable to create the invitation.", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: teacher.id, sendEmail }),
      });
      setLink(new URL(result.acceptPath, window.location.origin).href);
      setMessage(result.emailSent ? `Invitation sent to ${teacher.email}.`
        : sendEmail ? "Email delivery was unavailable. Share the secure link with this teacher."
        : "Secure link ready. Share it with this teacher.");
      onCreated();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FacultyDialog title="Teacher invitation" description={`Invite ${teacher.displayName} to activate their account using ${teacher.email}.`}
      onClose={onClose} busy={busy}>
      <p className="faculty-invitation-note">The link is valid for seven days after creation and requires the teacher’s verified email. An open invitation is reused.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="faculty-invitation-message" role="status">{message}</p>}
      {link && <label className="faculty-invitation-link">Secure invitation link
        <input ref={linkInput} value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
      </label>}
      <footer>
        {link ? <Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setMessage("Invitation link copied."); }
          catch { linkInput.current?.select(); setMessage("Link selected. Copy it to share."); }
        }}>Copy link</Button> : <Button variant="outline" disabled={busy} onClick={() => void invite(false)}>Get secure link</Button>}
        <Button disabled={busy} onClick={() => void invite(true)}><Mail size={16} aria-hidden="true" /> {busy ? "Preparing…" : "Email invitation"}</Button>
      </footer>
    </FacultyDialog>
  );
}
