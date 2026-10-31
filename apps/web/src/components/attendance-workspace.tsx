"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, DatePicker, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Batch = { id: string; name: string; target_exam: string };
type Student = { user_id: string; display_name?: string; email?: string; roll_number?: string };
type Session = { id: string; batch_id: string; session_date: string; session_label: string; starts_at: string | null; ends_at: string | null; finalized_at: string | null };
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type RecordRow = { id: string; session_id: string; student_id: string; status: AttendanceStatus; remarks: string | null };
type Correction = { id: string; student_id: string; previous_status: AttendanceStatus; corrected_status: AttendanceStatus; reason: string; created_at: string };
type Data = { role: string; batches: Batch[]; selectedBatchId: string; students: Student[]; sessions: Session[]; records: RecordRow[]; corrections: Correction[] };
const empty: Data = { role: "", batches: [], selectedBatchId: "", students: [], sessions: [], records: [], corrections: [] };
const localDate = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function AttendanceWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(localDate);
  const [label, setLabel] = useState("Daily class");
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("10:00");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (active: Organization, selectedBatch: string, selectedDate: string) => {
    const query = new URLSearchParams();
    if (selectedBatch) query.set("batchId", selectedBatch);
    if (selectedDate) query.set("date", selectedDate);
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/attendance?${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to load attendance."); return; }
    setData(result);
    const resolvedBatch = selectedBatch || result.selectedBatchId || "";
    setBatchId(resolvedBatch);
    const activeSession = (result.sessions as Session[]).find((session) => session.session_date === selectedDate);
    const activeRecords = new Map((result.records as RecordRow[]).filter((record) => !activeSession || record.session_id === activeSession.id).map((record) => [record.student_id, record.status]));
    setStatuses(Object.fromEntries((result.students as Student[]).map((student) => [student.user_id, activeRecords.get(student.user_id) ?? "PRESENT"])));
    if (activeSession) { setLabel(activeSession.session_label); setStartsAt(activeSession.starts_at?.slice(0, 5) ?? ""); setEndsAt(activeSession.ends_at?.slice(0, 5) ?? ""); }
    setError("");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active, "", localDate());
      else setError("Select an institute before opening attendance.");
    }
    void initialize();
  }, [load]);

  async function changeFilters(nextBatch: string, nextDate: string) {
    if (!organization) return;
    setBatchId(nextBatch); setDate(nextDate); setMessage("");
    await load(organization, nextBatch, nextDate);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!organization || !batchId) return;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/attendance`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId, sessionDate: date, sessionLabel: label, startsAt: startsAt || null, endsAt: endsAt || null, correctionReason: reason || null, records: data.students.map((student) => ({ studentId: student.user_id, status: statuses[student.user_id] ?? "PRESENT", remarks: null })) }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save attendance.");
    else { setReason(""); setMessage(`${result.result.changeCount} attendance entries saved.`); await load(organization, batchId, date); }
    setBusy(false);
  }

  const staff = data.role !== "STUDENT";
  const present = staff ? Object.values(statuses).filter((status) => status === "PRESENT").length : data.records.filter((record) => record.status === "PRESENT").length;
  const absent = staff ? Object.values(statuses).filter((status) => status === "ABSENT").length : data.records.filter((record) => record.status === "ABSENT").length;
  const total = staff ? data.students.length : data.records.length;
  const rate = total ? Math.round((present / total) * 1000) / 10 : 0;

  return <DashboardLayout title={staff ? "Attendance register" : "My attendance"} subtitle={`${organization?.name ?? "Institute"} · Audited session attendance`}>
    <div className="metrics-grid"><MetricCard label="Attendance rate" value={`${rate}%`} detail={`${present} present records`} accent="green"/><MetricCard label="Absences" value={String(absent)} detail="Visible period" accent="orange"/><MetricCard label="Sessions" value={String(data.sessions.length)} detail="Selected date / recent history" accent="blue"/><MetricCard label="Corrections" value={String(data.corrections.length)} detail="Immutable history" accent="navy"/></div>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    <div className="attendance-workspace">
      {staff && <form className="panel attendance-register" onSubmit={(event) => void save(event)}><div className="attendance-toolbar"><label>Batch<select value={batchId} onChange={(event) => void changeFilters(event.target.value, date)} required><option value="">Choose batch</option>{data.batches.map((batch) => <option value={batch.id} key={batch.id}>{batch.name}</option>)}</select></label><label>Date<DatePicker value={date} onChange={(val) => void changeFilters(batchId, val)} required/></label><label>Session<input value={label} onChange={(event) => setLabel(event.target.value)} required/></label><label>Starts<input type="time" value={startsAt} onChange={(event) => setStartsAt(event.target.value)}/></label><label>Ends<input type="time" value={endsAt} onChange={(event) => setEndsAt(event.target.value)}/></label></div><div className="attendance-actions"><Button type="button" variant="secondary" onClick={() => setStatuses(Object.fromEntries(data.students.map((student) => [student.user_id, "PRESENT"])))}>Mark all present</Button><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason (required when revising)"/><Button disabled={busy || !data.students.length}>{busy ? "Saving…" : "Save register"}</Button></div><div className="attendance-student-list">{data.students.map((student) => <article key={student.user_id}><div><strong>{student.display_name ?? student.email ?? student.user_id}</strong><small>{student.roll_number || "No roll number"}</small></div><select value={statuses[student.user_id] ?? "PRESENT"} onChange={(event) => setStatuses((current) => ({ ...current, [student.user_id]: event.target.value as AttendanceStatus }))}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>EXCUSED</option></select></article>)}{!data.students.length && <p className="empty-state">No enrolled students in this batch.</p>}</div></form>}
      <section className="panel attendance-history"><h2>{staff ? "Session history" : "Attendance history"}</h2>{data.sessions.map((session) => { const records = data.records.filter((record) => record.session_id === session.id); const own = data.role === "STUDENT" ? records[0] : undefined; return <article key={session.id}><div><strong>{session.session_label}</strong><small>{session.session_date} · {session.starts_at?.slice(0,5) ?? "Time not set"}</small></div>{own ? <Badge variant={own.status === "PRESENT" ? "success" : own.status === "ABSENT" ? "danger" : "warning"}>{own.status}</Badge> : <span>{records.filter((record) => record.status === "PRESENT").length}/{records.length} present</span>}</article>; })}{!data.sessions.length && <p className="empty-state">No attendance sessions found.</p>}<h3>Correction trail</h3>{data.corrections.slice(0, 20).map((item) => <article key={item.id}><div><strong>{item.previous_status} → {item.corrected_status}</strong><small>{item.reason}</small></div><time>{new Date(item.created_at).toLocaleDateString("en-IN")}</time></article>)}{!data.corrections.length && <p className="empty-state">No corrections recorded.</p>}</section>
    </div>
  </DashboardLayout>;
}
