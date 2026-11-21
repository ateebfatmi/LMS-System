"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Badge, Button, DateTimePicker, MetricCard, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { resolveActiveOrganization } from "@/lib/client-org";
import { MathText } from "@/components/math-text";

type Organization = { name: string; slug: string };
type Test = { id: string; title: string; exam: string; subject: string; chapters: string[]; difficulty: string; duration_minutes: number; total_questions: number; status: "DRAFT" | "PUBLISHED"; max_attempts: number; result_release_policy: string; solution_release_policy: string };
type Schedule = { id: string; test_id: string; batch_id: string; starts_at: string; ends_at: string };
type Attempt = { id: string; test_id: string; user_id: string; attempt_number: number; status: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; results_released: boolean; solutions_released: boolean };
type DescriptiveSubmission = { id: string; test_id: string; question_id: string; student_user_id: string; answer_text: string | null; file_url: string | null; max_marks: number; awarded_marks: number | null; feedback: string | null; status: string };
type Question = { id: string; exam: string; subject: string; chapter: string; topic: string; difficulty: string; question_type: string; question_text: string; marks: number };
type TestQuestion = Question & { link_id: string; test_id: string; question_order: number };
type Batch = { id: string; name: string };
type Data = { tests: Test[]; schedules: Schedule[]; attempts: Attempt[]; descriptiveSubmissions: DescriptiveSubmission[]; batches: Batch[]; testQuestions: TestQuestion[]; role: string };
const empty: Data = { tests: [], schedules: [], attempts: [], descriptiveSubmissions: [], batches: [], testQuestions: [], role: "" };
type PickerQuestion = Pick<Question, "id" | "question_text" | "exam" | "chapter" | "difficulty" | "marks">;
const questionPageSize = 40;

export function AssessmentWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionFilters, setQuestionFilters] = useState({ subject: "", search: "", page: 1 });
  const [bank, setBank] = useState<{ questions: PickerQuestion[]; total: number } | null>(null);
  const [bankError, setBankError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const loadRequestId = useRef(0);

  const load = useCallback(async (active: Organization, signal?: AbortSignal) => {
    const requestId = ++loadRequestId.current;
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/assessments?includeBank=0`, {
        cache: "no-store", signal,
      });
      const result = await response.json();
      if (signal?.aborted || requestId !== loadRequestId.current) return false;
      if (!response.ok) throw new Error(result.error ?? "Unable to load assessments.");
      setData(result);
      setCurrentTime(Date.now());
      setSelectedTestId((current) => result.tests.some((test: Test) => test.id === current) ? current : result.tests[0]?.id ?? "");
      return true;
    } catch (error) {
      if (!signal?.aborted && requestId === loadRequestId.current) {
        setError(error instanceof Error ? error.message : "Unable to load assessments.");
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let pending: AbortController | undefined;
    async function initialize() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      loadRequestId.current++;
      setOrganization(null);
      setData(empty);
      setSelectedTestId("");
      setSubjects([]);
      setBank(null);
      setBankError("");
      setCatalogError("");
      setQuestionSearch("");
      setQuestionFilters({ subject: "", search: "", page: 1 });
      setError("");
      setNotice("");
      const selection = await resolveActiveOrganization();
      if (controller.signal.aborted) return;
      if (!selection) {
        setError("Select an institute before opening assessments.");
        return;
      }
      setOrganization(selection.organization);
      void load(selection.organization, controller.signal);
    }
    void initialize();
    window.addEventListener("prepzii:organization-changed", initialize);
    return () => {
      pending?.abort();
      window.removeEventListener("prepzii:organization-changed", initialize);
    };
  }, [load]);

  const staff = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"].includes(data.role);
  const bankUrl = organization && staff ? `/api/organizations/${encodeURIComponent(organization.slug)}/question-bank` : null;

  useEffect(() => {
    if (!bankUrl) return;
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const response = await fetch(`${bankUrl}?view=subjects`, { cache: "no-store", signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!signal.aborted) setSubjects(result.subjects);
      } catch {
        if (!signal.aborted) setCatalogError("Unable to load question bank subjects.");
      }
    })();
    return () => controller.abort();
  }, [bankUrl]);

  useEffect(() => {
    if (!bankUrl) return;
    const controller = new AbortController();
    const { signal } = controller;
    const { subject, search, page } = questionFilters;
    const params = new URLSearchParams({ view: "picker", subject, q: search, page: String(page), limit: String(questionPageSize) });
    void (async () => {
      try {
        const response = await fetch(`${bankUrl}?${params}`, { cache: "no-store", signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!signal.aborted) setBank(result);
      } catch {
        if (!signal.aborted) setBankError("Unable to load questions.");
      }
    })();
    return () => controller.abort();
  }, [bankUrl, questionFilters]);

  function browseQuestions(subject: string, search: string, page = 1) {
    setBank(null);
    setBankError("");
    setQuestionFilters({ subject, search, page });
  }

  useEffect(() => {
    if (data.role !== "STUDENT" || !data.schedules.length) return;
    const now = Date.now();
    const nextBoundary = data.schedules.filter((schedule) => schedule.test_id === selectedTestId)
      .flatMap((schedule) => [Date.parse(schedule.starts_at), Date.parse(schedule.ends_at) + 1])
      .filter((boundary) => boundary > now)
      .reduce((earliest, boundary) => Math.min(earliest, boundary), Infinity);
    if (!Number.isFinite(nextBoundary)) return;
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), Math.min(nextBoundary - now, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [currentTime, data.role, data.schedules, selectedTestId]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    const workspaceRequestId = loadRequestId.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/assessments`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
      });
      const result = await response.json();
      if (workspaceRequestId !== loadRequestId.current) return false;
      if (!response.ok) throw new Error(result.error ?? "Unable to save assessment.");
      if (await load(organization)) setNotice(action === "ADD_QUESTION" ? "Question added to the selected test." : "Assessment updated.");
      return true;
    } catch (error) {
      if (workspaceRequestId === loadRequestId.current) {
        setError(error instanceof Error ? error.message : "Unable to save assessment.");
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (await mutate("CREATE_TEST", {
      title: value("title"), exam: value("exam"), subject: value("subject"),
      chapters: value("chapters").split(",").map((item) => item.trim()).filter(Boolean), difficulty: value("difficulty"),
      durationMinutes: Number(value("durationMinutes")), maxAttempts: Number(value("maxAttempts")),
      resultReleasePolicy: value("resultReleasePolicy"), solutionReleasePolicy: value("solutionReleasePolicy"),
    })) formElement.reset();
  }

  const selectedTest = data.tests.find((test) => test.id === selectedTestId);
  const schedules = data.schedules.filter((schedule) => schedule.test_id === selectedTestId);
  const attempts = data.attempts.filter((attempt) => attempt.test_id === selectedTestId);
  const activeSchedule = schedules.find((schedule) => new Date(schedule.starts_at).getTime() <= currentTime && new Date(schedule.ends_at).getTime() >= currentTime);
  const descriptiveQueue = data.descriptiveSubmissions.filter((submission) => submission.test_id === selectedTestId);
  const selectedTestQuestions = data.testQuestions.filter((question) => question.test_id === selectedTestId).sort((left, right) => left.question_order - right.question_order);
  const selectedTestQuestionIds = new Set(selectedTestQuestions.map((question) => question.id));

  return (
    <DashboardLayout title={data.role === "STUDENT" ? "My assessments" : "Assessments"} subtitle={`${organization?.name ?? "Institute"} · PrepZii question bank with server-authoritative attempts`}>
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
          {data.tests.map((test) => <button key={test.id} className={test.id === selectedTestId ? "active" : ""} onClick={() => { setSelectedTestId(test.id); setCurrentTime(Date.now()); }}><span><strong>{test.title}</strong><small>{test.subject} · {test.duration_minutes} min · {test.total_questions} questions</small></span><Badge variant={test.status === "PUBLISHED" ? "success" : "neutral"}>{test.status}</Badge></button>)}
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
          <Select aria-label="Question bank subject" value={questionFilters.subject} onChange={(subject) => {
            setQuestionSearch("");
            browseQuestions(subject, "");
          }}>
            <option value="">All subjects</option>
            {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </Select>
          {catalogError && <p role="status">{catalogError}</p>}
          <form aria-label="Search question bank" onSubmit={(event) => {
            event.preventDefault();
            browseQuestions(questionFilters.subject, questionSearch.trim());
          }}>
            <input aria-label="Search questions" maxLength={100} value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search questions"/>
            <Button variant="outline"><Search size={14} aria-hidden="true"/>Search</Button>
          </form>
          <div className="question-picker-results">{bank?.questions.map((question) => { const added = selectedTestQuestionIds.has(question.id); return <article key={question.id}><div className="question-picker-copy"><Badge variant="neutral">{question.exam}</Badge><MathText className="question-picker-text">{question.question_text}</MathText><small>{question.chapter} · {question.difficulty} · {question.marks} marks</small></div><Button className={`question-add-button ${added ? "added" : ""}`} variant={added ? "outline" : undefined} disabled={busy || added || !selectedTest || selectedTest.status !== "DRAFT"} onClick={() => void mutate("ADD_QUESTION", { testId: selectedTestId, questionId: question.id })}>{added ? <Check size={14} aria-hidden="true"/> : <Plus size={14} aria-hidden="true"/>}{added ? "Added" : "Add"}</Button></article>; })}</div>
          {bankError && <p role="alert">{bankError}</p>}
          {!bank && !bankError && <p role="status">Loading questions…</p>}
          {bank && !bank.questions.length && <p className="question-picker-empty">No questions match this search.</p>}
          {bank && (questionFilters.page > 1 || bank.total > questionPageSize) && <div className="assessment-release-actions">
            <Button variant="outline" disabled={questionFilters.page === 1} onClick={() => browseQuestions(questionFilters.subject, questionFilters.search, questionFilters.page - 1)}>Previous</Button>
            <span>Page {questionFilters.page} of {Math.max(1, Math.ceil(bank.total / questionPageSize))}</span>
            <Button variant="outline" disabled={questionFilters.page * questionPageSize >= bank.total || questionFilters.page >= 10000} onClick={() => browseQuestions(questionFilters.subject, questionFilters.search, questionFilters.page + 1)}>Next</Button>
          </div>}
        </aside>}
      </div>
    </DashboardLayout>
  );
}
