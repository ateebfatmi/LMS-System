"use client";

import { useState, useEffect } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { InstituteAnalyticsSummary } from "@/lib/dal/analytics-repository";
import { getActiveOrganizationId, useActiveOrganizationId } from "@/lib/client-org";

export default function ReportsPage() {
  const activeOrganizationId = useActiveOrganizationId();
  const [analytics, setAnalytics] = useState<InstituteAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        const orgId = getActiveOrganizationId();
        const url = orgId ? `/api/analytics?organizationId=${encodeURIComponent(orgId)}` : "/api/analytics";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [activeOrganizationId]);

  const totalStudents = analytics?.batchBenchmarks?.reduce((acc, b) => acc + (b.studentCount || 0), 0) || 0;

  return (
    <DashboardLayout
      title="Academic Analytics & Performance Trends"
      subtitle="Comprehensive performance indicators, successive assessment score deltas, chapter mastery matrices, and intervention heuristics"
      action={
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="outline" onClick={() => setShowFormulaModal(true)}>
            ℹ️ Formula Transparency
          </Button>
          <Button variant="primary" onClick={() => alert(`PTM Report Cards Generated for ${totalStudents} students.`)}>
            📥 Generate PTM Report Cards
          </Button>
        </div>
      }
    >
      <div className="metrics-grid">
        <MetricCard
          label="Institute Average Score"
          value={loading ? "..." : `${analytics?.overallAverageScore ?? 0}%`}
          detail={<><b>↑ 0%</b> on recent CBT tests</>}
          accent="yellow"
        />
        <MetricCard
          label="Top 1% Rankers"
          value={loading ? "..." : `${analytics?.topRankersCount ?? 0} Students`}
          detail="Projected <1000 AIR"
          accent="green"
        />
        <MetricCard
          label="Need Academic Focus"
          value={loading ? "..." : `${analytics?.atRiskCount ?? 0} Students`}
          detail="Score <60% or Attd <88%"
          accent="orange"
        />
        <MetricCard
          label="Institute Attendance"
          value={loading ? "..." : `${analytics?.overallAttendanceRate ?? 0}%`}
          detail="Daily weighted batch average"
          accent="blue"
        />
      </div>

      {/* Successive Test Improvement & Difficulty Weighting */}
      <div style={{ marginTop: "16px" }}>
        <Panel
          title="Successive Assessment Trends & Exam Difficulty Weighting"
          subtitle="Tracks average score delta between test iterations, normalizing for JEE Advanced vs Mains complexity"
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test Title</th>
                  <th>Pattern & Difficulty</th>
                  <th>Batch Average</th>
                  <th>Prior Average</th>
                  <th>Score Delta (Δ)</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.assessmentTrends || []).map((t) => (
                  <tr key={t.testId}>
                    <td>
                      <strong>{t.testTitle}</strong>
                    </td>
                    <td>
                      <Badge variant={t.pattern === "JEE_ADVANCED" ? "brand" : "info"} size="sm">
                        {t.pattern} · Weight {t.difficultyWeight}x
                      </Badge>
                    </td>
                    <td>
                      <strong>{t.batchAverage}%</strong>
                    </td>
                    <td>
                      <span style={{ color: "var(--muted)" }}>{t.previousBatchAverage}%</span>
                    </td>
                    <td>
                      <strong style={{ color: t.scoreDeltaPercent >= 0 ? "#16a34a" : "#dc2626" }}>
                        {t.scoreDeltaPercent >= 0 ? `+${t.scoreDeltaPercent}%` : `${t.scoreDeltaPercent}%`}
                      </strong>
                    </td>
                    <td>
                      <Badge variant={t.trend === "IMPROVING" ? "success" : "neutral"} size="sm">
                        {t.trend}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="card-grid-2" style={{ marginTop: "16px" }}>
        <Panel
          title="Subject Strength & Chapter Mastery"
          subtitle="Requires ≥ 3 verified test attempts before issuing definitive mastery badge"
        >
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            {(analytics?.chapterMasteries || []).map((m) => (
              <div key={m.chapter}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span>
                    <strong>{m.subject}:</strong> {m.chapter}{" "}
                    {m.isPreliminary && (
                      <span style={{ fontSize: "11px", color: "#b45309" }}>(Preliminary: {m.attemptsCount}/3 attempts)</span>
                    )}
                  </span>
                  <span
                    style={{
                      color:
                        m.status === "STRONG"
                          ? "#166534"
                          : m.status === "MODERATE"
                          ? "#854d0e"
                          : m.status === "PRELIMINARY"
                          ? "#b45309"
                          : "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    {m.accuracyPercentage}% ({m.status.replace("_", " ")})
                  </span>
                </div>
                <ProgressBar
                  value={m.accuracyPercentage}
                  variant={m.status === "STRONG" ? "success" : m.status === "MODERATE" ? "default" : "warning"}
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Batch Benchmark Comparison (Average Score)">
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            {(analytics?.batchBenchmarks || []).map((b) => (
              <div key={b.batchId}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span><strong>{b.batchName}</strong> ({b.studentCount} students)</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Avg: <strong>{b.averageScore}%</strong></span>
                    <Badge variant="purple" size="sm">{b.attendanceRate}% Attd</Badge>
                  </div>
                </div>
                <ProgressBar value={b.syllabusProgress} variant="default" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Panel
          title="Students Recommended for Academic Intervention"
          subtitle="Identified deterministically by test score and attendance rules without unsupported AI claims"
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Test Score</th>
                  <th>Attendance</th>
                  <th>Identified Vulnerabilities</th>
                  <th>Recommended Teacher Intervention</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.atRiskStudents || []).map((risk) => (
                  <tr key={risk.student.id}>
                    <td>
                      <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                        {risk.student.rollNumber}
                      </code>
                    </td>
                    <td>
                      <strong>{risk.student.name}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>{risk.student.batchName}</span>
                    </td>
                    <td>
                      <strong style={{ color: risk.student.averageScore < 70 ? "#d97706" : "inherit" }}>
                        {risk.student.averageScore}%
                      </strong>
                    </td>
                    <td>
                      <span style={{ color: risk.student.attendancePercentage < 90 ? "#dc2626" : "inherit" }}>
                        {risk.student.attendancePercentage}%
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {risk.reasons.join(" · ")}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>
                          {risk.recommendedAction}
                        </span>
                        <Button variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>
                          Assign DPP
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Formula Transparency Modal */}
      {showFormulaModal && analytics?.metricDocs && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "600px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)" }}>
              Analytics Formula Transparency
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              PrepZii B2B calculates all academic metrics deterministically without black-box or unsupported AI models.
            </p>

            <div style={{ display: "grid", gap: "16px" }}>
              {analytics.metricDocs.map((doc) => (
                <div key={doc.metricName} style={{ border: "1px solid var(--line)", padding: "12px", borderRadius: "8px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "13px" }}>{doc.metricName}</strong>
                    <code style={{ fontSize: "11px", background: "#e2e8f0", padding: "2px 6px", borderRadius: "4px" }}>{doc.formula}</code>
                  </div>
                  <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--muted)" }}>{doc.explanation}</p>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                    <strong>Thresholds:</strong> {Object.entries(doc.thresholds).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <Button variant="primary" onClick={() => setShowFormulaModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
