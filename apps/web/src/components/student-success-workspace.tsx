"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { resolveActiveOrganization } from "@/lib/client-org";

type RiskReason = { code: string; label: string; contribution: number };
type Intervention = {
  id: string;
  student_user_id: string;
  risk_level: string;
  risk_score: number;
  action_plan: string;
  status: string;
  next_review_on: string | null;
};
type Student = {
  userId: string;
  displayName: string;
  email: string;
  rollNumber: string | null;
  batchIds: string[];
  signals: {
    attendancePercentage: number | null;
    assessmentAverage: number | null;
    assignmentCompletion: number | null;
    daysSinceLastActivity: number | null;
  };
  risk: {
    score: number;
    level: "LOW" | "WATCH" | "HIGH" | "CRITICAL";
    reasons: RiskReason[];
    recommendedActions: string[];
  };
  activeIntervention: Intervention | null;
};
type RevisionPlan = { id: string; student_user_id: string; title: string; goal: string; target_date: string; status: string; items: { title: string; kind: string; dueOn: string }[] };
type WorkspaceData = { role: string; students: Student[]; interventions: Intervention[]; revisionPlans: RevisionPlan[] };

const EMPTY: WorkspaceData = { role: "STUDENT", students: [], interventions: [], revisionPlans: [] };
const riskVariant = { LOW: "success", WATCH: "warning", HIGH: "warning", CRITICAL: "danger" } as const;

function percentage(value: number | null): string {
  return value === null ? "No data" : `${value}%`;
}

export function StudentSuccessWorkspace() {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<WorkspaceData>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (organizationSlug: string) => {
    const response = await fetch(`/api/organizations/${organizationSlug}/student-success`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load student success.");
    setData(result);
    setSelectedId((current) => current && result.students.some((student: Student) => student.userId === current) ? current : result.students[0]?.userId ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void resolveActiveOrganization().then(async (selection) => {
      if (!selection || cancelled) return;
      setSlug(selection.organization.slug);
      try { await load(selection.organization.slug); } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load student success."); }
    });
    return () => { cancelled = true; };
  }, [load]);

  const selected = data.students.find((student) => student.userId === selectedId) ?? null;
  const staff = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"].includes(data.role);
  const openCount = data.interventions.filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.status)).length;
  const urgentCount = data.students.filter((student) => ["HIGH", "CRITICAL"].includes(student.risk.level)).length;
  const averageAttendance = useMemo(() => {
    const values = data.students.map((student) => student.signals.attendancePercentage).filter((value): value is number => value !== null);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }, [data.students]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!slug) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/organizations/${slug}/student-success`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save changes.");
      setMessage(action === "CREATE_REVISION_PLAN" ? "Revision plan published." : action === "CREATE_INTERVENTION" ? "Intervention opened." : "Intervention updated.");
      await load(slug);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save changes.");
    } finally { setBusy(false); }
  }

  function createIntervention(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    void mutate("CREATE_INTERVENTION", {
      studentUserId: selected.userId,
      batchId: selected.batchIds[0] ?? null,
      riskScore: selected.risk.score,
      riskLevel: selected.risk.level,
      reasons: selected.risk.reasons,
      recommendedActions: selected.risk.recommendedActions,
      actionPlan: String(form.get("actionPlan") ?? ""),
      ownerUserId: null,
      nextReviewOn: String(form.get("nextReviewOn") ?? "") || null,
    });
  }

  function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.activeIntervention) return;
    const form = new FormData(event.currentTarget);
    const targetDate = String(form.get("targetDate") ?? "");
    const items = String(form.get("items") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((title) => ({ title, kind: "PRACTICE", dueOn: targetDate }));
    void mutate("CREATE_REVISION_PLAN", {
      interventionId: selected.activeIntervention.id,
      title: String(form.get("title") ?? ""),
      goal: String(form.get("goal") ?? ""),
      startsOn: new Date().toISOString().slice(0, 10), targetDate, items,
    });
  }

  return (
    <DashboardLayout title="Student Success" subtitle="Reviewed early-warning signals and accountable interventions">
      <div className="metrics-grid">
        <MetricCard label="Students monitored" value={String(data.students.length)} detail="Only students visible to your role" accent="blue" />
        <MetricCard label="Needs review" value={String(urgentCount)} detail="High or critical signal score" accent="orange" />
        <MetricCard label="Open interventions" value={String(openCount)} detail="Human-owned action plans" accent="navy" />
        <MetricCard label="Average attendance" value={percentage(averageAttendance)} detail="From recorded sessions" accent="green" />
      </div>
      <p className="student-success-disclaimer">Signals prioritise review; they do not diagnose students or make automatic academic, disciplinary, or admission decisions.</p>
      {error && <div className="form-error directory-error" role="alert">{error}</div>}
      {message && <div className="success-banner" role="status">{message}</div>}

      <div className="student-success-layout">
        <Panel title={staff ? "Review queue" : "My success plan"} subtitle="Highest signal score first">
          <div className="student-risk-list">
            {data.students.map((student) => (
              <button type="button" key={student.userId} className={selectedId === student.userId ? "selected" : ""} onClick={() => setSelectedId(student.userId)}>
                <span><strong>{student.displayName}</strong><small>{student.rollNumber || student.email}</small></span>
                <span><Badge variant={riskVariant[student.risk.level]}>{student.risk.level}</Badge><strong>{student.risk.score}</strong></span>
              </button>
            ))}
            {!data.students.length && <p className="empty-state">No students are visible for this role.</p>}
          </div>
        </Panel>

        <div className="student-success-detail">
          {selected ? <>
            <Panel title={selected.displayName} subtitle={selected.rollNumber || selected.email} action={<Badge variant={riskVariant[selected.risk.level]}>{selected.risk.level} · {selected.risk.score}</Badge>}>
              <div className="signal-grid">
                <div><span>Attendance</span><strong>{percentage(selected.signals.attendancePercentage)}</strong><ProgressBar value={selected.signals.attendancePercentage ?? 0} variant="success" /></div>
                <div><span>Assessment average</span><strong>{percentage(selected.signals.assessmentAverage)}</strong><ProgressBar value={selected.signals.assessmentAverage ?? 0} variant="brand" /></div>
                <div><span>Assignment completion</span><strong>{percentage(selected.signals.assignmentCompletion)}</strong><ProgressBar value={selected.signals.assignmentCompletion ?? 0} variant="warning" /></div>
              </div>
              <div className="risk-reasons">
                <h3>Evidence</h3>
                {selected.risk.reasons.map((reason) => <div key={reason.code}><span>{reason.label}</span><Badge variant="neutral">+{reason.contribution}</Badge></div>)}
                {!selected.risk.reasons.length && <p>No material risk signals in the available evidence.</p>}
              </div>
            </Panel>

            {selected.activeIntervention ? <Panel title="Active intervention" subtitle={`Status: ${selected.activeIntervention.status}`}>
              <p>{selected.activeIntervention.action_plan}</p>
              {selected.activeIntervention.next_review_on && <p><strong>Next review:</strong> {new Date(selected.activeIntervention.next_review_on).toLocaleDateString("en-IN")}</p>}
              {staff && <div className="intervention-actions">
                <Button disabled={busy} variant="secondary" onClick={() => void mutate("UPDATE_INTERVENTION", { interventionId: selected.activeIntervention?.id, status: "IN_PROGRESS", actionPlan: selected.activeIntervention?.action_plan, resolutionNotes: null })}>Mark in progress</Button>
                <Button disabled={busy} onClick={() => void mutate("UPDATE_INTERVENTION", { interventionId: selected.activeIntervention?.id, status: "RESOLVED", actionPlan: selected.activeIntervention?.action_plan, resolutionNotes: "Reviewed and resolved by staff." })}>Resolve</Button>
              </div>}
            </Panel> : staff && <Panel title="Open an intervention" subtitle="A staff member must review the evidence before saving">
              <form className="compact-form" onSubmit={createIntervention}>
                <textarea name="actionPlan" required minLength={3} placeholder="Agreed action plan, responsibilities, and check-in details" defaultValue={selected.risk.recommendedActions.join("\n")} />
                <label>Next review<input name="nextReviewOn" type="date" /></label>
                <Button disabled={busy}>Open intervention</Button>
              </form>
            </Panel>}

            {staff && selected.activeIntervention && <Panel title="Publish revision plan" subtitle="Reviewed tasks visible to the student and approved guardian">
              <form className="compact-form" onSubmit={createPlan}>
                <input name="title" required placeholder="Two-week mechanics recovery plan" />
                <textarea name="goal" required placeholder="A clear outcome for the review date" />
                <textarea name="items" required placeholder={"Revise Newton's laws\nComplete 30 mixed questions\nTake a timed topic test"} />
                <label>Target date<input name="targetDate" type="date" required /></label>
                <Button disabled={busy}>Publish plan</Button>
              </form>
            </Panel>}

            <Panel title="Revision plans">
              <div className="revision-plan-list">
                {data.revisionPlans.filter((plan) => plan.student_user_id === selected.userId).map((plan) => <article key={plan.id}><header><strong>{plan.title}</strong><Badge variant={plan.status === "ACTIVE" ? "info" : "neutral"}>{plan.status}</Badge></header><p>{plan.goal}</p><small>Target {new Date(plan.target_date).toLocaleDateString("en-IN")}</small><ul>{(plan.items ?? []).map((item, index) => <li key={`${plan.id}-${index}`}>{item.title}</li>)}</ul></article>)}
                {!data.revisionPlans.some((plan) => plan.student_user_id === selected.userId) && <p className="empty-state">No revision plan has been published.</p>}
              </div>
            </Panel>
          </> : <p className="empty-state">Select a student to review the evidence.</p>}
        </div>
      </div>
    </DashboardLayout>
  );
}
