"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, DatePicker, MetricCard, Select, TimePicker } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { resolveActiveOrganization } from "@/lib/client-org";

type Organization = { name: string; slug: string };
type Batch = { id: string; name: string; target_exam: string };
type Student = { user_id: string; display_name?: string; email?: string; roll_number?: string };
type Session = { id: string; batch_id: string; session_date: string; session_label: string; starts_at: string | null; ends_at: string | null; finalized_at: string | null };
const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type AttendanceStatus = (typeof attendanceStatuses)[number];
type RecordRow = { id: string; session_id: string; student_id: string; status: AttendanceStatus; remarks: string | null };
type Correction = { id: string; student_id: string; previous_status: AttendanceStatus; corrected_status: AttendanceStatus; reason: string; created_at: string };
type Data = { role: string; batches: Batch[]; selectedBatchId: string; students: Student[]; sessions: Session[]; records: RecordRow[]; corrections: Correction[] };
const empty: Data = { role: "", batches: [], selectedBatchId: "", students: [], sessions: [], records: [], corrections: [] };
function sessionDraft(session?: Session, records: RecordRow[] = []) {
  return {
    sessionId: session?.id ?? "",
    label: session?.session_label ?? "",
    startsAt: session?.starts_at?.slice(0, 5) ?? "",
    endsAt: session?.ends_at?.slice(0, 5) ?? "",
    statuses: Object.fromEntries(records.filter((record) => record.session_id === session?.id)
      .map((record) => [record.student_id, record.status])) as Partial<Record<string, AttendanceStatus>>,
  };
}

const localDate = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function AttendanceWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(localDate);
  const [draft, setDraft] = useState(sessionDraft);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const cancelLoad = useCallback(() => request.current?.abort(), []);

  const load = useCallback(async (active: Organization, selectedBatch: string, selectedDate: string, sessionId?: string) => {
    cancelLoad();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (selectedBatch) query.set("batchId", selectedBatch);
      if (selectedDate) query.set("date", selectedDate);
      const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/attendance?${query}`, {
        cache: "no-store", signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error ?? "Unable to load attendance.");
      setData(result);
      setBatchId(result.selectedBatchId);
      const sessions: Session[] = result.sessions;
      const session = sessionId ? sessions.find((item) => item.id === sessionId) : sessions.find((item) => item.session_date === selectedDate);
      setDraft(sessionDraft(session, result.records));
    } catch (error) {
      if (controller.signal.aborted) return;
      setData((previous) => ({ ...empty, role: previous.role, batches: previous.batches }));
      setDraft(sessionDraft());
      setError(error instanceof Error ? error.message : "Unable to load attendance.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [cancelLoad]);

  useEffect(() => {
    let version = 0;
    async function initialize() {
      const current = ++version;
      cancelLoad();
      setOrganization(null);
      setData(empty);
      setError("");
      setMessage("");
      setReason("");
      setLoading(true);
      const selection = await resolveActiveOrganization();
      if (current !== version) return;
      if (!selection) {
        setError("Select an institute before opening attendance.");
        setLoading(false);
        return;
      }
      const selectedDate = selection.role === "STUDENT" ? "" : localDate();
      setDate(selectedDate);
      setOrganization(selection.organization);
      void load(selection.organization, "", selectedDate);
    }
    void initialize();
    window.addEventListener("prepzii:organization-changed", initialize);
    return () => {
      version++;
      cancelLoad();
      window.removeEventListener("prepzii:organization-changed", initialize);
    };
  }, [cancelLoad, load]);

  function changeFilters(nextBatch: string, nextDate: string) {
    if (!organization || busy) return;
    setBatchId(nextBatch);
    setDate(nextDate);
    setReason("");
    setMessage("");
    void load(organization, nextBatch, nextDate);
  }

  const selectedSession = data.sessions.find((session) => session.id === draft.sessionId);
  const hasAllStatuses = data.students.length > 0 && data.students.every(({ user_id }) => Boolean(draft.statuses[user_id]));
  const canSave = !loading && !busy && Boolean(batchId && date && draft.label.trim().length >= 2)
    && hasAllStatuses && (!selectedSession?.finalized_at || reason.trim().length >= 3);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!organization || !canSave) return;
    const signal = request.current?.signal;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/attendance`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          batchId, sessionDate: date, sessionLabel: draft.label,
          startsAt: draft.startsAt || null, endsAt: draft.endsAt || null, correctionReason: reason.trim() || null,
          records: data.students.map(({ user_id }) => ({ studentId: user_id, status: draft.statuses[user_id] })),
        }),
      });
      const result = await response.json();
      if (signal?.aborted) return;
      if (!response.ok) throw new Error(result.error ?? "Unable to save attendance.");
      setReason("");
      setMessage(`${result.result.changeCount} attendance entries saved.`);
      await load(organization, batchId, date, result.result.sessionId);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : "Unable to save attendance.");
    } finally {
      setBusy(false);
    }
  }

  const staff = Boolean(data.role && data.role !== "STUDENT");
  const recordsBySession = new Map<string, RecordRow[]>();
  for (const record of data.records) {
    const records = recordsBySession.get(record.session_id) ?? [];
    records.push(record);
    recordsBySession.set(record.session_id, records);
  }
  const visibleStatuses = loading ? [] : staff ? Object.values(draft.statuses).filter(Boolean) : data.records.map(({ status }) => status);
  const present = visibleStatuses.filter((status) => status === "PRESENT").length;
  const absent = visibleStatuses.filter((status) => status === "ABSENT").length;
  const rate = visibleStatuses.length ? `${Math.round((present / visibleStatuses.length) * 1000) / 10}%` : "No records";
  const batchOptions = data.batches.map((batch) => ({ value: batch.id, label: batch.name }));

  return <DashboardLayout title={data.role === "STUDENT" ? "My attendance" : "Attendance register"} subtitle={`${organization?.name ?? "Institute"} · Audited session attendance`}>
    <div className="metrics-grid"><MetricCard label="Attendance rate" value={rate} detail={`${present} present records`} accent="green"/><MetricCard label="Absences" value={String(absent)} detail="Visible period" accent="orange"/><MetricCard label="Sessions" value={String(data.sessions.length)} detail="Selected date / recent history" accent="blue"/><MetricCard label="Corrections" value={String(data.corrections.length)} detail="Immutable history" accent="navy"/></div>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    <div className="attendance-workspace">
      {staff && <form className="panel attendance-register" onSubmit={(event) => void save(event)}>
        <div className="attendance-toolbar">
          <div className="attendance-field"><label htmlFor="attendance-batch">Batch</label>
            <Select id="attendance-batch" value={batchId} disabled={busy} onChange={(value) => changeFilters(value, date)} placeholder="Choose batch" options={batchOptions} />
          </div>
          <div className="attendance-field"><label htmlFor="attendance-date">Date</label>
            <DatePicker id="attendance-date" value={date} disabled={busy} onChange={(value) => changeFilters(batchId, value)} required />
          </div>
          <div className="attendance-field"><label htmlFor="attendance-session">Attendance session</label>
            <Select id="attendance-session" disabled={loading || busy} value={draft.sessionId} onChange={(id) => {
              setDraft(sessionDraft(data.sessions.find((session) => session.id === id), data.records));
              setReason("");
              setMessage("");
            }}>
              <option value="">New session</option>
              {data.sessions.filter((session) => session.session_date === date).map((session) => <option key={session.id} value={session.id}>
                {session.session_label}{session.starts_at ? ` · ${session.starts_at.slice(0, 5)}` : ""}
              </option>)}
            </Select>
          </div>
          <label className="attendance-field">Session name<input value={draft.label} disabled={loading || busy} readOnly={Boolean(selectedSession)}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} required minLength={2} maxLength={120} /></label>
          <div className="attendance-field"><label htmlFor="attendance-start">Starts</label>
            <TimePicker id="attendance-start" value={draft.startsAt} disabled={loading || busy || Boolean(selectedSession)}
              onChange={(value) => setDraft((current) => ({ ...current, startsAt: value }))} />
          </div>
          <div className="attendance-field"><label htmlFor="attendance-end">Ends</label>
            <TimePicker id="attendance-end" value={draft.endsAt} disabled={loading || busy}
              onChange={(value) => setDraft((current) => ({ ...current, endsAt: value }))} />
          </div>
        </div>
        <div className="attendance-actions">
          <Button type="button" variant="secondary" disabled={loading || busy || !data.students.length}
            onClick={() => setDraft((current) => ({ ...current, statuses: Object.fromEntries(data.students.map(({ user_id }) => [user_id, "PRESENT" as const])) }))}>
            Mark all present
          </Button>
          {selectedSession?.finalized_at && <input aria-label="Correction reason" value={reason} disabled={loading || busy} onChange={(event) => setReason(event.target.value)}
            required minLength={3} maxLength={500} placeholder="Correction reason" />}
          <Button className="attendance-save" disabled={!canSave}>{busy ? "Saving…" : "Save register"}</Button>
        </div>
        <div className="attendance-student-list">
          {!loading && data.students.map((student) => {
            const name = student.display_name ?? student.email ?? student.user_id;
            return <article key={student.user_id}>
              <div><strong>{name}</strong><small>{student.roll_number || "No roll number"}</small></div>
              <Select aria-label={`Attendance for ${name}`} size="sm" style={{ width: "130px" }} disabled={busy}
                value={draft.statuses[student.user_id] ?? ""} onChange={(value) => setDraft((current) => ({
                  ...current, statuses: { ...current.statuses, [student.user_id]: value ? value as AttendanceStatus : undefined },
                }))}>
                <option value="">Unmarked</option>
                {attendanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </article>;
          })}
          {!loading && !data.students.length && <p className="empty-state">No enrolled students in this batch.</p>}
        </div>
      </form>}
      {loading && <p role="status">Loading attendance…</p>}
      <section className="panel attendance-history"><h2>{staff ? "Session history" : "Attendance history"}</h2>
        {data.role === "STUDENT" && data.batches.length > 1 && <Select aria-label="Attendance batch" value={batchId}
          onChange={(value) => changeFilters(value, "")} options={batchOptions} />}{!loading && data.sessions.map((session) => { const records = recordsBySession.get(session.id) ?? []; const own = data.role === "STUDENT" ? records[0] : undefined; return <article key={session.id}><div><strong>{session.session_label}</strong><small>{session.session_date} · {session.starts_at?.slice(0,5) ?? "Time not set"}</small></div>{own ? <Badge variant={own.status === "PRESENT" ? "success" : own.status === "ABSENT" ? "danger" : "warning"}>{own.status}</Badge> : <span>{records.filter((record) => record.status === "PRESENT").length}/{records.length} present</span>}</article>; })}{!loading && !data.sessions.length && <p className="empty-state">No attendance sessions found.</p>}<h3>Correction trail</h3>{!loading && data.corrections.slice(0, 20).map((item) => <article key={item.id}><div><strong>{item.previous_status} → {item.corrected_status}</strong><small>{item.reason}</small></div><time>{new Date(item.created_at).toLocaleDateString("en-IN")}</time></article>)}{!loading && !data.corrections.length && <p className="empty-state">No corrections recorded.</p>}</section>
    </div>
  </DashboardLayout>;
}
