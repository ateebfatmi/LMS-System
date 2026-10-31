"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Panel, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { InstituteTest, QuestionBankItem, TestPattern, TestResultSummary } from "@prepzii/contracts";
import { getActiveOrganizationId, useActiveOrganizationId } from "@/lib/client-org";

export default function AssessmentsPage() {
  const activeOrganizationId = useActiveOrganizationId();
  type AssessmentListItem = InstituteTest & {
    scheduledBatches?: string[];
    totalSubmissions?: number;
    avgScorePercent?: number;
  };
  const [tests, setTests] = useState<AssessmentListItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<AssessmentListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<TestResultSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  // New Test Form State
  const [newTitle, setNewTitle] = useState("");
  const [newPattern, setNewPattern] = useState<"JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM">("JEE_ADVANCED");
  const [newSubject, setNewSubject] = useState("Full Syllabus (PCM)");
  const newTotalMarks = 180;
  const [newDuration, setNewDuration] = useState(180);
  const [newBatch, setNewBatch] = useState("jee 2028");

  // Question Bank Picker State
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [diffFilter, setDiffFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [qSearch, setQSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tests on page mount
  useEffect(() => {
    async function loadTests() {
      try {
        setLoading(true);
        const orgId = getActiveOrganizationId();
        const url = orgId ? `/api/assessments?organizationId=${encodeURIComponent(orgId)}` : "/api/assessments";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.tests && Array.isArray(data.tests)) {
            setTests(data.tests);
            if (data.tests.length > 0) {
              setSelectedTest(data.tests[0]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load assessments:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTests();
  }, [activeOrganizationId]);

  // Fetch live leaderboard on test selection
  useEffect(() => {
    async function loadLeaderboard() {
      if (!selectedTest) return;
      try {
        const orgId = getActiveOrganizationId();
        const url = `/api/assessments?testId=${selectedTest.id}${orgId ? `&organizationId=${encodeURIComponent(orgId)}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.leaderboard && data.leaderboard.length > 0) {
            setLeaderboard(data.leaderboard);
          } else {
            setLeaderboard([]);
          }
        }
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      }
    }
    loadLeaderboard();
  }, [selectedTest, activeOrganizationId]);

  // Fetch questions from question bank API when wizard opens
  useEffect(() => {
    if (!showCreateModal) return;

    async function fetchQuestions() {
      try {
        setLoadingQuestions(true);
        const orgId = getActiveOrganizationId();
        const url = orgId ? `/api/questions?organizationId=${encodeURIComponent(orgId)}` : "/api/questions";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setBankQuestions(data.items || []);
          // Auto-select initial 3 questions if none selected
          if (selectedQIds.length === 0 && data.items?.length > 0) {
            setSelectedQIds((data.items as QuestionBankItem[]).slice(0, 3).map((q) => q.id));
          }
        }
      } catch (err) {
        console.error("Failed to fetch question bank:", err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    fetchQuestions();
  }, [activeOrganizationId, showCreateModal, selectedQIds.length]);

  const toggleQuestionSelection = (id: string) => {
    setSelectedQIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const orgId = getActiveOrganizationId();
      const url = orgId ? `/api/assessments?organizationId=${encodeURIComponent(orgId)}` : "/api/assessments";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          pattern: newPattern,
          subject: newSubject,
          totalMarks: Number(newTotalMarks),
          durationMinutes: Number(newDuration),
          targetBatchName: newBatch,
          questionIds: selectedQIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const created = data.test;
        setTests([created, ...tests]);
        setSelectedTest(created);
        setShowCreateModal(false);
        setWizardStep(1);
        setNewTitle("");
      }
    } catch (err) {
      console.error("Failed to publish test:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuestions = bankQuestions.filter((q) => {
    if (subjectFilter !== "ALL" && q.subject !== subjectFilter) return false;
    if (diffFilter !== "ALL" && q.difficulty !== diffFilter) return false;
    if (sourceFilter === "PYQ" && !q.isPyq) return false;
    if (sourceFilter === "STANDARD" && q.isPyq) return false;
    if (qSearch.trim()) {
      const query = qSearch.toLowerCase();
      const matchText = q.text?.toLowerCase().includes(query);
      const matchChapter = q.chapter?.toLowerCase().includes(query);
      if (!matchText && !matchChapter) return false;
    }
    return true;
  });

  const selectedMarksTotal = bankQuestions
    .filter((q) => selectedQIds.includes(q.id))
    .reduce((sum, q) => sum + (q.marks || 4), 0);

  return (
    <DashboardLayout
      title="Assessments & Exam Engine"
      subtitle="Create JEE/NEET standard mock tests, schedule batch exams, and review live ranked leaderboards"
      action={
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          ＋ Create New Test
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Tests Conducted" value={String(tests.length)} detail="Configured for this institute" accent="yellow" />
        <MetricCard label="Attempts Graded" value={String(tests.reduce((acc, t) => acc + (t.totalSubmissions || 0), 0))} detail="Instant server-side grading" accent="navy" />
        <MetricCard label="Avg. Accuracy Rate" value="No data" detail="Across all batches" accent="green" />
        <MetricCard label="PYQ Question Bank" value="Live library" detail="PrepZii Shared Library" accent="orange" />
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          Loading assessments from institute backend...
        </div>
      ) : tests.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            borderRadius: "12px",
            border: "1px dashed var(--line)",
            marginTop: "16px",
          }}
        >
          <h3 style={{ fontSize: "16px", color: "#1e293b", margin: "0 0 6px" }}>No assessments created</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>
            Create a new test to schedule assessments and evaluate student performance with live CBT.
          </p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            ＋ Create First Assessment
          </Button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "18px", marginTop: "10px" }}>
          {/* Test List */}
          <div style={{ display: "grid", gap: "12px", height: "fit-content" }}>
            {tests.map((test) => (
              <div
                key={test.id}
                onClick={() => setSelectedTest(test)}
                style={{
                  padding: "18px",
                  background: "white",
                  border: selectedTest?.id === test.id ? "2px solid var(--brand-hover)" : "1px solid var(--line)",
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "all .15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <Badge variant={test.pattern === "JEE_ADVANCED" ? "brand" : test.pattern === "NEET" ? "success" : "info"} size="sm">
                    {(test.pattern || "JEE").replace("_", " ")}
                  </Badge>
                  <Badge variant="neutral" size="sm">{test.status}</Badge>
                </div>

                <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontFamily: "var(--font-display)" }}>
                  {test.title}
                </h3>
                <div style={{ fontSize: "12px", color: "#68736d" }}>{test.subject}</div>

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11px", color: "#555" }}>
                  <span>⏱ {test.durationMinutes || 180} mins</span>
                  <span>🎯 {test.totalMarks || 180} Marks ({test.questionCount || 0} Qs)</span>
                  <span>👥 {test.totalSubmissions || 0} attempts</span>
                </div>
              </div>
            ))}
          </div>

          {/* Selected Test Details & Leaderboard */}
          <div>
            {selectedTest ? (
              <Panel
                title={selectedTest.title}
                subtitle={`Pattern: ${(selectedTest.pattern || "JEE").replace("_", " ")} · ${selectedTest.durationMinutes || 180} Mins · ${selectedTest.totalMarks || 180} Total Marks`}
                action={
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Link
                      href={`/dashboard/cbt/${selectedTest.id}`}
                      className="pz-button pz-button-primary"
                      style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      🚀 Launch Student CBT Simulator
                    </Link>
                  </div>
                }
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
                  <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#68736d" }}>Scheduled Batch</span>
                    <strong style={{ display: "block", fontSize: "13px", marginTop: "2px" }}>
                      {selectedTest.scheduledBatches?.[0] || "All Batches"}
                    </strong>
                  </div>
                  <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#68736d" }}>Evaluated Submissions</span>
                    <strong style={{ display: "block", fontSize: "13px", color: "#4476db", marginTop: "2px" }}>
                      {selectedTest.totalSubmissions || 0} Candidates
                    </strong>
                  </div>
                  <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#68736d" }}>Batch Average</span>
                    <strong style={{ display: "block", fontSize: "13px", color: "#1f8d61", marginTop: "2px" }}>
                      {selectedTest.avgScorePercent || 0}% Score
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" }}>
                  <h3 style={{ fontSize: "14px", margin: 0 }}>Ranked Batch Leaderboard</h3>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Authoritative Percentile Ranking</span>
                </div>

                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student Name</th>
                        <th>Batch</th>
                        <th>Score</th>
                        <th>Percentile</th>
                        <th>Accuracy</th>
                        <th>Timing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--muted)" }}>
                            No submissions recorded for this assessment yet.
                          </td>
                        </tr>
                      ) : (
                        leaderboard.map((res) => (
                          <tr key={res.attemptId}>
                            <td>
                              <Badge
                                variant={res.rank === 1 ? "yellow" : res.rank === 2 ? "brand" : res.rank === 3 ? "purple" : "neutral"}
                                size="sm"
                              >
                                #{res.rank}
                              </Badge>
                            </td>
                            <td><strong>{res.studentName}</strong></td>
                            <td>{res.batchName}</td>
                            <td>
                              <strong>{res.score}</strong> / {res.totalMarks}
                            </td>
                            <td>
                              <strong style={{ color: "#1f8d61" }}>{res.percentile}%ile</strong>
                            </td>
                            <td>
                              {res.correctCount + res.incorrectCount > 0
                                ? `${Math.round((res.correctCount / (res.correctCount + res.incorrectCount)) * 100)}%`
                                : "0%"}
                            </td>
                            <td style={{ fontSize: "12px", color: "#555" }}>
                              {new Date(res.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                Select an assessment from the left to view details and leaderboard.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE ASSESSMENT WIZARD MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "16px",
              maxWidth: wizardStep === 2 ? "780px" : "560px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              transition: "all .2s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                  {wizardStep === 1 ? "Step 1: Test Details & Schedule" : "Step 2: Question Bank Picker"}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  {wizardStep === 1
                    ? "Configure exam pattern, scoring, and target batch"
                    : "Select questions from shared PrepZii question bank & PYQ archives"}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* STEP 1: FORM */}
            {wizardStep === 1 && (
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Test Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="e.g. All India JEE Advanced Paper 02"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                      Exam Pattern
                    </label>
                    <Select
                      value={newPattern}
                      onChange={(val) => setNewPattern(val as TestPattern)}
                      style={{ width: "100%" }}
                    >
                      <option value="JEE_ADVANCED">JEE Advanced (Partial Marking)</option>
                      <option value="JEE_MAIN">JEE Main (+4 / -1)</option>
                      <option value="NEET">NEET (+4 / -1)</option>
                      <option value="CUSTOM">Custom Pattern</option>
                    </Select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                      Subject Coverage
                    </label>
                    <input
                      type="text"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="search-input"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="search-input"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                      Target Batch
                    </label>
                    <input
                      type="text"
                      value={newBatch}
                      onChange={(e) => setNewBatch(e.target.value)}
                      className="search-input"
                      style={{ width: "100%" }}
                      placeholder="e.g. jee 2028 or a1 batch"
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                  <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!newTitle.trim()}
                    onClick={() => setWizardStep(2)}
                  >
                    Next: Pick Questions ({selectedQIds.length}) →
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: QUESTION BANK PICKER */}
            {wizardStep === 2 && (
              <form onSubmit={handleCreateTest}>
                {/* Filter Bar */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
                  <Select
                    value={subjectFilter}
                    onChange={(val) => setSubjectFilter(val)}
                    style={{ minWidth: "150px" }}
                  >
                    <option value="ALL">All Subjects</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                  </Select>

                  <Select
                    value={diffFilter}
                    onChange={(val) => setDiffFilter(val)}
                    style={{ minWidth: "150px" }}
                  >
                    <option value="ALL">All Difficulties</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="ADVANCED">Advanced</option>
                  </Select>

                  <Select
                    value={sourceFilter}
                    onChange={(val) => setSourceFilter(val)}
                    style={{ minWidth: "180px" }}
                  >
                    <option value="ALL">All Sources (PYQ + Bank)</option>
                    <option value="PYQ">PYQ Only</option>
                    <option value="STANDARD">Question Bank Only</option>
                  </Select>

                  <input
                    type="text"
                    placeholder="Search question text or chapter..."
                    value={qSearch}
                    onChange={(e) => setQSearch(e.target.value)}
                    className="search-input"
                    style={{ flex: 1, minWidth: "160px" }}
                  />

                  <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span>Selected: <strong>{selectedQIds.length} Qs</strong></span>
                    <Badge variant="brand" size="sm">{selectedMarksTotal} Marks</Badge>
                  </div>
                </div>

                {/* Question List */}
                {loadingQuestions ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                    Loading shared PrepZii questions...
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>
                    No questions matched the filters.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "10px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
                    {filteredQuestions.map((q) => {
                      const isSelected = selectedQIds.includes(q.id);

                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuestionSelection(q.id)}
                          style={{
                            padding: "14px",
                            borderRadius: "10px",
                            border: isSelected ? "2px solid var(--brand-hover)" : "1px solid var(--line)",
                            background: isSelected ? "rgba(250, 204, 21, 0.06)" : "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ cursor: "pointer" }}
                              />
                              <Badge variant="purple" size="sm">{q.subject}</Badge>
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{q.chapter}</span>
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {q.isPyq && <span style={{ color: "#d97706", fontWeight: 700, marginRight: "6px" }}>PYQ {q.pyqYear || ""}</span>}
                              <span>+{q.marks || 4} / -{q.negativeMarks || 1}</span>
                            </div>
                          </div>

                          <p style={{ margin: "4px 0 8px", fontSize: "13px", color: "#1e293b", lineHeight: 1.5 }}>
                            {q.text}
                          </p>

                          {q.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={q.imageUrl}
                              alt="Question Figure"
                              style={{ maxHeight: "160px", maxWidth: "100%", objectFit: "contain", margin: "6px 0", borderRadius: "6px" }}
                            />
                          )}

                          {q.options && q.options.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "8px" }}>
                              {q.options.map((opt) => (
                                <div
                                  key={opt.id}
                                  style={{
                                    fontSize: "12px",
                                    background: "#f8fafc",
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid #e2e8f0",
                                    color: "#334155",
                                  }}
                                >
                                  <strong>({opt.id.toUpperCase()})</strong> {opt.text}
                                  {opt.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={opt.imageUrl}
                                      alt={`Option ${opt.id}`}
                                      style={{ display: "block", maxHeight: "60px", marginTop: "4px", borderRadius: "4px" }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px" }}>
                  <Button type="button" variant="secondary" onClick={() => setWizardStep(1)}>
                    ← Back to Details
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmitting || selectedQIds.length === 0}>
                    {isSubmitting ? "Publishing..." : `Publish & Schedule Test (${selectedQIds.length} Qs)`}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
