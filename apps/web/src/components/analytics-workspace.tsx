"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, mapMembershipRole } from "@/components/dashboard-layout";
import { GuardianAccess } from "@/components/guardian-access";
import { resolveActiveOrganization } from "@/lib/client-org";

type Summary = { students: number | null; activeBatches: number; attendanceRate: number | null; assessmentAverage: number | null; assignments: number; submittedAssignments: number; assignmentsWithSubmissions: number };
type Schedule = { id: string; title: string; starts_at: string; ends_at: string };
type Class = { id: string; subject: string; day_of_week: string; starts_at: string | null };
type Notice = { id: string; title: string };
type Data = { role: string; notices?: Notice[]; upcoming?: Schedule[]; classes?: Class[]; pendingGrading?: number | null;
  pendingAssignments?: { id: string; title: string; due_at: string | null }[]; summary: Summary; batches: { id: string; name: string; target_exam: string | null; grade_level: string | null; student_count: number }[]; attendanceTrend: { date: string; rate: number }[]; attempts: { id: string; percentage: number | string | null; submitted_at: string | null }[]; assignments: { id: string; title: string; status: string; due_at: string }[] };
const empty: Data = { role: "", summary: { students: null, activeBatches: 0, attendanceRate: null, assessmentAverage: null, assignments: 0, submittedAssignments: 0, assignmentsWithSubmissions: 0 }, batches: [], attendanceTrend: [], attempts: [], assignments: [] };
const display = (value: number | null, suffix = "") => value === null ? "No data" : `${value}${suffix}`;

export function AnalyticsWorkspace({ reportMode = false }: { reportMode?: boolean }) {
  const [data, setData] = useState<Data>(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      setLoading(true);
      setError("");
      setData(empty);
      try {
        const selection = await resolveActiveOrganization();
        if (controller.signal.aborted) return;
        const active = selection?.organization ?? null;
        if (!active) {
          setError("Select an institute to view analytics.");
          return;
        }
        const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/analytics${reportMode ? "?report=1" : ""}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok || !result) setError(result?.error ?? "Unable to load analytics.");
        else setData(result);
      } catch {
        if (!controller.signal.aborted) setError("Unable to load analytics.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    window.addEventListener("prepzii:organization-changed", load);
    return () => {
      pending?.abort();
      window.removeEventListener("prepzii:organization-changed", load);
    };
  }, [reportMode]);

  function exportCsv() {
    const rows = [["Batch", "Target exam", "Grade", "Students"], ...data.batches.map((batch) => [batch.name, batch.target_exam ?? "", batch.grade_level ?? "", String(batch.student_count)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `prepzii-batch-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const submissionRate = data.summary.assignments ? Math.round(data.summary.assignmentsWithSubmissions / data.summary.assignments * 100) : null;
  const title = reportMode ? "Reports & analytics" : data.role === "STUDENT" ? "My learning overview" : data.role === "TEACHER" ? "My teaching overview" : data.role === "PARENT" ? "Parent overview" : data.role === "COACHING_ADMIN" ? "Manager overview" : "Institute overview";
  return <DashboardLayout title={title} subtitle="Live, role-scoped operational data" welcome={!reportMode} currentRole={data.role ? mapMembershipRole(data.role) : undefined} action={reportMode && data.batches.length ? <Button onClick={exportCsv}>Download batch CSV</Button> : undefined}>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}
    {data.role === "PARENT" && !reportMode ? <><GuardianAccess /><DashboardNotices notices={data.notices} /></> : loading ?
      <p className="empty-state">Loading dashboard…</p> : error ? null : <>
      {!reportMode && ["OWNER", "COACHING_ADMIN"].includes(data.role) && !data.batches.length &&
        <Panel title="Set up your institute"><p>Create a batch to assign faculty and enroll students.</p>
          <Link href="/dashboard/batches/workspace">Open Batches & Courses</Link>
        </Panel>}
      {!reportMode && ["TEACHER", "STUDENT"].includes(data.role) && <div className="dashboard-grid">
        <Panel title="Upcoming and available tests" action={<Link href="/dashboard/assessments/workspace">Open assessments</Link>}>
          {data.upcoming?.length ? <ul>{data.upcoming.map((test) => <li key={test.id}>{test.title} · {new Date(test.starts_at).toLocaleString()}</li>)}</ul> : <p>No upcoming tests.</p>}
        </Panel>
        {data.role === "TEACHER" ? <Panel title="Teaching tasks">
          <p>{data.pendingGrading ?? 0} assignment submissions awaiting grading.</p>
          <Link href="/dashboard/assignments">Open assignments</Link>{" · "}<Link href="/dashboard/attendance/workspace">Mark attendance</Link>
          <h3>Weekly class schedule</h3>
          {data.classes?.length ? <ul>{data.classes.map((item) => <li key={item.id}>{item.subject} · {item.day_of_week} {item.starts_at?.slice(0, 5)}</li>)}</ul> : <p>No classes scheduled.</p>}
        </Panel> : <Panel title="Pending assignments" action={<Link href="/dashboard/assignments">Open assignments</Link>}>
          {data.pendingAssignments?.length ? <ul>{data.pendingAssignments.map((item) => <li key={item.id}>{item.title}{item.due_at ? ` · Due ${new Date(item.due_at).toLocaleString()}` : ""}</li>)}</ul> : <p>No pending assignments.</p>}
          <Link href="/dashboard/courses">My courses</Link>
        </Panel>}
      </div>}
      {!reportMode && data.role === "STUDENT" && <DashboardNotices notices={data.notices} />}
      <div className="metrics-grid">
        {data.summary.students !== null && <MetricCard label={data.role === "STUDENT" ? "Learner" : "Active students"} value={String(data.summary.students)} detail={`${data.summary.activeBatches} visible batches`} accent="yellow"/>}
        <MetricCard label="Attendance" value={display(data.summary.attendanceRate, "%")} detail="Visible recorded sessions" accent="green"/>
        <MetricCard label="Assessment average" value={display(data.summary.assessmentAverage, "%")} detail="Submitted visible attempts" accent="navy"/>
        <MetricCard label="Assignment submissions" value={String(data.summary.submittedAssignments)} detail={`${data.summary.assignments} visible assignments`} accent="blue"/>
      </div>
      <div className="dashboard-grid">
        <Panel title="Attendance trend" action={<Link className="text-link" href="/dashboard/attendance/workspace">Open register →</Link>}><div className="analytics-trend">{data.attendanceTrend.map((point) => <div key={point.date}><span title={`${point.rate}%`} style={{ height: `${Math.max(3, point.rate)}%` }}/><small>{new Date(`${point.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</small></div>)}{!data.attendanceTrend.length && <p className="empty-state">No visible attendance sessions yet.</p>}</div></Panel>
        <Panel title={data.role === "STUDENT" ? "Assignment completion" : "Assignments with submissions"}>
          {submissionRate === null ? <p className="empty-state">No visible assignments.</p> : <div className="analytics-completion">
            <strong>{submissionRate}%</strong><ProgressBar value={submissionRate}/>
            <small>{data.summary.assignmentsWithSubmissions} of {data.summary.assignments} visible assignments have a submitted or graded latest attempt.</small>
          </div>}
        </Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Visible batches"><div className="analytics-list">{data.batches.map((batch) => <article key={batch.id}><div><strong>{batch.name}</strong><small>{batch.target_exam?.replaceAll("_", " ") ?? "Exam not set"} · {batch.grade_level || "Grade not set"}</small></div><Badge variant="info">{batch.student_count} students</Badge></article>)}{!data.batches.length && <p className="empty-state">No batches available for this role.</p>}</div></Panel>
        <Panel title="Recent assessment outcomes"><div className="analytics-list">{data.attempts.map((attempt) => <article key={attempt.id}><div><strong>{display(attempt.percentage === null ? null : Number(attempt.percentage), "%")}</strong><small>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString("en-IN") : "Submitted"}</small></div><Badge variant="neutral">Submitted</Badge></article>)}{!data.attempts.length && <p className="empty-state">No submitted attempts visible.</p>}</div></Panel>
      </div>
      {reportMode && <p className="readiness-note">Reports contain only data authorized for the signed-in role. Guardian summaries are available in the guardian workspace for owner-approved links.</p>}
    </>}
  </DashboardLayout>;
}


function DashboardNotices({ notices }: { notices?: Notice[] }) {
  return <Panel title="Latest announcements" action={<Link href="/dashboard/announcements">Open announcements</Link>}>
    {notices?.length ? <ul>{notices.map(({ id, title }) => <li key={id}>{title}</li>)}</ul> : <p>No published announcements.</p>}
  </Panel>;
}
