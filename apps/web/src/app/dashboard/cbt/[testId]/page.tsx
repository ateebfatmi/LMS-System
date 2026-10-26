"use client";

import { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Badge, Button, PrepziiMark } from "@prepzii/ui";
import type {
  AnswerSubmission,
  CbtSessionState,
  ComprehensiveTestReview,
  QuestionDefinition,
  TestResultSummary,
} from "@prepzii/contracts";

export default function StudentCbtExamPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = use(params);

  // CBT Exam State
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CbtSessionState | null>(null);
  const [questions, setQuestions] = useState<QuestionDefinition[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSecs, setRemainingSecs] = useState<number>(180 * 60);

  // Local answer state for current question
  const [answers, setAnswers] = useState<Record<string, AnswerSubmission>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [visitedQuestions, setVisitedQuestions] = useState<string[]>([]);

  // Submission & Review State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<TestResultSummary | null>(null);
  const [reviewData, setReviewData] = useState<ComprehensiveTestReview | null>(null);
  const [activeTab, setActiveTab] = useState<"EXAM" | "SCORECARD" | "SOLUTIONS">("EXAM");

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize CBT Session from server
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        const res = await fetch("/api/cbt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "START",
            testId,
            studentName: "Aarav Sharma",
            batchName: "JEE 12A - Titans",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to load CBT session");
        }

        const data = await res.json();
        setSession(data.session);
        setQuestions(data.questions);
        setAnswers(data.session.answers || {});
        setMarkedForReview(data.session.markedForReview || []);
        setRemainingSecs(data.session.remainingSeconds || 180 * 60);

        if (data.questions.length > 0) {
          setVisitedQuestions([data.questions[0].id]);
        }
      } catch (err) {
        console.error("CBT init error:", err);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [testId]);

  // 2. Authoritative Timer Countdown
  useEffect(() => {
    if (activeTab !== "EXAM" || !session) return;

    timerRef.current = setInterval(() => {
      setRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          void handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // The effect intentionally restarts only when the active session or tab changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, session]);

  const currentQ = questions[currentIndex];
  const currentAnswer = currentQ ? answers[currentQ.id] : undefined;

  // Format timer HH:MM:SS
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Option selection handling
  const handleSelectOption = (optionId: string) => {
    if (!currentQ) return;

    if (currentQ.kind === "single_choice") {
      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          questionId: currentQ.id,
          selectedOptionIds: [optionId],
          timeSpentSeconds: 15,
        },
      }));
    } else if (currentQ.kind === "multiple_choice") {
      const existing = currentAnswer?.selectedOptionIds || [];
      const updated = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];

      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: {
          questionId: currentQ.id,
          selectedOptionIds: updated,
          timeSpentSeconds: 20,
        },
      }));
    }
  };

  const handleNumericalInput = (val: string) => {
    if (!currentQ) return;
    const num = parseFloat(val);
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        questionId: currentQ.id,
        number: isNaN(num) ? undefined : num,
        timeSpentSeconds: 30,
      },
    }));
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQ.id];
      return copy;
    });
  };

  const handleToggleMarkReview = () => {
    if (!currentQ) return;
    setMarkedForReview((prev) =>
      prev.includes(currentQ.id) ? prev.filter((id) => id !== currentQ.id) : [...prev, currentQ.id]
    );
  };

  // Autosave and navigate
  const handleSaveAndNext = async () => {
    if (!currentQ || !session) return;

    // Trigger server autosave asynchronously
    fetch("/api/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "AUTOSAVE",
        attemptId: session.attemptId,
        questionId: currentQ.id,
        answer: answers[currentQ.id],
        timeSpentSeconds: 30,
        markedForReview: markedForReview.includes(currentQ.id),
      }),
    }).catch(console.error);

    // Move to next question
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const nextQId = questions[nextIdx].id;
      if (!visitedQuestions.includes(nextQId)) {
        setVisitedQuestions((prev) => [...prev, nextQId]);
      }
    }
  };

  // Submit test to server
  async function handleSubmitTest() {
    if (!session) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/cbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT",
          attemptId: session.attemptId,
        }),
      });

      const data = await res.json();
      setSubmissionResult(data.result);
      setShowConfirmModal(false);
      setActiveTab("SCORECARD");
    } catch (err) {
      console.error("Submission failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Load Review & Solutions
  const handleLoadReview = async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/cbt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVIEW",
          attemptId: session.attemptId,
        }),
      });
      const data = await res.json();
      setReviewData(data);
      setActiveTab("SOLUTIONS");
    } catch (err) {
      console.error("Failed to load review:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>🚀</div>
          <h2 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Starting Secure CBT Simulator...</h2>
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading question paper and syncing authoritative timer</p>
        </div>
      </div>
    );
  }

  // --- VIEW 2: POST-EXAM SCORECARD ---
  if (activeTab === "SCORECARD" && submissionResult) {
    return (
      <div style={{ maxWidth: "880px", margin: "40px auto", padding: "0 20px" }}>
        <div style={{ background: "white", padding: "36px", borderRadius: "16px", border: "1px solid var(--line)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "20px" }}>
            <div>
              <Badge variant="brand" size="md">CBT EVALUATION COMPLETED</Badge>
              <h1 style={{ margin: "8px 0 4px", fontSize: "24px", fontFamily: "var(--font-display)" }}>
                Assessment Scorecard & Rank Card
              </h1>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                Candidate: <strong>{submissionResult.studentName}</strong> · Batch: <strong>{submissionResult.batchName}</strong>
              </p>
            </div>
            <Link href="/dashboard/assessments/workspace" className="pz-button pz-button-outline">
              ← Return to Dashboard
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", margin: "24px 0" }}>
            <div style={{ padding: "18px", background: "rgba(250, 204, 21, 0.1)", borderRadius: "12px", border: "1px solid rgba(250, 204, 21, 0.3)" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>TOTAL SCORE</span>
              <strong style={{ display: "block", fontSize: "26px", color: "#0f172a", marginTop: "4px" }}>
                {submissionResult.score} <span style={{ fontSize: "14px", color: "var(--muted)" }}>/ {submissionResult.totalMarks}</span>
              </strong>
            </div>

            <div style={{ padding: "18px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534" }}>BATCH RANK</span>
              <strong style={{ display: "block", fontSize: "26px", color: "#15803d", marginTop: "4px" }}>
                #{submissionResult.rank}
              </strong>
            </div>

            <div style={{ padding: "18px", background: "#eff6ff", borderRadius: "12px", border: "1px solid #bfdbfe" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#1e40af" }}>PERCENTILE</span>
              <strong style={{ display: "block", fontSize: "26px", color: "#2563eb", marginTop: "4px" }}>
                {submissionResult.percentile}%ile
              </strong>
            </div>

            <div style={{ padding: "18px", background: "#faf5ff", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8" }}>ACCURACY</span>
              <strong style={{ display: "block", fontSize: "26px", color: "#7e22ce", marginTop: "4px" }}>
                {submissionResult.percentage}%
              </strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "12px" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "14px" }}>Performance Summary</h3>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>Correct Answers</span>
                <strong style={{ color: "#15803d" }}>+{submissionResult.correctCount} Qs</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>Incorrect Answers</span>
                <strong style={{ color: "#b91c1c" }}>-{submissionResult.incorrectCount} Qs</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                <span>Unattempted</span>
                <strong style={{ color: "var(--muted)" }}>{submissionResult.unansweredCount} Qs</strong>
              </div>
            </div>

            <div style={{ padding: "18px", border: "1px solid var(--line)", borderRadius: "12px", background: "#f8fafc" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "14px" }}>Official Solution & Explanation Review</h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                Review detailed question-by-question explanations, correct answer keys, and your step-by-step marking.
              </p>
              <Button variant="primary" onClick={handleLoadReview} style={{ width: "100%", marginTop: "12px" }}>
                📖 Open Complete Solution Review
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 3: COMPREHENSIVE QUESTION-BY-QUESTION SOLUTIONS REVIEW ---
  if (activeTab === "SOLUTIONS" && reviewData) {
    return (
      <div style={{ maxWidth: "960px", margin: "40px auto", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontFamily: "var(--font-display)" }}>
              Detailed Question Solutions & Key Review
            </h1>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
              All answers evaluated using PrepZii Authoritative Marking Engine
            </p>
          </div>
          <button onClick={() => setActiveTab("SCORECARD")} className="pz-button pz-button-outline">
            ← Back to Scorecard
          </button>
        </div>

        <div style={{ display: "grid", gap: "18px" }}>
          {reviewData.questionReviews.map((rev, idx) => (
            <div key={rev.question.id} style={{ background: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>
                  QUESTION {idx + 1} · {rev.question.subject}
                </span>
                <Badge
                  variant={rev.graded.status === "correct" ? "success" : rev.graded.status === "partially_correct" ? "warning" : rev.graded.status === "incorrect" ? "danger" : "neutral"}
                  size="sm"
                >
                  {rev.graded.status.toUpperCase()} ({rev.graded.score > 0 ? `+${rev.graded.score}` : rev.graded.score} Marks)
                </Badge>
              </div>

              <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "14px", fontWeight: 500 }}>
                {rev.question.text}
              </div>

              {rev.question.options && (
                <div style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
                  {rev.question.options.map((opt) => {
                    const isSelected = rev.submittedAnswer?.selectedOptionIds?.includes(opt.id);
                    const isCorrect = rev.question.correctOptionIds?.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          border: isCorrect ? "2px solid #22c55e" : isSelected ? "2px solid #ef4444" : "1px solid var(--line)",
                          background: isCorrect ? "#f0fdf4" : isSelected ? "#fef2f2" : "#ffffff",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>{opt.text}</span>
                        {isCorrect && <span style={{ color: "#166534", fontWeight: 700, fontSize: "11px" }}>✓ Correct Key</span>}
                        {isSelected && !isCorrect && <span style={{ color: "#991b1b", fontWeight: 700, fontSize: "11px" }}>✕ Your Selection</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {rev.question.solutionExplanation && (
                <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", lineHeight: "1.6" }}>
                  <strong style={{ color: "#0f172a", display: "block", marginBottom: "4px" }}>💡 Step-by-Step Explanation:</strong>
                  {rev.question.solutionExplanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VIEW 1: ACTIVE SECURE CBT EXAM INTERFACE ---
  const answeredCount = Object.keys(answers).length;
  const reviewCount = markedForReview.length;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column" }}>
      {/* 1. TOP HEADER: EXAM CONTROLS & TIMERS */}
      <header
        style={{
          background: "#0f172a",
          color: "white",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid var(--brand)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <PrepziiMark theme="dark" compact />
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontFamily: "var(--font-display)", color: "white" }}>
              All India JEE / NEET Mock Series
            </h2>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              Candidate: <strong>Aarav Sharma</strong> · Roll: <strong>APX-2026-1201</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Live countdown timer */}
          <div
            style={{
              background: remainingSecs < 300 ? "#b91c1c" : "#1e293b",
              color: "white",
              padding: "6px 14px",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "16px",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span>⏱</span>
            <span>{formatTime(remainingSecs)}</span>
          </div>

          <Button variant="primary" onClick={() => setShowConfirmModal(true)} style={{ fontSize: "12px", padding: "8px 18px" }}>
            Submit Test
          </Button>
        </div>
      </header>

      {/* 2. MAIN CBT WORKSPACE (QUESTION AREA + NTA PALETTE) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1 }}>
        {/* Left: Active Question Display */}
        <div style={{ padding: "30px 40px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
          {currentQ ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "14px", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
                    QUESTION {currentIndex + 1} OF {questions.length}
                  </span>
                  <span style={{ marginLeft: "12px", fontSize: "12px", background: "#e2e8f0", padding: "2px 8px", borderRadius: "4px" }}>
                    {currentQ.subject}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Marking Scheme: <strong style={{ color: "#15803d" }}>+{currentQ.marks}</strong> / <strong style={{ color: "#b91c1c" }}>-{currentQ.negativeMarks || 0}</strong>
                  {currentQ.partialMarking && <span style={{ marginLeft: "6px", color: "#854d0e", fontWeight: 600 }}>(Partial Marking)</span>}
                </div>
              </div>

              {/* Question Text */}
              <div style={{ margin: "24px 0", fontSize: "15px", lineHeight: "1.7", color: "#0f172a" }}>
                {currentQ.text}
              </div>

              {/* Options or Numerical Keypad */}
              {currentQ.kind === "numerical" ? (
                <div style={{ marginTop: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                    Enter Numerical Value:
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={currentAnswer?.number !== undefined ? currentAnswer.number : ""}
                    onChange={(e) => handleNumericalInput(e.target.value)}
                    placeholder="e.g. 1.89"
                    style={{
                      padding: "10px 14px",
                      fontSize: "16px",
                      fontFamily: "var(--font-mono)",
                      borderRadius: "8px",
                      border: "2px solid var(--brand)",
                      maxWidth: "240px",
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px", marginTop: "18px" }}>
                  {currentQ.options?.map((opt, i) => {
                    const isSelected = currentAnswer?.selectedOptionIds?.includes(opt.id);
                    const marker = String.fromCharCode(65 + i);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(opt.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "14px 18px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid var(--brand-hover)" : "1px solid var(--line)",
                          background: isSelected ? "rgba(250, 204, 21, 0.08)" : "#ffffff",
                          cursor: "pointer",
                          transition: "all .15s ease",
                        }}
                      >
                        <span
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: isSelected ? "var(--brand)" : "#f1f5f9",
                            color: isSelected ? "#0f172a" : "#475569",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {marker}
                        </span>
                        <span style={{ fontSize: "14px", color: "#1e293b" }}>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>No questions available.</div>
          )}

          {/* Bottom Action Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px", borderTop: "1px solid var(--line)", marginTop: "30px" }}>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleToggleMarkReview}
                className="pz-button pz-button-outline"
                style={{
                  fontSize: "12px",
                  borderColor: markedForReview.includes(currentQ?.id || "") ? "#8b5cf6" : "var(--line)",
                  color: markedForReview.includes(currentQ?.id || "") ? "#7c3aed" : "inherit",
                }}
              >
                {markedForReview.includes(currentQ?.id || "") ? "★ Marked for Review" : "☆ Mark for Review"}
              </button>
              <button onClick={handleClearResponse} className="pz-button pz-button-secondary" style={{ fontSize: "12px" }}>
                Clear Response
              </button>
            </div>

            <Button variant="primary" onClick={handleSaveAndNext} style={{ fontSize: "13px", padding: "10px 24px" }}>
              Save & Next →
            </Button>
          </div>
        </div>

        {/* Right: Authentic NTA Question Palette */}
        <aside style={{ background: "#f8fafc", borderLeft: "1px solid var(--line)", padding: "20px", display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: "13px", color: "#334155" }}>Question Palette</h3>

          {/* Palette Legend */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#22c55e", borderRadius: "3px" }} />
              <span>Answered ({answeredCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#ef4444", borderRadius: "3px" }} />
              <span>Unanswered ({questions.length - answeredCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#8b5cf6", borderRadius: "3px" }} />
              <span>Review ({reviewCount})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "12px", height: "12px", background: "#cbd5e1", borderRadius: "3px" }} />
              <span>Not Visited</span>
            </div>
          </div>

          {/* Question Grid Buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", overflowY: "auto", flex: 1 }}>
            {questions.map((q, idx) => {
              const isAns = Boolean(answers[q.id]);
              const isRev = markedForReview.includes(q.id);
              const isCurrent = idx === currentIndex;

              let bg = "#e2e8f0";
              let textCol = "#475569";
              if (isAns) {
                bg = "#22c55e";
                textCol = "#ffffff";
              } else if (visitedQuestions.includes(q.id)) {
                bg = "#ef4444";
                textCol = "#ffffff";
              }
              if (isRev) {
                bg = "#8b5cf6";
                textCol = "#ffffff";
              }

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(idx);
                    if (!visitedQuestions.includes(q.id)) {
                      setVisitedQuestions((prev) => [...prev, q.id]);
                    }
                  }}
                  style={{
                    height: "38px",
                    borderRadius: "6px",
                    border: isCurrent ? "2px solid #0f172a" : "none",
                    background: bg,
                    color: textCol,
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: "20px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
            <Button variant="navy" onClick={() => setShowConfirmModal(true)} style={{ width: "100%", fontSize: "12px" }}>
              Submit Exam Paper
            </Button>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "white", padding: "28px", borderRadius: "14px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Are you sure you want to submit?
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "var(--muted)" }}>
              Once submitted, you cannot change your answers. Your responses will be server-evaluated immediately.
            </p>

            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", fontSize: "12px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span>Total Answered:</span>
                <strong>{answeredCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span>Marked for Review:</span>
                <strong>{reviewCount}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Unattempted:</span>
                <strong>{questions.length - answeredCount}</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <Button variant="secondary" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
                Resume Exam
              </Button>
              <Button variant="primary" onClick={handleSubmitTest} disabled={isSubmitting}>
                {isSubmitting ? "Grading..." : "Confirm & Submit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
