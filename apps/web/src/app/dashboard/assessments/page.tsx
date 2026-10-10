"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockTests, mockLeaderboard } from "@/lib/mock-data";

export default function AssessmentsPage() {
  const [tests, setTests] = useState(mockTests);
  const [selectedTest, setSelectedTest] = useState(mockTests[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Test Form State
  const [newTitle, setNewTitle] = useState("");
  const [newPattern, setNewPattern] = useState<"JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM">("JEE_ADVANCED");
  const [newSubject, setNewSubject] = useState("Full Syllabus (PCM)");
  const [newTotalMarks, setNewTotalMarks] = useState(180);
  const [newDuration, setNewDuration] = useState(180);
  const [newBatch, setNewBatch] = useState("JEE 12A - Titans");

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = {
      id: `tst-${Date.now()}`,
      organizationId: "org-1",
      title: newTitle,
      pattern: newPattern,
      subject: newSubject,
      totalMarks: Number(newTotalMarks),
      durationMinutes: Number(newDuration),
      status: "PUBLISHED" as const,
      questionCount: newPattern === "NEET" ? 90 : 54,
      scheduledBatches: [newBatch],
      totalSubmissions: 0,
      avgScorePercent: 0,
      createdAt: new Date().toISOString(),
    };

    setTests([created, ...tests]);
    setSelectedTest(created);
    setShowCreateModal(false);
    setNewTitle("");
  };

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
        <MetricCard label="Total Tests Conducted" value="142" detail="This academic year" accent="yellow" />
        <MetricCard label="Attempts Graded" value="6,420" detail="Instant evaluation" accent="navy" />
        <MetricCard label="Avg. Accuracy Rate" value="74.8%" detail="Across all batches" accent="green" />
        <MetricCard label="PYQ Question Bank" value="25,000+" detail="PrepZii Shared Library" accent="orange" />
      </div>

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
                border: selectedTest.id === test.id ? "2px solid var(--brand-hover)" : "1px solid var(--line)",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all .15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <Badge variant={test.pattern === "JEE_ADVANCED" ? "brand" : test.pattern === "NEET" ? "success" : "info"} size="sm">
                  {test.pattern.replace("_", " ")}
                </Badge>
                <Badge variant="neutral" size="sm">{test.status}</Badge>
              </div>

              <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontFamily: "var(--font-display)" }}>
                {test.title}
              </h3>
              <div style={{ fontSize: "12px", color: "#68736d" }}>{test.subject}</div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", fontSize: "11px", color: "#555" }}>
                <span>⏱ {test.durationMinutes} mins</span>
                <span>🎯 {test.totalMarks} Marks ({test.questionCount} Qs)</span>
                <span>👥 {test.totalSubmissions} attempts</span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Test Details & Leaderboard */}
        <div>
          <Panel
            title={selectedTest.title}
            subtitle={`Pattern: ${selectedTest.pattern.replace("_", " ")} · ${selectedTest.durationMinutes} Mins · ${selectedTest.totalMarks} Total Marks`}
            action={
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="outline" style={{ fontSize: "12px" }}>Export Marks Sheet</Button>
                <Button variant="secondary" style={{ fontSize: "12px" }}>Edit Test</Button>
              </div>
            }
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
              <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#68736d" }}>Scheduled Batch</span>
                <strong style={{ display: "block", fontSize: "13px", marginTop: "2px" }}>
                  {selectedTest.scheduledBatches[0] || "All Batches"}
                </strong>
              </div>
              <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#68736d" }}>Evaluated Submissions</span>
                <strong style={{ display: "block", fontSize: "13px", color: "#4476db", marginTop: "2px" }}>
                  {selectedTest.totalSubmissions} Students
                </strong>
              </div>
              <div style={{ padding: "12px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#68736d" }}>Batch Average</span>
                <strong style={{ display: "block", fontSize: "13px", color: "#1f8d61", marginTop: "2px" }}>
                  {selectedTest.avgScorePercent}% Score
                </strong>
              </div>
            </div>

            <h3 style={{ fontSize: "14px", margin: "18px 0 10px" }}>Ranked Batch Leaderboard</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Batch</th>
                    <th>Score</th>
                    <th>Percentile</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {mockLeaderboard.map((row) => (
                    <tr key={row.attemptId}>
                      <td>
                        <span
                          style={{
                            display: "inline-grid",
                            placeItems: "center",
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: row.rank === 1 ? "#fef3c7" : row.rank === 2 ? "#e2e8f0" : "#ffedd5",
                            color: row.rank === 1 ? "#92400e" : row.rank === 2 ? "#475569" : "#9a3412",
                            fontWeight: 800,
                            fontSize: "12px",
                          }}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td>
                        <strong>{row.studentName}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#68736d" }}>{row.batchName}</span>
                      </td>
                      <td>
                        <strong style={{ color: "#7759e8" }}>{row.score}</strong>
                        <span style={{ fontSize: "11px", color: "#68736d" }}> / {row.totalMarks}</span>
                      </td>
                      <td>
                        <Badge variant="purple" size="sm">{row.percentile}%ile</Badge>
                      </td>
                      <td>
                        <span style={{ color: "#1f8d61", fontWeight: 650, fontSize: "12px" }}>
                          {Math.round((row.correctCount / (row.correctCount + row.incorrectCount)) * 100)}%
                        </span>
                        <div style={{ fontSize: "10px", color: "#68736d" }}>
                          +{row.correctCount} / -{row.incorrectCount}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>

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
              maxWidth: "540px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                Create New Coaching Assessment
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTest} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Test Title (e.g. All India JEE Mock 05)
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="search-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. JEE Advanced Full Mock 05"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Exam Pattern
                  </label>
                  <select
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value as any)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="JEE_ADVANCED">JEE Advanced (Partial Marking)</option>
                    <option value="JEE_MAIN">JEE Main (+4 / -1)</option>
                    <option value="NEET">NEET (+4 / -1, 180 Qs)</option>
                    <option value="CUSTOM">Custom Institute Pattern</option>
                  </select>
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
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={newTotalMarks}
                    onChange={(e) => setNewTotalMarks(Number(e.target.value))}
                    className="search-input"
                    style={{ width: "100%" }}
                  />
                </div>

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
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Target Batch
                </label>
                <select
                  value={newBatch}
                  onChange={(e) => setNewBatch(e.target.value)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  <option value="JEE 12A - Titans">JEE 12A - Titans</option>
                  <option value="JEE 11B - Nucleus">JEE 11B - Nucleus</option>
                  <option value="NEET 12 - Medico Super 50">NEET 12 - Medico Super 50</option>
                  <option value="Foundation 10 - Olympiad">Foundation 10 - Olympiad</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Publish Test
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
