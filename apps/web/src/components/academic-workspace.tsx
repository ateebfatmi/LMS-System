"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, DatePicker, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type View = "BATCHES" | "COURSES" | "CAMPUSES";
type Organization = { name: string; slug: string };
type Data = {
  academicYears: Record<string, unknown>[]; campuses: Record<string, unknown>[]; batches: Record<string, unknown>[];
  subjects: Record<string, unknown>[]; courses: Record<string, unknown>[]; rooms: Record<string, unknown>[];
  schedules: Record<string, unknown>[]; students: Record<string, unknown>[]; faculty: Record<string, unknown>[];
};
const empty: Data = { academicYears: [], campuses: [], batches: [], subjects: [], courses: [], rooms: [], schedules: [], students: [], faculty: [] };

export function AcademicWorkspace({ view }: { view: View }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/academic`);
    const result = await response.json();
    if (response.ok) { setData(result); setError(""); }
    else setError(result.error ?? "Unable to load academic workspace.");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active");
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active);
      else setError("Select an institute before managing academics.");
    }
    void initialize();
  }, [load]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    setBusy(true); setError("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/academic`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save academic record.");
    else await load(organization);
    setBusy(false);
    return response.ok;
  }

  const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
  async function submit(event: FormEvent<HTMLFormElement>, action: string, builder: (form: FormData) => Record<string, unknown>) {
    event.preventDefault();
    if (await mutate(action, builder(new FormData(event.currentTarget)))) event.currentTarget.reset();
  }

  const title = view === "BATCHES" ? "Batches & enrolments" : view === "COURSES" ? "Courses & subjects" : "Campuses & timetable";
  return (
    <DashboardLayout title={title} subtitle={`${organization?.name ?? "Institute"} · Authoritative academic operations`}>
      <nav className="academic-workspace-nav" aria-label="Academic workspace sections">
        <Link className={view === "BATCHES" ? "active" : ""} href="/dashboard/batches/workspace">Batches & enrolments</Link>
        <Link className={view === "CAMPUSES" ? "active" : ""} href="/dashboard/campuses">Campuses & timetable</Link>
      </nav>
      <div className="metrics-grid academic-metrics">
        <MetricCard label="Academic sessions" value={String(data.academicYears.length)} detail="Configured years" accent="yellow" />
        <MetricCard label="Campuses" value={String(data.campuses.length)} detail={`${data.rooms.length} rooms`} accent="navy" />
        <MetricCard label="Batches" value={String(data.batches.length)} detail={`${data.students.length} active students`} accent="green" />
        <MetricCard label="Courses" value={String(data.courses.length)} detail={`${data.subjects.length} subjects`} accent="blue" />
      </div>
      {error && <div className="form-error directory-error" role="alert">{error}</div>}

      <div className="academic-layout">
        <section className="panel academic-create-panel">
          <h2>Quick create</h2>
          {view === "BATCHES" && <>
            <form onSubmit={(e) => void submit(e, "CREATE_ACADEMIC_YEAR", (f) => ({ name: value(f,"name"), startsOn: value(f,"startsOn"), endsOn: value(f,"endsOn"), isActive: true }))} className="compact-form"><h3>Academic session</h3><input name="name" required placeholder="2026–27"/><div><DatePicker name="startsOn" required placeholder="Start date (dd/mm/yyyy)"/><DatePicker name="endsOn" required placeholder="End date (dd/mm/yyyy)"/></div><Button disabled={busy}>Create session</Button></form>
            <form onSubmit={(e) => void submit(e, "CREATE_BATCH", (f) => ({ name: value(f,"name"), targetExam: value(f,"targetExam"), gradeLevel: value(f,"gradeLevel") || null, roomNumber: null, campusId: value(f,"campusId") || null, academicYearId: value(f,"academicYearId") || null }))} className="compact-form"><h3>Batch</h3><input name="name" required placeholder="JEE 12A — Titans"/><select name="targetExam"><option>JEE_ADVANCED</option><option>JEE_MAIN</option><option>NEET</option><option>FOUNDATION</option><option>BOARDS</option></select><input name="gradeLevel" placeholder="Class 12"/><select name="campusId"><option value="">No campus</option>{data.campuses.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><select name="academicYearId"><option value="">No session</option>{data.academicYears.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><Button disabled={busy}>Create batch</Button></form>
            <form onSubmit={(e) => void submit(e, "ENROLL_MEMBER", (f) => ({ batchId: value(f,"batchId"), memberId: value(f,"memberId"), rollNumber: value(f,"rollNumber") || null }))} className="compact-form"><h3>Enrol active member</h3><select name="batchId" required><option value="">Choose batch</option>{data.batches.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><select name="memberId" required><option value="">Choose student or teacher</option>{[...data.students,...data.faculty].map((x) => <option key={String(x.member_id)} value={String(x.member_id)}>{String(x.display_name)} · {String(x.member_role)}</option>)}</select><input name="rollNumber" placeholder="Optional roll number"/><Button disabled={busy}>Add to batch</Button></form>
          </>}
          {view === "COURSES" && <>
            <form onSubmit={(e) => void submit(e, "CREATE_SUBJECT", (f) => ({ name: value(f,"name"), code: value(f,"code") || null }))} className="compact-form"><h3>Subject</h3><input name="name" required placeholder="Physics"/><input name="code" placeholder="PHY"/><Button disabled={busy}>Create subject</Button></form>
            <form onSubmit={(e) => void submit(e, "CREATE_COURSE", (f) => ({ title: value(f,"title"), description: value(f,"description") || null, subjectId: value(f,"subjectId") || null }))} className="compact-form"><h3>Draft course</h3><input name="title" required placeholder="JEE Electrodynamics"/><select name="subjectId"><option value="">No subject</option>{data.subjects.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><textarea name="description" placeholder="Course description"/><Button disabled={busy}>Create draft</Button></form>
          </>}
          {view === "CAMPUSES" && <>
            <form onSubmit={(e) => void submit(e, "CREATE_CAMPUS", (f) => ({ name: value(f,"name"), address: { city: value(f,"city"), state: value(f,"state") } }))} className="compact-form"><h3>Campus</h3><input name="name" required placeholder="North Campus"/><div><input name="city" placeholder="Kota"/><input name="state" placeholder="Rajasthan"/></div><Button disabled={busy}>Create campus</Button></form>
            <form onSubmit={(e) => void submit(e, "CREATE_ROOM", (f) => ({ campusId: value(f,"campusId"), name: value(f,"name"), capacity: Number(value(f,"capacity")), facilities: [] }))} className="compact-form"><h3>Room</h3><select name="campusId" required><option value="">Choose campus</option>{data.campuses.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><input name="name" required placeholder="Hall 101"/><input name="capacity" required type="number" min="1" placeholder="Capacity"/><Button disabled={busy}>Create room</Button></form>
            <form onSubmit={(e) => void submit(e, "CREATE_SCHEDULE", (f) => ({ roomId: value(f,"roomId"), batchId: value(f,"batchId"), facultyMemberId: value(f,"facultyMemberId"), subject: value(f,"subject"), dayOfWeek: value(f,"dayOfWeek"), startsAt: value(f,"startsAt"), endsAt: value(f,"endsAt") }))} className="compact-form"><h3>Timetable slot</h3><select name="roomId" required><option value="">Choose room</option>{data.rooms.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><select name="batchId" required><option value="">Choose batch</option>{data.batches.map((x) => <option key={String(x.id)} value={String(x.id)}>{String(x.name)}</option>)}</select><select name="facultyMemberId" required><option value="">Choose faculty</option>{data.faculty.map((x) => <option key={String(x.member_id)} value={String(x.member_id)}>{String(x.display_name)}</option>)}</select><input name="subject" required placeholder="Physics"/><select name="dayOfWeek"><option>MON</option><option>TUE</option><option>WED</option><option>THU</option><option>FRI</option><option>SAT</option><option>SUN</option></select><div><input name="startsAt" type="time" required/><input name="endsAt" type="time" required/></div><Button disabled={busy}>Schedule class</Button></form>
          </>}
        </section>

        <section className="panel academic-records">
          <h2>{view === "BATCHES" ? "Current batches" : view === "COURSES" ? "Course catalogue" : "Rooms & weekly timetable"}</h2>
          {view === "BATCHES" && data.batches.map((x) => (
            <article key={String(x.id)}>
              <div>
                <strong>{String(x.name)}</strong>
                <small>{Number(x.student_count ?? 0)} enrolled student{Number(x.student_count) === 1 ? "" : "s"} · {String(x.grade_level ?? "All grades")} · {String(x.target_exam).replaceAll("_", " ")}</small>
              </div>
              <Badge variant={x.is_active ? "success" : "neutral"}>{x.is_active ? "ACTIVE" : "INACTIVE"}</Badge>
            </article>
          ))}
          {view === "COURSES" && data.courses.map((x) => <article key={String(x.id)}><div><strong>{String(x.title)}</strong><small>{String(x.description ?? "No description")}</small></div><Badge variant="neutral">{String(x.status)}</Badge></article>)}
          {view === "CAMPUSES" && <>{data.rooms.map((x) => <article key={String(x.id)}><div><strong>{String(x.name)}</strong><small>Capacity {String(x.capacity)} · {String(x.status)}</small></div></article>)}<h3>Schedule</h3>{data.schedules.map((x) => <article key={String(x.id)}><div><strong>{String(x.day_of_week)} · {String(x.time_slot)}</strong><small>{String(x.subject)} · {String(data.batches.find((b) => b.id === x.batch_id)?.name ?? "Batch")}</small></div></article>)}</>}
          {((view === "BATCHES" && !data.batches.length) || (view === "COURSES" && !data.courses.length) || (view === "CAMPUSES" && !data.rooms.length)) && <p className="empty-state">No records yet. Use the forms to create the first one.</p>}
        </section>
      </div>
    </DashboardLayout>
  );
}
