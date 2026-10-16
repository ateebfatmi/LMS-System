"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { assignmentSubmissionState } from "@prepzii/learning";
import { Badge, Button, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Assignment = { id: string; title: string; instructions: string; course_id: string | null; batch_id: string | null; student_user_id: string | null; available_from: string | null; due_at: string; max_marks: number; allow_late: boolean; max_attempts: number; status: "DRAFT" | "PUBLISHED" | "CLOSED" };
type Submission = { id: string; assignment_id: string; student_user_id: string; attempt_number: number; text_response: string | null; status: "SUBMITTED" | "LATE" | "GRADED" | "RETURNED"; submitted_at: string; grade: number | null; feedback: string | null };
type SubmissionFile = { id: string; submission_id: string; name: string; mime_type: string; byte_size: number };
type Option = { id: string; title?: string; name?: string };
type Student = { user_id: string; display_name: string };
type Data = { assignments: Assignment[]; submissions: Submission[]; files: SubmissionFile[]; courses: Option[]; batches: Option[]; students: Student[]; role: string };
const empty: Data = { assignments: [], submissions: [], files: [], courses: [], batches: [], students: [], role: "" };

export function AssignmentWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [targetType, setTargetType] = useState<"COURSE" | "BATCH" | "STUDENT">("BATCH");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/assignments`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) { setData(result); setCurrentTime(Date.now()); setError(""); } else setError(result.error ?? "Unable to load assignments.");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active); else setError("Select an institute before opening assignments.");
    }
    void initialize();
  }, [load]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/assignments`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save assignment.");
    else { await load(organization); setNotice("Assignment workflow updated."); }
    setBusy(false);
    return response.ok;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const targetId = value("targetId");
    const rubric = value("rubric").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [criterion, marks] = line.split("|").map((part) => part.trim());
      return { criterion, marks: Number(marks) };
    }).filter((item) => item.criterion && item.marks > 0);
    const payload: Record<string, unknown> = {
      targetType, title: value("title"), instructions: value("instructions"),
      availableFrom: value("availableFrom") ? new Date(value("availableFrom")).toISOString() : null,
      dueAt: new Date(value("dueAt")).toISOString(), maxMarks: Number(value("maxMarks")), rubric,
      allowLate: form.get("allowLate") === "true", maxAttempts: Number(value("maxAttempts")),
    };
    if (targetType === "COURSE") payload.courseId = targetId;
    if (targetType === "BATCH") payload.batchId = targetId;
    if (targetType === "STUDENT") payload.studentUserId = targetId;
    if (await mutate("CREATE_ASSIGNMENT", payload)) event.currentTarget.reset();
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>, assignmentId: string) {
    event.preventDefault();
    if (!organization) return;
    const form = new FormData(event.currentTarget);
    form.set("assignmentId", assignmentId);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/assignments/submissions`, { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to submit assignment.");
    else { event.currentTarget.reset(); await load(organization); setNotice("Assignment submitted."); }
    setBusy(false);
  }

  async function openSubmissionFile(fileId: string) {
    if (!organization) return;
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/assignments/files/${fileId}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.url) { setError(result.error ?? "Unable to open submission file."); return; }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const staff = data.role !== "STUDENT";
  const submissionsByAssignment = useMemo(() => Map.groupBy(data.submissions, (submission) => submission.assignment_id), [data.submissions]);
  const targetOptions: Option[] = targetType === "COURSE" ? data.courses : targetType === "BATCH" ? data.batches : data.students.map((student) => ({ id: student.user_id, name: student.display_name }));
  const graded = data.submissions.filter((submission) => submission.status === "GRADED").length;
  const targetLabel = (assignment: Assignment) => assignment.course_id ? data.courses.find((item) => item.id === assignment.course_id)?.title ?? "Course" : assignment.batch_id ? data.batches.find((item) => item.id === assignment.batch_id)?.name ?? "Batch" : data.students.find((item) => item.user_id === assignment.student_user_id)?.display_name ?? "Individual student";

  return (
    <DashboardLayout title={staff ? "Assignments & grading" : "My assignments"} subtitle={`${organization?.name ?? "Institute"} · Server-enforced deadlines and attempts`}>
      <div className="metrics-grid assignment-metrics">
        <MetricCard label="Assignments" value={String(data.assignments.length)} detail="Visible in this workspace" accent="yellow" />
        <MetricCard label="Due soon" value={String(data.assignments.filter((item) => new Date(item.due_at).getTime() > currentTime && new Date(item.due_at).getTime() < currentTime + 7 * 86400000).length)} detail="Within seven days" accent="orange" />
        <MetricCard label="Submissions" value={String(data.submissions.length)} detail="All attempts" accent="blue" />
        <MetricCard label="Graded" value={String(graded)} detail={`${Math.max(0, data.submissions.length - graded)} awaiting action`} accent="green" />
      </div>
      {error && <div className="form-error directory-error" role="alert">{error}</div>}
      {notice && <div className="form-success directory-error" role="status">{notice}</div>}

      <div className={`assignment-layout ${staff ? "" : "student"}`}>
        {staff && <aside className="panel assignment-create">
          <h2>Create assignment</h2>
          <form className="compact-form" onSubmit={(event) => void create(event)}>
            <label>Title<input name="title" required placeholder="Electrostatics problem set" /></label>
            <label>Instructions<textarea name="instructions" required placeholder="Show all steps and upload…" /></label>
            <label>Assign to<select value={targetType} onChange={(event) => setTargetType(event.target.value as typeof targetType)}><option>COURSE</option><option>BATCH</option><option>STUDENT</option></select></label>
            <label>Target<select name="targetId" required><option value="">Choose target</option>{targetOptions.map((item) => <option key={item.id} value={item.id}>{item.title ?? item.name}</option>)}</select></label>
            <div><label>Available from<input name="availableFrom" type="datetime-local" /></label><label>Due at<input name="dueAt" type="datetime-local" required /></label></div>
            <div><label>Maximum marks<input name="maxMarks" type="number" min="0.01" step="0.01" required /></label><label>Maximum attempts<input name="maxAttempts" type="number" min="1" max="10" defaultValue="1" required /></label></div>
            <label>Rubric <small>One per line: Criterion | marks</small><textarea name="rubric" placeholder={"Reasoning | 5\nFinal answer | 5"} /></label>
            <label className="check-row"><input name="allowLate" type="checkbox" value="true" /> Allow late submissions</label>
            <Button disabled={busy}>Save draft</Button>
          </form>
        </aside>}

        <section className="assignment-list">
          {data.assignments.map((assignment) => {
            const submissions = submissionsByAssignment.get(assignment.id) ?? [];
            const latest = submissions[0];
            const windowState = assignmentSubmissionState({ status: assignment.status, availableFrom: assignment.available_from, dueAt: assignment.due_at, allowLate: assignment.allow_late }, new Date(currentTime));
            return <article className="panel assignment-card" key={assignment.id}>
              <header><div><span className="assignment-target">{targetLabel(assignment)}</span><h2>{assignment.title}</h2><p>{assignment.instructions}</p></div><Badge variant={assignment.status === "PUBLISHED" ? "success" : "neutral"}>{assignment.status}</Badge></header>
              <div className="assignment-meta"><span>Due {new Date(assignment.due_at).toLocaleString()}</span><span>{assignment.max_marks} marks</span><span>{assignment.max_attempts} attempt{assignment.max_attempts === 1 ? "" : "s"}</span><span>{assignment.allow_late ? "Late accepted" : "Hard deadline"}</span></div>
              {staff ? <>
                <div className="assignment-actions"><Button variant="secondary" disabled={busy} onClick={() => void mutate("PUBLISH_ASSIGNMENT", { assignmentId: assignment.id, published: assignment.status !== "PUBLISHED" })}>{assignment.status === "PUBLISHED" ? "Return to draft" : "Publish"}</Button><span>{submissions.length} submission{submissions.length === 1 ? "" : "s"}</span></div>
                <div className="submission-review-list">{submissions.map((submission) => <div className="submission-review" key={submission.id}><div><strong>{submission.student_user_id}</strong><small>Attempt {submission.attempt_number} · {submission.status} · {new Date(submission.submitted_at).toLocaleString()}</small>{submission.text_response && <p>{submission.text_response}</p>}{data.files.filter((file) => file.submission_id === submission.id).map((file) => <Button key={file.id} variant="outline" onClick={() => void openSubmissionFile(file.id)}>Attachment: {file.name}</Button>)}{submission.feedback && <blockquote>{submission.feedback}</blockquote>}</div>{submission.status !== "GRADED" && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate("GRADE_SUBMISSION", { submissionId: submission.id, grade: Number(form.get("grade")), feedback: String(form.get("feedback") ?? "") || null }); }}><input name="grade" required min="0" max={assignment.max_marks} step="0.01" type="number" placeholder={`/${assignment.max_marks}`} /><input name="feedback" placeholder="Feedback"/><Button disabled={busy}>Grade</Button><Button type="button" variant="outline" disabled={busy} onClick={() => void mutate("RETURN_SUBMISSION", { submissionId: submission.id, feedback: "Please revise and resubmit." })}>Return</Button></form>}</div>)}</div>
              </> : <div className="student-submission">{latest && <div className="submission-status"><Badge variant={latest.status === "GRADED" ? "success" : latest.status === "RETURNED" ? "warning" : "info"}>{latest.status}</Badge><span>Attempt {latest.attempt_number}{latest.grade !== null ? ` · ${latest.grade}/${assignment.max_marks}` : ""}</span>{data.files.filter((file) => file.submission_id === latest.id).map((file) => <Button key={file.id} variant="outline" onClick={() => void openSubmissionFile(file.id)}>Open {file.name}</Button>)}{latest.feedback && <p>{latest.feedback}</p>}</div>}{(!latest || latest.status === "RETURNED") && ["OPEN", "LATE"].includes(windowState) && <form onSubmit={(event) => void submitAssignment(event, assignment.id)}><textarea name="textResponse" placeholder="Write your response, or attach a file…"/><input name="file" type="file" accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp"/><Button disabled={busy}>{windowState === "LATE" ? "Submit late" : latest ? "Resubmit" : "Submit assignment"}</Button></form>}{windowState === "CLOSED" && !latest && <p className="closed-note">The submission deadline has passed.</p>}</div>}
            </article>;
          })}
          {!data.assignments.length && <div className="panel empty-state">{staff ? "Create the first assignment for an assigned course, batch, or student." : "No assignments are available right now."}</div>}
        </section>
      </div>
    </DashboardLayout>
  );
}
