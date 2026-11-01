"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Atom, Check, Dna, FlaskConical, Plus, Search, Sigma } from "lucide-react";
import { Badge, Button, DateTimePicker, MetricCard, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MathText } from "@/components/math-text";

type Organization = { name: string; slug: string };
type Test = { id: string; title: string; exam: string; subject: string; chapters: string[]; difficulty: string; duration_minutes: number; total_questions: number; status: "DRAFT" | "PUBLISHED"; max_attempts: number; result_release_policy: string; solution_release_policy: string };
type Schedule = { id: string; test_id: string; batch_id: string; starts_at: string; ends_at: string };
type Attempt = { id: string; test_id: string; user_id: string; attempt_number: number; status: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; results_released: boolean; solutions_released: boolean };
type DescriptiveSubmission = { id: string; test_id: string; question_id: string; student_user_id: string; answer_text: string | null; file_url: string | null; max_marks: number; awarded_marks: number | null; feedback: string | null; status: string };
type Question = { id: string; exam: string; subject: string; chapter: string; topic: string; difficulty: string; question_type: string; question_text: string; marks: number };
type TestQuestion = Question & { link_id: string; test_id: string; question_order: number };
type Batch = { id: string; name: string };
type Data = { tests: Test[]; schedules: Schedule[]; attempts: Attempt[]; descriptiveSubmissions: DescriptiveSubmission[]; batches: Batch[]; bankQuestions: Question[]; testQuestions: TestQuestion[]; role: string };
const empty: Data = { tests: [], schedules: [], attempts: [], descriptiveSubmissions: [], batches: [], bankQuestions: [], testQuestions: [], role: "" };
const questionBankSubjects = [
  { name: "Physics", Icon: Atom, tone: "physics" },
  { name: "Chemistry", Icon: FlaskConical, tone: "chemistry" },
  { name: "Mathematics", Icon: Sigma, tone: "mathematics" },
  { name: "Biology", Icon: Dna, tone: "biology" },
] as const;

export function AssessmentWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedQuestionSubject, setSelectedQuestionSubject] = useState("Mathematics");
  const [questionSearch, setQuestionSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const loadRequestId = useRef(0);

  const load = useCallback(async (active: Organization, search = "", subject = "Mathematics") => {
    const requestId = ++loadRequestId.current;
    const params = new URLSearchParams({ q: search, subject });
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/assessments?${params}`, { cache: "no-store" });
    const result = await response.json();
    if (requestId !== loadRequestId.current) return;
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
    else { await load(organization, questionSearch, selectedQuestionSubject); setNotice(action === "ADD_QUESTION" ? "Question added to the selected test." : "Assessment updated."); }
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
  const selectedTestQuestions = data.testQuestions.filter((question) => question.test_id === selectedTestId).sort((left, right) => left.question_order - right.question_order);
  const selectedTestQuestionIds = new Set(selectedTestQuestions.map((question) => question.id));

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
          {staff && <form className="compact-form" onSubmit={(event) => void create(event)}><h3>Create draft test</h3><input name="title" required placeholder="JEE Main Full Test 01"/><div><input name="exam" required placeholder="JEE Main"/><input name="subject" required placeholder="Physics"/></div><input name="chapters" placeholder="Kinematics, NLM"/><Select name="difficulty" defaultValue="mixed"><option value="mixed">mixed</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></Select><div><input name="durationMinutes" type="number" min="1" max="360" defaultValue="180" required/><input name="maxAttempts" type="number" min="1" max="10" defaultValue="1" required/></div><label>Result release<Select name="resultReleasePolicy" defaultValue="IMMEDIATE"><option value="IMMEDIATE">IMMEDIATE</option><option value="AFTER_WINDOW">AFTER_WINDOW</option><option value="MANUAL">MANUAL</option></Select></label><label>Solution release<Select name="solutionReleasePolicy" defaultValue="AFTER_WINDOW"><option value="AFTER_WINDOW">AFTER_WINDOW</option><option value="IMMEDIATE">IMMEDIATE</option><option value="MANUAL">MANUAL</option></Select></label><Button disabled={busy}>Create test</Button></form>}
        </aside>

        <section className="panel assessment-detail">
          <header><div><h2>{selectedTest?.title ?? "Choose a test"}</h2><p>{selectedTest ? `${selectedTest.exam} · ${selectedTest.subject} · ${selectedTest.difficulty}` : "Assessment details will appear here."}</p></div>{staff && selectedTest && <Button variant="secondary" disabled={busy} onClick={() => void mutate("PUBLISH_TEST", { testId: selectedTest.id, published: selectedTest.status !== "PUBLISHED" })}>{selectedTest.status === "PUBLISHED" ? "Return to draft" : "Publish"}</Button>}</header>
          {selectedTest && <div className="assessment-policy"><span>{selectedTest.total_questions} questions</span><span>{selectedTest.duration_minutes} minutes</span><span>{selectedTest.max_attempts} attempt{selectedTest.max_attempts === 1 ? "" : "s"}</span><span>Results: {selectedTest.result_release_policy}</span><span>Solutions: {selectedTest.solution_release_policy}</span></div>}
          {staff && selectedTest && <section className="selected-test-questions" aria-labelledby="selected-test-questions-title">
            <header><div><span>Test builder</span><h3 id="selected-test-questions-title">Questions in this test</h3></div><strong>{selectedTestQuestions.length}</strong></header>
            {selectedTestQuestions.length ? <div className="selected-test-question-list">{selectedTestQuestions.map((question, index) => <article key={question.link_id}><span className="selected-test-question-number">{index + 1}</span><div><MathText className="selected-test-question-text">{question.question_text}</MathText><small>{question.subject} · {question.chapter} · {question.difficulty} · {question.marks} marks</small></div></article>)}</div> : <div className="selected-test-questions-empty"><Plus size={18} aria-hidden="true"/><div><strong>No questions added yet</strong><p>Choose a subject from the question bank and click Add.</p></div></div>}
          </section>}
          {!staff && selectedTest && <div className="student-test-action">{activeSchedule ? <Link className="pz-button pz-button-primary" href={`/dashboard/assessments/${selectedTest.id}`}>Start or resume test</Link> : <p>{schedules.length ? `Window: ${new Date(schedules[0].starts_at).toLocaleString()} – ${new Date(schedules[0].ends_at).toLocaleString()}` : "No schedule is available."}</p>}{attempts.map((attempt) => <div key={attempt.id}><Badge variant={attempt.status === "SUBMITTED" ? "success" : "info"}>{attempt.status}</Badge>{attempt.status === "SUBMITTED" && <Link href={`/dashboard/assessments/${selectedTest.id}?attemptId=${attempt.id}`}>View result</Link>}</div>)}</div>}
          {staff && selectedTest && <>
            <form className="compact-form assessment-schedule" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate("SCHEDULE_TEST", { testId: selectedTest.id, batchId: String(form.get("batchId")), startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString() }); }}><h3>Schedule for batch</h3><Select name="batchId" required placeholder="Choose batch"><option value="">Choose batch</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</Select><div><DateTimePicker name="startsAt" required placeholder="Starts at" /><DateTimePicker name="endsAt" required placeholder="Ends at" /></div><Button disabled={busy}>Add schedule</Button></form>
            <h3>Schedules</h3>{schedules.map((schedule) => <div className="assessment-row" key={schedule.id}><span>{data.batches.find((batch) => batch.id === schedule.batch_id)?.name ?? "Batch"}</span><small>{new Date(schedule.starts_at).toLocaleString()} – {new Date(schedule.ends_at).toLocaleString()}</small></div>)}
            <h3>Attempts</h3>{attempts.map((attempt) => <div className="assessment-row" key={attempt.id}><span>{attempt.user_id} · Attempt {attempt.attempt_number}</span><small>{attempt.status}{attempt.score !== null ? ` · ${attempt.score}/${attempt.max_score} (${attempt.percentage}%)` : ""}</small></div>)}
            <h3>Descriptive grading queue</h3>
            <div className="descriptive-grading-list">{descriptiveQueue.map((submission) => <article key={submission.id}><header><div><strong>{submission.student_user_id}</strong><small>Question {submission.question_id}</small></div><Badge variant={submission.status === "MODERATED" ? "success" : submission.status === "GRADED" ? "info" : "warning"}>{submission.status}</Badge></header>{submission.answer_text && <p>{submission.answer_text}</p>}{submission.file_url && <a href={submission.file_url} target="_blank" rel="noreferrer">Open submitted file</a>}{submission.feedback && <blockquote>{submission.feedback}</blockquote>}<form className="compact-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void mutate("GRADE_DESCRIPTIVE", { submissionId: submission.id, awardedMarks: Number(form.get("marks")), feedback: String(form.get("feedback")), isModeration: form.get("moderate") === "on" }); }}><div><input name="marks" type="number" min="0" max={submission.max_marks} step="0.01" defaultValue={submission.awarded_marks ?? ""} required/><span>/ {submission.max_marks}</span></div><textarea name="feedback" required defaultValue={submission.feedback ?? ""} placeholder="Specific feedback and next step"/><label className="check-row"><input name="moderate" type="checkbox" disabled={["TEACHER"].includes(data.role)}/> Record as moderated grade</label><Button disabled={busy}>{submission.awarded_marks === null ? "Save grade" : "Update grade"}</Button></form></article>)}{!descriptiveQueue.length && <p className="empty-state">No descriptive responses are waiting for this test.</p>}</div>
            <div className="assessment-release-actions"><Button variant="outline" disabled={busy} onClick={() => void mutate("RELEASE_RESULTS", { testId: selectedTest.id })}>Release results</Button><Button variant="outline" disabled={busy} onClick={() => void mutate("RELEASE_SOLUTIONS", { testId: selectedTest.id })}>Release solutions</Button></div>
          </>}
        </section>

        {staff && <aside className="panel question-picker">
          <div className="question-picker-heading"><span>Question bank</span><h2>Add questions</h2><p>Choose a subject, find the right questions, and add them to your draft.</p></div>
          <div className="question-subjects" role="group" aria-label="Question bank subjects">
            {questionBankSubjects.map(({ name, Icon, tone }) => <button key={name} type="button" className={name === selectedQuestionSubject ? "active" : ""} aria-pressed={name === selectedQuestionSubject} onClick={() => { setSelectedQuestionSubject(name); setQuestionSearch(""); setData((current) => ({ ...current, bankQuestions: [] })); if (organization) void load(organization, "", name); }}><span className={`question-subject-icon ${tone}`} aria-hidden="true"><Icon size={15} strokeWidth={2.25}/></span><strong>{name}</strong></button>)}
          </div>
          <div className="question-picker-current"><div><span>Browsing</span><strong>{selectedQuestionSubject}</strong></div><small>{data.bankQuestions.length} loaded</small></div>
          <form aria-label={`Search ${selectedQuestionSubject} questions`} onSubmit={(event) => { event.preventDefault(); if (organization) void load(organization, questionSearch, selectedQuestionSubject); }}><input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder={`Search in ${selectedQuestionSubject}`}/><Button variant="outline"><Search size={14} aria-hidden="true"/>Search</Button></form>
          <div className="question-picker-results">{data.bankQuestions.map((question) => { const added = selectedTestQuestionIds.has(question.id); return <article key={question.id}><div className="question-picker-copy"><Badge variant="neutral">{question.question_type}</Badge><MathText className="question-picker-text">{question.question_text}</MathText><small>{question.chapter} · {question.difficulty} · {question.marks} marks</small></div><Button className={`question-add-button ${added ? "added" : ""}`} variant={added ? "outline" : undefined} disabled={busy || added || !selectedTest || selectedTest.status !== "DRAFT"} onClick={() => void mutate("ADD_QUESTION", { testId: selectedTestId, questionId: question.id })}>{added ? <Check size={14} aria-hidden="true"/> : <Plus size={14} aria-hidden="true"/>}{added ? "Added" : "Add"}</Button></article>; })}</div>
          {!data.bankQuestions.length && <p className="question-picker-empty">No {selectedQuestionSubject.toLowerCase()} questions match this search.</p>}
        </aside>}
      </div>
    </DashboardLayout>
  );
}
