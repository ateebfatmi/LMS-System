"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, mapMembershipRole } from "@/components/dashboard-layout";
import { resolveActiveOrganization } from "@/lib/client-org";

type Organization = { name: string; slug: string };
type Summary = { students: number | null; activeBatches: number; attendanceRate: number | null; assessmentAverage: number | null; assignments: number; submittedAssignments: number };
type Data = { role: string; summary: Summary; batches: { id: string; name: string; target_exam: string; grade_level: string | null; student_count: number }[]; attendanceTrend: { date: string; rate: number }[]; attempts: { id: string; percentage: number | string | null; submitted_at: string | null }[]; assignments: { id: string; title: string; status: string; due_at: string }[] };
const empty: Data = { role: "", summary: { students: null, activeBatches: 0, attendanceRate: null, assessmentAverage: null, assignments: 0, submittedAssignments: 0 }, batches: [], attendanceTrend: [], attempts: [], assignments: [] };
const display = (value: number | null, suffix = "") => value === null ? "No data" : `${value}${suffix}`;

export function AnalyticsWorkspace({ reportMode = false }: { reportMode?: boolean }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
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
        setOrganization(active);
        if (!active) {
          setError("Select an institute to view analytics.");
          return;
        }
        const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/analytics`, {
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
  }, []);

  function exportCsv() {
    const rows = [["Batch", "Target exam", "Grade", "Students"], ...data.batches.map((batch) => [batch.name, batch.target_exam, batch.grade_level ?? "", String(batch.student_count)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `prepzii-batch-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const submissionRate = data.summary.assignments ? Math.min(100, Math.round(data.summary.submittedAssignments / data.summary.assignments * 100)) : 0;
  const title = reportMode ? "Reports & analytics" : data.role === "STUDENT" ? "My learning overview" : data.role === "TEACHER" ? "My teaching overview" : "Institute overview";
  return <DashboardLayout title={title} subtitle={`${organization?.name ?? "Institute"} · Live, role-scoped operational data`} currentRole={data.role ? mapMembershipRole(data.role) : undefined} action={reportMode && data.batches.length ? <Button onClick={exportCsv}>Download batch CSV</Button> : undefined}>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}
    {loading ? <p className="empty-state">Loading tenant analytics…</p> : <>
      <div className="metrics-grid">
        {data.summary.students !== null && <MetricCard label={data.role === "STUDENT" ? "Learner" : "Active students"} value={String(data.summary.students)} detail={`${data.summary.activeBatches} visible batches`} accent="yellow"/>}
        <MetricCard label="Attendance" value={display(data.summary.attendanceRate, "%")} detail="Visible recorded sessions" accent="green"/>
        <MetricCard label="Assessment average" value={display(data.summary.assessmentAverage, "%")} detail="Submitted visible attempts" accent="navy"/>
        <MetricCard label="Assignment submissions" value={String(data.summary.submittedAssignments)} detail={`${data.summary.assignments} visible assignments`} accent="blue"/>
      </div>
      <div className="dashboard-grid">
        <Panel title="Attendance trend" action={<Link className="text-link" href="/dashboard/attendance/workspace">Open register →</Link>}><div className="analytics-trend">{data.attendanceTrend.map((point) => <div key={point.date}><span title={`${point.rate}%`} style={{ height: `${Math.max(3, point.rate)}%` }}/><small>{new Date(`${point.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</small></div>)}{!data.attendanceTrend.length && <p className="empty-state">No visible attendance sessions yet.</p>}</div></Panel>
        <Panel title="Assignment completion"><div className="analytics-completion"><strong>{submissionRate}%</strong><ProgressBar value={submissionRate} variant={submissionRate >= 75 ? "success" : "warning"}/><small>Submission records across assignments visible to your role.</small></div></Panel>
      </div>
      <div className="dashboard-grid">
        <Panel title="Visible batches"><div className="analytics-list">{data.batches.map((batch) => <article key={batch.id}><div><strong>{batch.name}</strong><small>{batch.target_exam.replaceAll("_", " ")} · {batch.grade_level || "Grade not set"}</small></div><Badge variant="info">{batch.student_count} students</Badge></article>)}{!data.batches.length && <p className="empty-state">No batches available for this role.</p>}</div></Panel>
        <Panel title="Recent assessment outcomes"><div className="analytics-list">{data.attempts.map((attempt) => <article key={attempt.id}><div><strong>{display(attempt.percentage === null ? null : Number(attempt.percentage), "%")}</strong><small>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString("en-IN") : "Submitted"}</small></div><Badge variant={Number(attempt.percentage) >= 60 ? "success" : "warning"}>Submitted</Badge></article>)}{!data.attempts.length && <p className="empty-state">No submitted attempts visible.</p>}</div></Panel>
      </div>
      {reportMode && <p className="readiness-note">Reports contain only data authorized for the signed-in role. Student-level exports and guardian reports remain unavailable until their reviewed scoping relationships exist.</p>}
    </>}
  </DashboardLayout>;
}
