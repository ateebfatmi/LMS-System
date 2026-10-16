"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, type AppRole } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Summary = { students: number | null; activeBatches: number; attendanceRate: number | null; assessmentAverage: number | null; assignments: number; submittedAssignments: number; feeCollectedPaise: number | null; feeOutstandingPaise: number | null };
type Data = { role: string; summary: Summary; batches: { id: string; name: string; target_exam: string; grade_level: string | null; student_count: number }[]; attendanceTrend: { date: string; rate: number }[]; attempts: { id: string; percentage: number | string | null; submitted_at: string | null }[]; assignments: { id: string; title: string; status: string; due_at: string }[] };
const empty: Data = { role: "", summary: { students: null, activeBatches: 0, attendanceRate: null, assessmentAverage: null, assignments: 0, submittedAssignments: 0, feeCollectedPaise: null, feeOutstandingPaise: null }, batches: [], attendanceTrend: [], attempts: [], assignments: [] };
const money = (paise: number | null) => paise === null ? "Restricted" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
const display = (value: number | null, suffix = "") => value === null ? "No data" : `${value}${suffix}`;
const appRole = (role: string): AppRole => role === "STUDENT" ? "STUDENT" : role === "PARENT" ? "PARENT" : role === "TEACHER" ? "FACULTY" : role === "ACADEMIC_COORDINATOR" ? "COORDINATOR" : role === "ACCOUNTANT" ? "ACCOUNTANT" : "DIRECTOR";

export function AnalyticsWorkspace({ reportMode = false }: { reportMode?: boolean }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/analytics`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to load analytics."); else { setData(result); setError(""); }
    setLoading(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function fetchActive() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      if (cancelled) return;
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) {
        await load(active);
      } else {
        // Fallback: fetch available organizations and auto-select first one
        const orgsRes = await fetch("/api/organizations", { cache: "no-store" });
        if (orgsRes.ok) {
          const list = (await orgsRes.json()).organizations as Organization[];
          if (list && list[0]) {
            setOrganization(list[0]);
            await load(list[0]);
            return;
          }
        }
        setError("Select an institute to view analytics.");
        setLoading(false);
      }
    }
    void fetchActive();

    const handleOrgChange = () => {
      void fetchActive();
    };
    window.addEventListener("prepzii:organization-changed", handleOrgChange);
    return () => {
      cancelled = true;
      window.removeEventListener("prepzii:organization-changed", handleOrgChange);
    };
  }, [load]);

  function exportCsv() {
    const rows = [["Batch", "Target exam", "Grade", "Students"], ...data.batches.map((batch) => [batch.name, batch.target_exam, batch.grade_level ?? "", String(batch.student_count)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `prepzii-batch-report-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const submissionRate = data.summary.assignments ? Math.min(100, Math.round(data.summary.submittedAssignments / data.summary.assignments * 100)) : 0;
  const title = reportMode ? "Reports & analytics" : data.role === "STUDENT" ? "My learning overview" : data.role === "TEACHER" ? "My teaching overview" : data.role === "ACCOUNTANT" ? "Finance overview" : "Institute overview";
  return <DashboardLayout title={title} subtitle={`${organization?.name ?? "Institute"} · Live, role-scoped operational data`} currentRole={appRole(data.role)} action={reportMode && data.batches.length ? <Button onClick={exportCsv}>Download batch CSV</Button> : undefined}>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}
    {loading ? <p className="empty-state">Loading tenant analytics…</p> : <>
      <div className="metrics-grid">
        {data.summary.students !== null && <MetricCard label={data.role === "STUDENT" ? "Learner" : "Active students"} value={String(data.summary.students)} detail={`${data.summary.activeBatches} visible batches`} accent="yellow"/>}
        <MetricCard label="Attendance" value={display(data.summary.attendanceRate, "%")} detail="Visible recorded sessions" accent="green"/>
        <MetricCard label="Assessment average" value={display(data.summary.assessmentAverage, "%")} detail="Submitted visible attempts" accent="navy"/>
        <MetricCard label="Assignment submissions" value={String(data.summary.submittedAssignments)} detail={`${data.summary.assignments} visible assignments`} accent="blue"/>
        {data.summary.feeCollectedPaise !== null && <MetricCard label="Fees collected" value={money(data.summary.feeCollectedPaise)} detail={`${money(data.summary.feeOutstandingPaise)} outstanding`} accent="orange"/>}
      </div>
      {data.role === "PARENT" && <Panel title="Guardian access pending"><p className="empty-state">Attendance, fees and results remain private until a reviewed guardian–student relationship is configured.</p></Panel>}
      <div className="dashboard-grid">
        <Panel title="Attendance trend" action={<Link className="text-link" href="/dashboard/attendance">Open register →</Link>}><div className="analytics-trend">{data.attendanceTrend.map((point) => <div key={point.date}><span title={`${point.rate}%`} style={{ height: `${Math.max(3, point.rate)}%` }}/><small>{new Date(`${point.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</small></div>)}{!data.attendanceTrend.length && <p className="empty-state">No visible attendance sessions yet.</p>}</div></Panel>
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
