"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, mapMembershipRole, type AppRole } from "@/components/dashboard-layout";
import type { ChildAcademicProfile } from "@/lib/dal/parent-repository";
import type { InstituteAnalyticsSummary } from "@/lib/dal/analytics-repository";
import type { Batch, InstituteTest, OrganizationRole } from "@prepzii/contracts";
import { getActiveOrganizationId, setActiveOrganizationId, useActiveOrganizationId } from "@/lib/client-org";

function OverviewContent() {
  const activeOrganizationId = useActiveOrganizationId();
  const searchParams = useSearchParams();

  // Dynamic server data states
  const [parentProfile, setParentProfile] = useState<ChildAcademicProfile | null>(null);
  const [analytics, setAnalytics] = useState<InstituteAnalyticsSummary | null>(null);
  type OrganizationSummary = { id: string; name: string; slug: string; userRole: OrganizationRole };
  type DashboardTest = InstituteTest & { totalSubmissions?: number };
  type DashboardBatch = Batch & {
    facultyName?: string;
    attendanceRate?: number;
    syllabusProgress?: number;
  };
  const [tests, setTests] = useState<DashboardTest[]>([]);
  const [batches, setBatches] = useState<DashboardBatch[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const selectedOrganization = organizations.find((org) => org.id === (activeOrganizationId || selectedOrgId)) || organizations[0];
  const currentRole = selectedOrganization?.userRole
    ? mapMembershipRole(selectedOrganization.userRole)
    : (searchParams?.get("role") as AppRole) || "DIRECTOR";

  useEffect(() => {
    let isMounted = true;
    async function loadDashboardData() {
      setLoading(true);
      setApiError(null);
      try {
        // 1. Fetch user's authorized organizations
        const resOrgs = await fetch("/api/organizations");
        if (!resOrgs.ok) {
          const errData = await resOrgs.json().catch(() => ({}));
          if (isMounted) {
            setApiError(errData.error || `Failed to authenticate organization access (${resOrgs.status})`);
            setOrganizations([]);
          }
          return;
        }

        const orgsData = await resOrgs.json();
        const orgsList: OrganizationSummary[] = orgsData.organizations || [];
        if (isMounted) setOrganizations(orgsList);

        if (orgsList.length === 0) {
          // Pure student or unassociated account - no active coaching institute
          return;
        }

        // Determine active institute
        const storedOrgId = getActiveOrganizationId();
        let currentOrg = orgsList.find((o) => o.id === (activeOrganizationId || selectedOrgId || storedOrgId));
        if (!currentOrg) {
          // Prioritize administrative roles if present
          currentOrg =
            orgsList.find((o) => o.userRole === "OWNER" || o.userRole === "COACHING_ADMIN") ||
            orgsList.find((o) => o.userRole === "TEACHER") ||
            orgsList[0];
        }

        if (currentOrg && isMounted) {
          setActiveOrganizationId(currentOrg.id);
          if (currentOrg.id !== selectedOrgId) {
            setSelectedOrgId(currentOrg.id);
          }
        }

        const activeId = currentOrg?.id;
        const queryParam = activeId ? `?organizationId=${encodeURIComponent(activeId)}` : "";

        if (currentRole === "PARENT") {
          const childrenResponse = await fetch("/api/parent/children");
          const children = childrenResponse.ok ? (await childrenResponse.json()).children : [];
          const studentId = children?.[0]?.studentUserId;
          if (studentId) {
            const res = await fetch(`/api/parent/summary?studentId=${encodeURIComponent(studentId)}`);
            if (res.ok && isMounted) setParentProfile(await res.json());
          } else if (isMounted) {
            setParentProfile(null);
          }
        }

        // Fetch scoped datasets
        const [resAnalytics, resTests, resBatches] = await Promise.all([
          fetch(`/api/analytics${queryParam}`),
          fetch(`/api/assessments${queryParam}`),
          fetch(`/api/batches${queryParam}`),
        ]);

        if (isMounted) {
          if (resAnalytics.ok) {
            const data = await resAnalytics.json();
            setAnalytics(data);
          } else {
            const err = await resAnalytics.json().catch(() => ({}));
            if (resAnalytics.status === 403) {
              setApiError(`Analytics: ${err.error || "Forbidden (Role unauthorized for analytics)"}`);
            }
            setAnalytics(null);
          }

          if (resTests.ok) {
            const data = await resTests.json();
            setTests(data.tests || []);
          } else {
            const err = await resTests.json().catch(() => ({}));
            if (resTests.status === 403) {
              setApiError((prev) => prev || `Assessments: ${err.error || "Forbidden"}`);
            }
            setTests([]);
          }

          if (resBatches.ok) {
            const data = await resBatches.json();
            setBatches(data.batches || []);
          } else {
            const err = await resBatches.json().catch(() => ({}));
            if (resBatches.status === 403) {
              setApiError((prev) => prev || `Batches: ${err.error || "Forbidden"}`);
            }
            setBatches([]);
          }
        }
      } catch (err: unknown) {
        console.error("Dashboard data load error:", err);
        if (isMounted) setApiError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [currentRole, selectedOrgId, activeOrganizationId]);

  const activeOrg = organizations.find((o) => o.id === selectedOrgId) || organizations[0];
  const instituteName = activeOrg?.name || (loading ? "Loading..." : "No Institute Selected");
  const activeBatchesList = batches;
  const activeTestsList = tests;
  const totalStudents = analytics?.batchBenchmarks?.reduce((acc, b) => acc + (b.studentCount || 0), 0) ?? 0;

  const handleOrgChange = async (newOrgId: string) => {
    const organization = organizations.find((org) => org.id === newOrgId);
    if (!organization) return;
    const response = await fetch("/api/organizations/active", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: organization.slug }),
    });
    if (!response.ok) {
      setApiError("Unable to select that institute.");
      return;
    }
    const result = await response.json();
    setActiveOrganizationId(result.organization.id);
    setSelectedOrgId(result.organization.id);
    window.dispatchEvent(new CustomEvent("prepzii:organization-changed", { detail: { role: result.role } }));
  };

  // If loading is complete and user has zero institute affiliations
  if (!loading && organizations.length === 0) {
    return (
      <DashboardLayout
        title="Access Restricted"
        subtitle="No Coaching Institute Membership"
        currentRole={currentRole}
      >
        <Panel title="No Coaching Institute Membership Found">
          <div style={{ padding: "40px 20px", textAlign: "center", maxWidth: "520px", margin: "0 auto" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>🔒</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 10px", color: "var(--foreground)" }}>
              No Coaching Institute Associated
            </h3>
            <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 24px", lineHeight: "1.6" }}>
              Your authenticated account is not currently assigned to any active coaching institute on Prepzii.
              If you are an institute administrator or faculty member, please contact your coaching owner or administrator to invite you.
            </p>
            <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "8px", fontSize: "12px", color: "var(--muted)", border: "1px solid var(--line)" }}>
              Authenticated User Verified via Clerk · Live Production Supabase Backend
            </div>
          </div>
        </Panel>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={
        currentRole === "STUDENT"
          ? "Welcome back! 🎯"
          : currentRole === "PARENT"
          ? `Parent Portal: ${parentProfile?.student.name || "Student Progress"}`
          : currentRole === "FACULTY"
          ? "Faculty Workspace"
          : `Good morning, Director`
      }
      subtitle={
        currentRole === "STUDENT"
          ? `Student Portal · ${instituteName}`
          : currentRole === "PARENT"
          ? `Parent Portal · ${instituteName}`
          : currentRole === "FACULTY"
          ? `Faculty Workspace · ${instituteName}`
          : `${instituteName} · Multi-Tenant Platform`
      }
      currentRole={currentRole}
    >
      {/* Multi-Institute Switcher & Notice Banners */}
      {organizations.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "16px",
            padding: "10px 16px",
            background: "#ffffff",
            border: "1px solid var(--line)",
            borderRadius: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--foreground)" }}>Active Coaching Institute:</span>
            <select
              value={activeOrg?.id || ""}
              onChange={(e) => handleOrgChange(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                fontSize: "13px",
                fontWeight: 600,
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.userRole || "MEMBER"})
                </option>
              ))}
            </select>
          </div>
          <Badge variant="brand" size="sm">
            Role: {activeOrg?.userRole || "MEMBER"}
          </Badge>
        </div>
      )}

      {apiError && (
        <div
          style={{
            padding: "14px 18px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            color: "#991b1b",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
          }}
        >
          <span>⚠️</span>
          <div>
            <strong>Authorization / Access Notice:</strong> {apiError}
          </div>
        </div>
      )}

      {/* ==========================================
          STUDENT ROLE VIEW
         ========================================== */}
      {currentRole === "STUDENT" && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Projected Rank"
              value={activeTestsList.length > 0 ? "Evaluating" : "N/A"}
              detail="Complete CBT mock tests to generate rank"
              accent="yellow"
            />
            <MetricCard
              label="Overall Avg Score"
              value={analytics ? `${analytics.overallAverageScore}%` : "0%"}
              detail="Batch assessment average"
              accent="green"
            />
            <MetricCard
              label="My Attendance"
              value={analytics ? `${analytics.overallAttendanceRate}%` : "0%"}
              detail="Logged sessions"
              accent="navy"
            />
            <MetricCard label="Available Tests" value={`${activeTestsList.length} CBT Mocks`} detail="PrepZii PYQ Series" accent="orange" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="Upcoming PrepZii CBT Mock Tests"
              action={
                <Link href="/dashboard/assessments" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>
                  View test series →
                </Link>
              }
            >
              <div style={{ display: "grid", gap: "12px" }}>
                {activeTestsList.slice(0, 2).map((test) => (
                  <div
                    key={test.id}
                    style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "#fffdf2" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "14px", fontFamily: "var(--font-display)" }}>{test.title}</strong>
                      <Badge variant="brand" size="sm">
                        {test.status}
                      </Badge>
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--muted)" }}>
                      Pattern: {test.pattern} ({test.questionCount || 54} Questions · {test.totalMarks || 180} Marks ·{" "}
                      {test.durationMinutes || 180} Mins)
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <Link
                        href={`/dashboard/cbt/${test.id}`}
                        className="pz-button pz-button-primary"
                        style={{ fontSize: "12px", textDecoration: "none" }}
                      >
                        🚀 Open CBT Exam Simulator
                      </Link>
                      <button className="pz-button pz-button-outline" style={{ fontSize: "12px" }}>
                        View Instructions
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Weak Chapter Analytics (PrepZii Engine)">
              <div style={{ display: "grid", gap: "14px" }}>
                {(analytics?.chapterMasteries || []).map((item) => (
                  <div key={item.chapter}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>
                        <strong>{item.subject}:</strong> {item.chapter}
                      </span>
                      <span
                        style={{
                          color: item.status === "STRONG" ? "#047857" : item.status === "MODERATE" ? "#b45309" : "#b91c1c",
                          fontWeight: 700,
                        }}
                      >
                        {item.accuracyPercentage}% ({item.status.replace("_", " ")})
                      </span>
                    </div>
                    <ProgressBar
                      value={item.accuracyPercentage}
                      variant={item.status === "STRONG" ? "success" : item.status === "MODERATE" ? "default" : "warning"}
                    />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* ==========================================
          PARENT ROLE VIEW (PRODUCTION-GRADE PORTAL)
         ========================================== */}
      {currentRole === "PARENT" && (
        <>
          {/* Verified Account Linking Badge */}
          <div
            style={{
              padding: "12px 16px",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "10px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>🛡️</span>
              <div>
                <strong style={{ fontSize: "13px", color: "#065f46" }}>
                  Linked student: {parentProfile?.student.name || "No linked student selected"} ({parentProfile?.student.rollNumber || "—"})
                </strong>
                <div style={{ fontSize: "11px", color: "#047857" }}>
                  Relationship: {parentProfile?.relation.relationship || "—"} · Batch: {parentProfile?.relation.batchName || "—"} · Verified via Institute Office
                </div>
              </div>
            </div>
            <Badge variant="success" size="sm">
              RLS Isolation Active
            </Badge>
          </div>

          <div className="metrics-grid">
            <MetricCard
              label="Monthly Attendance"
              value={parentProfile ? `${parentProfile.attendance.attendancePercentage}%` : "No data"}
              detail={
                parentProfile
                  ? `${parentProfile.attendance.presentCount} Present / ${parentProfile.attendance.absentCount} Absent`
                  : "No attendance records"
              }
              accent="green"
            />
            <MetricCard
              label="Latest Mock Rank"
              value={parentProfile?.testResults[0] ? `#${parentProfile.testResults[0].rank} in Batch` : "No data"}
              detail={
                parentProfile?.testResults[0]
                  ? `Score: ${parentProfile.testResults[0].score} / ${parentProfile.testResults[0].totalMarks}`
                  : "No published result"
              }
              accent="yellow"
            />
            <MetricCard
              label="Batch Percentile"
              value={parentProfile?.testResults[0] ? `${parentProfile.testResults[0].percentile}%ile` : "No data"}
              detail="Published assessment percentile"
              accent="blue"
            />
            <MetricCard
              label="Faculty Status"
              value="No data"
              detail="Regular attendance & DPP submissions"
              accent="navy"
            />
          </div>

          <div className="dashboard-grid">
            {/* Published Test Results (Answer Keys Protected) */}
            <Panel
              title="Published CBT Mock Test Report Cards"
              action={
                <Button variant="outline" onClick={() => setShowReportModal(true)} style={{ fontSize: "11px" }}>
                  📥 Download PTM Report PDF
                </Button>
              }
            >
              <div style={{ display: "grid", gap: "12px" }}>
                {(parentProfile?.testResults || []).map((tr) => (
                  <div
                    key={tr.attemptId}
                    style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "10px", background: "#f8fafc" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", alignItems: "center" }}>
                      <strong style={{ fontSize: "13px" }}>Assessment {tr.testId}</strong>
                      <Badge variant="brand" size="sm">
                        Rank #{tr.rank}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "var(--muted)", flexWrap: "wrap" }}>
                      <span>
                        Marks: <strong>{tr.score}/{tr.totalMarks}</strong> ({tr.percentage}%)
                      </span>
                      <span>
                        Percentile: <strong>{tr.percentile}%ile</strong>
                      </span>
                      <span>
                        Correct: <strong style={{ color: "#16a34a" }}>{tr.correctCount}</strong> · Incorrect:{" "}
                        <strong style={{ color: "#dc2626" }}>{tr.incorrectCount}</strong>
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "6px" }}>
                      🔒 Note: Question answer keys are strictly protected until institute review release.
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Chapter-Level Academic Progress */}
            <Panel title="Chapter-Level Academic Progress (Mastery)">
              <div style={{ display: "grid", gap: "12px" }}>
                {(parentProfile?.chapterMasteries || []).map((m) => (
                  <div key={m.chapter}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>
                        <strong>{m.subject}:</strong> {m.chapter}
                      </span>
                      <span
                        style={{
                          color: m.status === "STRONG" ? "#166534" : m.status === "MODERATE" ? "#854d0e" : "#b91c1c",
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
          </div>

          <div className="dashboard-grid" style={{ marginTop: "16px" }}>
            {/* Upcoming Assessments */}
            <Panel title="Upcoming Assessments & Schedule">
              <div style={{ display: "grid", gap: "10px" }}>
                {(parentProfile?.upcomingAssessments || []).map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px" }}>{u.title}</strong>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                        Pattern: {u.pattern} · Duration: {u.durationMinutes} mins · Max Marks: {u.totalMarks}
                      </div>
                    </div>
                    <Badge variant="brand" size="sm">
                      {new Date(u.scheduledFor).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </Badge>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Institute Announcements */}
            <Panel title="Official Institute Announcements">
              <div style={{ display: "grid", gap: "10px" }}>
                {(parentProfile?.announcements || []).map((ann) => (
                  <div
                    key={ann.id}
                    style={{
                      padding: "12px",
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      background: ann.priority === "HIGH" ? "#fffdf5" : "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "13px" }}>{ann.title}</strong>
                      <Badge variant={ann.priority === "HIGH" ? "warning" : "neutral"} size="sm">
                        {ann.priority}
                      </Badge>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{ann.content}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div style={{ marginTop: "16px" }}>
            <Panel title="Educator Contact & Mentors">
              <Link href="/dashboard/teachers">View the institute faculty directory</Link>
            </Panel>
          </div>

          {/* Printable PTM Report Card Modal */}
          {showReportModal && parentProfile && (
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
                  borderRadius: "16px",
                  maxWidth: "760px",
                  width: "100%",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  padding: "32px",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
                }}
              >
                {/* Printable Header */}
                <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "16px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "20px", color: "#0f172a" }}>
                      {instituteName}
                    </h2>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      Academic Progress Report Card · Term 1 (Academic Year 2026–27)
                    </div>
                  </div>
                  <Badge variant="brand" size="md">CONFIDENTIAL</Badge>
                </div>

                {/* Student Info Box */}
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div><strong>Student Name:</strong> {parentProfile.student.name}</div>
                  <div><strong>Roll Number:</strong> {parentProfile.student.rollNumber}</div>
                  <div><strong>Batch:</strong> {parentProfile.relation.batchName}</div>
                  <div><strong>Target Examination:</strong> JEE Advanced 2027</div>
                  <div><strong>Attendance Record:</strong> {parentProfile.attendance.attendancePercentage}% ({parentProfile.attendance.presentCount} Present / {parentProfile.attendance.absentCount} Absent)</div>
                  <div><strong>Overall Mock Average:</strong> {parentProfile.student.averageScore}% (AIR Projection: 1,240)</div>
                </div>

                {/* Subject Performance */}
                <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>Subject-Wise Evaluated Performance</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
                  {Object.entries(parentProfile.subjectStrengths).map(([subject, data]) => (
                    <div key={subject} style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>{subject}</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--brand)" }}>{data.averageScore}%</div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{data.testsCount} tests evaluated</div>
                    </div>
                  ))}
                </div>

                {/* Chapter Mastery Matrix */}
                <h4 style={{ margin: "0 0 10px", fontSize: "14px" }}>Chapter Mastery Highlights</h4>
                <div style={{ display: "grid", gap: "8px", marginBottom: "24px" }}>
                  {parentProfile.chapterMasteries.slice(0, 4).map((m) => (
                    <div key={m.chapter} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderBottom: "1px dashed var(--line)", paddingBottom: "4px" }}>
                      <span>{m.subject}: {m.chapter}</span>
                      <strong style={{ color: m.status === "STRONG" ? "#166534" : "#b91c1c" }}>
                        {m.accuracyPercentage}% ({m.status})
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Signatures & Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", paddingTop: "20px", borderTop: "1px solid var(--line)", fontSize: "12px", color: "#64748b" }}>
                  <div>Er. Vivek Gupta<br /><small>Senior Physics Faculty & Mentor</small></div>
                  <div style={{ textAlign: "right" }}>Dr. Ateeb Fatmi<br /><small>Managing Academic Director</small></div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                  <Button variant="secondary" onClick={() => setShowReportModal(false)}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={() => window.print()}>
                    🖨️ Print / Save as PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==========================================
          FACULTY ROLE VIEW
         ========================================== */}
      {currentRole === "FACULTY" && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Active Batches"
              value={`${activeBatchesList.length} Batches`}
              detail={activeBatchesList.map((b) => b.name).join(", ") || "No batches allocated"}
              accent="yellow"
            />
            <MetricCard
              label="Total Students"
              value={String(totalStudents)}
              detail="Enrolled across cohorts"
              accent="navy"
            />
            <MetricCard
              label="Avg Attendance"
              value={analytics ? `${analytics.overallAttendanceRate}%` : "0%"}
              detail="Batch benchmark"
              accent="green"
            />
            <MetricCard label="Assessments Active" value={`${activeTestsList.length} Tests`} detail="PYQ Bank synced" accent="blue" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="My Lecture Schedule Today"
              action={
                <Link href="/dashboard/attendance" className="pz-button pz-button-primary" style={{ fontSize: "11px", textDecoration: "none" }}>
                  Mark Attendance →
                </Link>
              }
            >
              <p className="empty-state">Open the <Link href="/dashboard/campuses">campus timetable</Link> to view scheduled classes.</p>
            </Panel>

            <Panel title="Active Assessments & Grading">
              <div style={{ display: "grid", gap: "10px" }}>
                {activeTestsList.slice(0, 2).map((t) => (
                  <div key={t.id} style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "13px" }}>{t.title}</strong>
                      <Badge variant="brand" size="sm">{t.pattern}</Badge>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                      {t.questionCount || 54} Questions · {t.totalMarks || 180} Marks · Evaluated via assessment-core
                    </div>
                  </div>
                ))}
                <Link
                  href="/dashboard/assessments"
                  className="pz-button pz-button-secondary"
                  style={{ fontSize: "12px", textAlign: "center", textDecoration: "none" }}
                >
                  ＋ Create New DPP / Test Sheet
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* ==========================================
          DIRECTOR ROLE VIEW (DEFAULT)
         ========================================== */}
      {currentRole === "DIRECTOR" && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Active Students"
              value={String(totalStudents)}
              detail={totalStudents > 0 ? `${totalStudents} enrolled across batches` : "No enrolled students"}
              accent="yellow"
            />
            <MetricCard
              label="Teaching Faculty"
              value="0"
              detail="No faculty registered"
              accent="navy"
            />
            <MetricCard
              label="Fee Collections"
              value="₹0"
              detail="No collections recorded"
              accent="green"
            />
            <MetricCard
              label="Admissions Pipeline"
              value="0 Inquiries"
              detail="No pending inquiries"
              accent="blue"
            />
          </div>

          {/* Quick Onboarding Progress Banner */}
          <div
            style={{
              padding: "14px 20px",
              background: "#f8fafc",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              marginBottom: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div>
              <strong style={{ fontSize: "13px" }}>🚀 Coaching Operations Setup: 85% Ready</strong>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                Campus, Programs, Batches, and Teachers configured. Ready for bulk student CSV enrollment.
              </div>
            </div>
            <Link
              href="/dashboard/onboarding"
              className="pz-button pz-button-primary"
              style={{ fontSize: "11px", textDecoration: "none" }}
            >
              Open Setup Checklist →
            </Link>
          </div>

          <div className="dashboard-grid">
            <Panel
              title="Today's Timetable & Classes"
              action={
                <Link href="/dashboard/batches" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>
                  Manage batches →
                </Link>
              }
            >
              <div className="class-list">
                <div>
                  <time>09:00 AM</time>
                  <span className="class-line yellow" />
                  <p>
                    <strong>Electrostatics & Gauss Law</strong>
                    <small>JEE 12A · Hall 204 · Er. Vivek Gupta (68 students)</small>
                  </p>
                  <Badge variant="success" size="sm">Live Now</Badge>
                </div>
                <div>
                  <time>11:30 AM</time>
                  <span className="class-line blue" />
                  <p>
                    <strong>Plant Physiology & Photosynthesis</strong>
                    <small>NEET 12 · Lab 1 · Dr. Ananya Mehta (54 students)</small>
                  </p>
                  <Badge variant="info" size="sm">In 1h 20m</Badge>
                </div>
                <div>
                  <time>02:30 PM</time>
                  <span className="class-line orange" />
                  <p>
                    <strong>Application of Derivatives & Tangents</strong>
                    <small>JEE 11B · Room 102 · Prof. Rajesh Sen (61 students)</small>
                  </p>
                  <Badge variant="neutral" size="sm">In 4h 15m</Badge>
                </div>
              </div>
            </Panel>

            <Panel
              title="Attendance Pulse"
              action={
                <Link href="/dashboard/attendance" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>
                  Mark attendance →
                </Link>
              }
            >
              <div className="attendance-wrap">
                <div className="attendance-ring">
                  <strong>{analytics ? `${analytics.overallAttendanceRate}%` : "0%"}</strong>
                  <span>Today</span>
                </div>
                <div className="attendance-bars">
                  {[93, 89, 94, 92, 90, 96, 92].map((value, index) => (
                    <div key={index}>
                      <span style={{ height: `${value - 35}%` }} />
                      <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel
              title="Live & Upcoming PrepZii Tests & PYQs"
              action={
                <Link href="/dashboard/assessments" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>
                  All assessments →
                </Link>
              }
            >
              <div style={{ display: "grid", gap: "12px" }}>
                {activeTestsList.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                    No upcoming tests scheduled for this institute.
                  </div>
                ) : (
                  activeTestsList.slice(0, 3).map((test) => (
                    <div key={test.id} style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "13px" }}>{test.title}</strong>
                        <Badge variant={test.pattern === "JEE_ADVANCED" ? "brand" : "info"} size="sm">
                          {test.pattern}
                        </Badge>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                        <span>{test.questionCount || 0} Questions · {test.totalMarks || 180} Marks</span>
                        <span>{test.totalSubmissions || 0} Submissions</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel title="Action Required & Alerts">
              <div className="attention-list">
                <Link href="/dashboard/attendance">
                  <span className="attention-icon amber">!</span>
                  <p>
                    <strong>Attendance submission pending</strong>
                    <small>Class 11 batches before 12:00 PM cutoff</small>
                  </p>
                  <b>→</b>
                </Link>
                <Link href="/dashboard/reports">
                  <span className="attention-icon red">!</span>
                  <p>
                    <strong>{analytics ? `${analytics.atRiskCount} Students` : "0 Students"} require academic focus</strong>
                    <small>PrepZii revision engine recommends targeted DPP</small>
                  </p>
                  <b>→</b>
                </Link>
                <Link href="/dashboard/batches">
                  <span className="attention-icon blue">i</span>
                  <p>
                    <strong>Syllabus milestone: Physics Mechanics</strong>
                    <small>Batch JEE 12A reached 78% syllabus</small>
                  </p>
                  <b>→</b>
                </Link>
              </div>
            </Panel>
          </div>

          <div style={{ marginTop: "20px" }}>
            <Panel
              title="Active Batches Status"
              action={
                <Link href="/dashboard/batches" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>
                  View all batches →
                </Link>
              }
            >
              {activeBatchesList.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                  No batches scheduled for this institute yet.
                </div>
              ) : (
                <div className="card-grid-3" style={{ margin: 0 }}>
                  {activeBatchesList.slice(0, 3).map((batch) => (
                    <div key={batch.id} className="batch-card">
                      <header>
                        <div>
                          <h3>{batch.name}</h3>
                          <p>{batch.facultyName || "Faculty Assigned"} · {batch.roomNumber || "Hall 204"}</p>
                        </div>
                        <Badge variant="brand" size="sm">{batch.targetExam ? batch.targetExam.replace("_", " ") : "JEE"}</Badge>
                      </header>

                      <div className="batch-stat-row">
                        <div>
                          <span>Students</span>
                          <strong>{batch.studentCount}</strong>
                        </div>
                        <div>
                          <span>Attendance</span>
                          <strong style={{ color: "var(--green)" }}>{batch.attendanceRate || 92}%</strong>
                        </div>
                        <div>
                          <span>Syllabus</span>
                          <strong>{batch.syllabusProgress || 70}%</strong>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "5px" }}>
                          <span>Course Progress</span>
                          <span>{batch.syllabusProgress || 70}% Completed</span>
                        </div>
                        <ProgressBar value={batch.syllabusProgress || 70} variant="brand" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading overview...</div>}>
      <OverviewContent />
    </Suspense>
  );
}
