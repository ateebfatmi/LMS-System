"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Test = { id: string; title: string; exam: string; subject: string; chapters: string[]; difficulty: string; duration_minutes: number; total_questions: number; status: "DRAFT" | "PUBLISHED"; max_attempts: number; result_release_policy: string; solution_release_policy: string };
type Schedule = { id: string; test_id: string; batch_id: string; starts_at: string; ends_at: string };
type Attempt = { id: string; test_id: string; user_id: string; attempt_number: number; status: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; results_released: boolean; solutions_released: boolean };
type DescriptiveSubmission = { id: string; test_id: string; question_id: string; student_user_id: string; answer_text: string | null; file_url: string | null; max_marks: number; awarded_marks: number | null; feedback: string | null; status: string };
type Question = { id: string; exam: string; subject: string; chapter: string; topic: string; difficulty: string; question_type: string; question_text: string; marks: number };
type Batch = { id: string; name: string };
type Data = { tests: Test[]; schedules: Schedule[]; attempts: Attempt[]; descriptiveSubmissions: DescriptiveSubmission[]; batches: Batch[]; bankQuestions: Question[]; role: string };
const empty: Data = { tests: [], schedules: [], attempts: [], descriptiveSubmissions: [], batches: [], bankQuestions: [], role: "" };

export function AssessmentWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const load = useCallback(async (active: Organization, search = "") => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/assessments?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to load assessments."); return; }
    setData(result); setCurrentTime(Date.now()); setError("");
    setSelectedTestId((current) => current && result.tests.some((test: Test) => test.id === current) ? current : result.tests[0]?.id ?? "");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active); else setError("Select an institute before opening assessments.");
    }
    void initialize();
  }, [load]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/assessments`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save assessment.");
    else { await load(organization, questionSearch); setNotice("Assessment updated."); }
    setBusy(false);
    return response.ok;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (await mutate("CREATE_TEST", {
      title: value("title"), exam: value("exam"), subject: value("subject"),
      chapters: value("chapters").split(",").map((item) => item.trim()).filter(Boolean), difficulty: value("difficulty"),
      durationMinutes: Number(value("durationMinutes")), maxAttempts: Number(value("maxAttempts")),
      resultReleasePolicy: value("resultReleasePolicy"), solutionReleasePolicy: value("solutionReleasePolicy"),
    })) event.currentTarget.reset();
  }

  const staff = data.role !== "STUDENT";
  const selectedTest = data.tests.find((test) => test.id === selectedTestId);
  const schedules = data.schedules.filter((schedule) => schedule.test_id === selectedTestId);
  const attempts = data.attempts.filter((attempt) => attempt.test_id === selectedTestId);
  const activeSchedule = schedules.find((schedule) => new Date(schedule.starts_at).getTime() <= currentTime && new Date(schedule.ends_at).getTime() >= currentTime);
  const descriptiveQueue = data.descriptiveSubmissions.filter((submission) => submission.test_id === selectedTestId);

  return (
    <DashboardLayout title={staff ? "Assessments" : "My assessments"} subtitle={`${organization?.name ?? "Institute"} · PrepZii question bank with server-authoritative attempts`}>
      <div className="metrics-grid assessment-metrics">
        <MetricCard label="Tests" value={String(data.tests.length)} detail={staff ? "Authored assessments" : "Assigned assessments"} accent="yellow" />
        <MetricCard label="Published" value={String(data.tests.filter((test) => test.status === "PUBLISHED").length)} detail="Available by schedule" accent="green" />
        <MetricCard label="Attempts" value={String(data.attempts.length)} detail="Authorized attempts" accent="blue" />
        <MetricCard label="Manual grading" value={String(data.descriptiveSubmissions.filter((item) => item.status === "PENDING_EVALUATION" || item.status === "MODERATION_REQUESTED").length)} detail="Descriptive responses awaiting review" accent="navy" />
      </div>
      {error && <div className="form-error directory-error" role="alert">{error}</div>}
      {notice && <div className="form-success directory-error" role="status">{notice}</div>}

      <div className={`assessment-layout ${staff ? "" : "student"}`}>
        <aside className="panel assessment-catalogue">
          <h2>{staff ? "Institute tests" : "Assigned tests"}</h2>
          {data.tests.map((test) => <button key={test.id} className={test.id === selectedTestId ? "active" : ""} onClick={() => setSelectedTestId(test.id)}><span><strong>{test.title}</strong><small>{test.subject} · {test.duration_minutes} min · {test.total_questions} questions</small></span><Badge variant={test.status === "PUBLISHED" ? "success" : "neutral"}>{test.status}</Badge></button>)}
          {!data.tests.length && <p className="empty-state">{staff ? "Create the first institute assessment." : "No tests are assigned to your batches."}</p>}
          {staff && <form className="compact-form" onSubmit={(event) => void create(event)}><h3>Create draft test</h3><input name="title" required placeholder="JEE Main Full Test 01"/><div><input name="exam" required placeholder="JEE Main"/><input name="subject" required placeholder="Physics"/></div><input name="chapters" placeholder="Kinematics, NLM"/><select name="difficulty"><option>mixed</option><option>easy</option><option>medium</option><option>hard</option></select><div><input name="durationMinutes" type="number" min="1" max="360" defaultValue="180" required/><input name="maxAttempts" type="number" min="1" max="10" defaultValue="1" required/></div><label>Result release<select name="resultReleasePolicy"><option>IMMEDIATE</option><option>AFTER_WINDOW</option><option>MANUAL</option></select></label><label>Solution release<select name="solutionReleasePolicy"><option>AFTER_WINDOW</option><option>IMMEDIATE</option><option>MANUAL</option></select></label><Button disabled={busy}>Create test</Button></form>}
        </aside>

        <section className="panel assessment-detail">
          <header><div><h2>{selectedTest?.title ?? "Choose a test"}</h2><p>{selectedTest ? `${selectedTest.exam} · ${selectedTest.subject} · ${selectedTest.difficulty}` : "Assessment details will appear here."}</p></div>{staff && selectedTest && <Button variant="secondary" disabled={busy} onClick={() => void mutate("PUBLISH_TEST", { testId: selectedTest.id, published: selectedTest.status !== "PUBLISHED" })}>{selectedTest.status === "PUBLISHED" ? "Return to draft" : "Publish"}</Button>}</header>
          {selectedTest && <div className="assessment-policy"><span>{selectedTest.total_questions} questions</span><span>{selectedTest.duration_minutes} minutes</span><span>{selectedTest.max_attempts} attempt{selectedTest.max_attempts === 1 ? "" : "s"}</span><span>Results: {selectedTest.result_release_policy}</span><span>Solutions: {selectedTest.solution_release_policy}</span></div>}
          {!staff && selectedTest && <div className="student-test-action">{activeSchedule ? <Link className="pz-button pz-button-primary" href={`/dashboard/assessments/${selectedTest.id}`}>Start or resume test</Link> : <p>{schedules.length ? `Window: ${new Date(schedules[0].starts_at).toLocaleString()} – ${new Date(schedules[0].ends_at).toLocaleString()}` : "No schedule is available."}</p>}{attempts.map((attempt) => <div key={attempt.id}><Badge variant={attempt.status === "SUBMITTED" ? "success" : "info"}>{attempt.status}</Badge>{attempt.status === "SUBMITTED" && <Link href={`/dashboard/assessments/${selectedTest.id}?attemptId=${attempt.id}`}>View result</Link>}</div>)}</div>}
          {staff && selectedTest && <>
            <form className="compact-form assessment-schedule" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate("SCHEDULE_TEST", { testId: selectedTest.id, batchId: String(form.get("batchId")), startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString() }); }}><h3>Schedule for batch</h3><select name="batchId" required><option value="">Choose batch</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select><div><input name="startsAt" type="datetime-local" required/><input name="endsAt" type="datetime-local" required/></div><Button disabled={busy}>Add schedule</Button></form>
            <h3>Schedules</h3>{schedules.map((schedule) => <div className="assessment-row" key={schedule.id}><span>{data.batches.find((batch) => batch.id === schedule.batch_id)?.name ?? "Batch"}</span><small>{new Date(schedule.starts_at).toLocaleString()} – {new Date(schedule.ends_at).toLocaleString()}</small></div>)}
            <h3>Attempts</h3>{attempts.map((attempt) => <div className="assessment-row" key={attempt.id}><span>{attempt.user_id} · Attempt {attempt.attempt_number}</span><small>{attempt.status}{attempt.score !== null ? ` · ${attempt.score}/${attempt.max_score} (${attempt.percentage}%)` : ""}</small></div>)}
            <h3>Descriptive grading queue</h3>
            <div className="descriptive-grading-list">{descriptiveQueue.map((submission) => <article key={submission.id}><header><div><strong>{submission.student_user_id}</strong><small>Question {submission.question_id}</small></div><Badge variant={submission.status === "MODERATED" ? "success" : submission.status === "GRADED" ? "info" : "warning"}>{submission.status}</Badge></header>{submission.answer_text && <p>{submission.answer_text}</p>}{submission.file_url && <a href={submission.file_url} target="_blank" rel="noreferrer">Open submitted file</a>}{submission.feedback && <blockquote>{submission.feedback}</blockquote>}<form className="compact-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate("GRADE_DESCRIPTIVE", { submissionId: submission.id, awardedMarks: Number(form.get("marks")), feedback: String(form.get("feedback")), isModeration: form.get("moderate") === "on" }); }}><div><input name="marks" type="number" min="0" max={submission.max_marks} step="0.01" defaultValue={submission.awarded_marks ?? ""} required/><span>/ {submission.max_marks}</span></div><textarea name="feedback" required defaultValue={submission.feedback ?? ""} placeholder="Specific feedback and next step"/><label className="check-row"><input name="moderate" type="checkbox" disabled={["TEACHER"].includes(data.role)}/> Record as moderated grade</label><Button disabled={busy}>{submission.awarded_marks === null ? "Save grade" : "Update grade"}</Button></form></article>)}{!descriptiveQueue.length && <p className="empty-state">No descriptive responses are waiting for this test.</p>}</div>
            <div className="assessment-release-actions"><Button variant="outline" disabled={busy} onClick={() => void mutate("RELEASE_RESULTS", { testId: selectedTest.id })}>Release results</Button><Button variant="outline" disabled={busy} onClick={() => void mutate("RELEASE_SOLUTIONS", { testId: selectedTest.id })}>Release solutions</Button></div>
          </>}
        </section>

        {staff && <aside className="panel question-picker"><h2>PrepZii question bank</h2><form onSubmit={(event) => { event.preventDefault(); if (organization) void load(organization, questionSearch); }}><input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search question text"/><Button variant="outline">Search</Button></form>{data.bankQuestions.map((question) => <article key={question.id}><div><Badge variant="neutral">{question.question_type}</Badge><strong>{question.question_text}</strong><small>{question.subject} · {question.chapter} · {question.difficulty} · {question.marks} marks</small></div><Button disabled={busy || !selectedTest || selectedTest.status !== "DRAFT"} onClick={() => void mutate("ADD_QUESTION", { testId: selectedTestId, questionId: question.id })}>Add</Button></article>)}</aside>}
      </div>
    </DashboardLayout>
  );
}
