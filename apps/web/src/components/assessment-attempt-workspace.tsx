"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Question = { id: string; kind: "single_choice" | "multiple_choice" | "numerical"; subject?: string; topic?: string; text?: string; options?: { id: string; text: string }[]; marks: number; negativeMarks?: number };
type Answer = { selectedOptionIds?: string[]; number?: number; timeSpentSeconds?: number };
type Session = { attemptId: string; answerVersion: number; answers: Record<string, Answer>; expiresAt: string; resumed: boolean; title: string; durationMinutes: number; questions: Question[] };
type Review = { status: string; resultsReleased: boolean; solutionsReleased: boolean; result?: { score: number; maxScore: number; percentage: number; correctCount: number; incorrectCount: number; unansweredCount: number; questionResults: { questionId: string; status: string; score: number }[] }; solutions?: Question[] };

export function AssessmentAttemptWorkspace({ testId }: { testId: string }) {
  const searchParams = useSearchParams();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [saveState, setSaveState] = useState("Not saved yet");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const endpoint = useCallback((active: Organization) => `/api/organizations/${encodeURIComponent(active.slug)}/assessments/${encodeURIComponent(testId)}/attempt`, [testId]);
  const loadReview = useCallback(async (active: Organization, attemptId: string) => {
    const response = await fetch(`${endpoint(active)}?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setReview(result); else setError(result.error ?? "Unable to load result.");
  }, [endpoint]);

  useEffect(() => {
    async function initialize() {
      const activeResponse = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = activeResponse.ok ? (await activeResponse.json()).organization as Organization | null : null;
      setOrganization(active);
      setCurrentTime(Date.now());
      if (!active) { setError("Select an institute before opening this assessment."); return; }
      const existingAttempt = searchParams.get("attemptId");
      if (existingAttempt) { await loadReview(active, existingAttempt); return; }
      const response = await fetch(endpoint(active), { method: "POST" });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Unable to start assessment."); return; }
      setSession(result); setAnswers(result.answers ?? {}); setVersion(result.answerVersion ?? 0);
      setSaveState(result.resumed ? "Resumed from server" : "New attempt started");
    }
    void initialize();
  }, [endpoint, loadReview, searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dirty || !session || !organization || busy) return;
    const timer = window.setTimeout(async () => {
      setSaveState("Saving…");
      const response = await fetch(endpoint(organization), {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: session.attemptId, expectedVersion: version, answers }),
      });
      const result = await response.json();
      if (response.ok) { setVersion(result.answerVersion); setDirty(false); setSaveState("Saved to server"); }
      else { setSaveState("Save failed"); setError(result.error ?? "Unable to autosave answers."); }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [answers, busy, dirty, endpoint, organization, session, version]);

  function setAnswer(questionId: string, value: Answer) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setDirty(true); setError("");
  }

  async function submit() {
    if (!session || !organization) return;
    setBusy(true); setError("");
    const response = await fetch(endpoint(organization), {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: session.attemptId, expectedVersion: version, answers }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to submit assessment.");
    else await loadReview(organization, session.attemptId);
    setBusy(false);
  }

  const secondsRemaining = session ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - currentTime) / 1000)) : 0;
  const answeredCount = Object.values(answers).filter((value) => value.number !== undefined || (value.selectedOptionIds?.length ?? 0) > 0).length;
  if (review) return <DashboardLayout title="Assessment result" subtitle={`${organization?.name ?? "Institute"} · Release-controlled result`}><div className="metrics-grid"><MetricCard label="Status" value={review.status} detail="Finalized on the server" accent="green"/><MetricCard label="Score" value={review.resultsReleased ? `${review.result?.score ?? 0}/${review.result?.maxScore ?? 0}` : "Pending"} detail={review.resultsReleased ? `${review.result?.percentage ?? 0}%` : "Awaiting release"} accent="yellow"/><MetricCard label="Correct" value={review.resultsReleased ? String(review.result?.correctCount ?? 0) : "—"} detail="Objective evaluation" accent="blue"/><MetricCard label="Solutions" value={review.solutionsReleased ? "Available" : "Locked"} detail="Controlled by institute policy" accent="navy"/></div>{review.resultsReleased && <section className="panel result-breakdown"><h2>Question breakdown</h2>{review.result?.questionResults.map((item, index) => <div key={item.questionId}><span>Question {index + 1}</span><Badge variant={item.status === "correct" ? "success" : item.status === "unanswered" ? "neutral" : "warning"}>{item.status}</Badge><strong>{item.score} marks</strong></div>)}</section>}{review.solutionsReleased && <section className="panel solution-list"><h2>Released solutions</h2>{review.solutions?.map((question, index) => <article key={question.id}><strong>Question {index + 1}</strong><p>{question.text}</p><small>Correct: {question.kind === "numerical" ? String((question as Question & { correctNumber?: number }).correctNumber) : (question as Question & { correctOptionIds?: string[] }).correctOptionIds?.join(", ")}</small></article>)}</section>}</DashboardLayout>;

  return <DashboardLayout title={session?.title ?? "Assessment"} subtitle={`${organization?.name ?? "Institute"} · Answers autosave with optimistic versioning`}>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}
    {session ? <>
      <div className="test-status-bar"><div><strong>{Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, "0")}</strong><small>Server deadline</small></div><div><strong>{answeredCount}/{session.questions.length}</strong><small>Answered</small></div><span>{saveState}</span><Button disabled={busy} onClick={() => void submit()}>{secondsRemaining ? "Submit test" : "Finalize saved answers"}</Button></div>
      <div className="attempt-layout"><nav className="panel question-navigation">{session.questions.map((question, index) => <a key={question.id} href={`#question-${question.id}`} className={answers[question.id] ? "answered" : ""}>{index + 1}</a>)}</nav><section className="attempt-questions">{session.questions.map((question, index) => <article className="panel attempt-question" id={`question-${question.id}`} key={question.id}><header><span>Question {index + 1}</span><div><Badge variant="neutral">{question.subject ?? "General"}</Badge><strong>+{question.marks} / −{question.negativeMarks ?? 0}</strong></div></header><p>{question.text}</p>{question.kind === "numerical" ? <input className="numerical-answer" type="number" step="any" value={answers[question.id]?.number ?? ""} onChange={(event) => setAnswer(question.id, { number: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Enter numerical answer"/> : <div className="answer-options">{question.options?.map((option) => { const selected = answers[question.id]?.selectedOptionIds ?? []; const multiple = question.kind === "multiple_choice"; return <label key={option.id}><input type={multiple ? "checkbox" : "radio"} name={question.id} checked={selected.includes(option.id)} onChange={() => setAnswer(question.id, { selectedOptionIds: multiple ? selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id] : [option.id] })}/><span>{option.id}</span>{option.text}</label>; })}</div>}</article>)}</section></div>
    </> : <div className="panel empty-state">Loading authorized assessment…</div>}
  </DashboardLayout>;
}
