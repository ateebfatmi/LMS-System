"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockBatches, mockStudents } from "@/lib/mock-data";

export default function ReportsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showPTMModal, setShowPTMModal] = useState(false);
  const [selectedBatchForPTM, setSelectedBatchForPTM] = useState("ALL");
  const [assignedDPPs, setAssignedDPPs] = useState<Record<string, boolean>>({});

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAssignDPP = (studentId: string, studentName: string) => {
    setAssignedDPPs((prev) => ({ ...prev, [studentId]: true }));
    triggerToast(`Customized AI Revision DPP assigned to ${studentName}!`);
  };

  const handleGeneratePTMReport = () => {
    // Generate CSV report cards for coaching PTM
    const targetStudents = selectedBatchForPTM === "ALL" 
      ? mockStudents 
      : mockStudents.filter((s) => s.batchId === selectedBatchForPTM);

    const headers = ["Roll No", "Student Name", "Batch", "Attendance Rate", "Average Score", "Parent Contact", "Academic Health"];
    const rows = targetStudents.map((s) => [
       s.rollNumber,
       `"${s.name}"`,
       `"${s.batchName}"`,
       `${s.attendancePercentage}%`,
       s.averageScore,
       s.parentPhone,
       s.status,
     ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PrepZii_PTM_ReportCards_${selectedBatchForPTM}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setShowPTMModal(false);
    triggerToast(`PTM Report Cards for ${targetStudents.length} students downloaded successfully!`);
  };

  return (
    <DashboardLayout
      title="Reports & Academic Analytics"
      subtitle="Comprehensive performance indicators, batch benchmark comparisons, and subject strength heatmaps"
      action={
        <Button variant="primary" onClick={() => setShowPTMModal(true)}>
          📥 Generate PTM Report Cards
        </Button>
      }
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "var(--brand-dark)",
          color: "white",
          padding: "14px 22px",
          borderRadius: "8px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          zIndex: 9999,
          fontSize: "14px",
          fontWeight: 600,
          border: "1px solid var(--brand-hover)",
        }}>
          <span style={{ fontSize: "16px" }}>⚡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="metrics-grid">
        <MetricCard label="Institute Average" value="74.6%" detail={<><b>↑ 3.2%</b> vs last mock test</>} accent="yellow" />
        <MetricCard label="Top 1% Rankers" value="28 Students" detail="Projected <1000 AIR" accent="green" />
        <MetricCard label="Need Academic Focus" value="46 Students" detail="Below 55% aggregate" accent="orange" />
        <MetricCard label="DPP Completion Rate" value="86.4%" detail="Consistent homework pace" accent="blue" />
      </div>

      <div className="card-grid-2">
        <Panel title="Subject Strength & Weakness Analysis">
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Physics:</strong> Modern Physics & Optics</span>
                <span style={{ color: "#1f8d61", fontWeight: 700 }}>88.4% Mastery</span>
              </div>
              <ProgressBar value={88} variant="success" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Mathematics:</strong> Calculus & Vectors</span>
                <span style={{ color: "#7759e8", fontWeight: 700 }}>76.2% Mastery</span>
              </div>
              <ProgressBar value={76} variant="default" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Chemistry:</strong> Organic Reaction Mechanisms</span>
                <span style={{ color: "#d67b32", fontWeight: 700 }}>58.5% (Needs Focus)</span>
              </div>
              <ProgressBar value={58} variant="warning" />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                <span><strong>Biology:</strong> Human Physiology & Genetics</span>
                <span style={{ color: "#1f8d61", fontWeight: 700 }}>91.0% Mastery</span>
              </div>
              <ProgressBar value={91} variant="success" />
            </div>
          </div>
        </Panel>

        <Panel title="Batch Benchmark Comparison (Average Score)">
          <div style={{ display: "grid", gap: "14px", marginTop: "6px" }}>
            {mockBatches.map((batch) => (
              <div key={batch.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span><strong>{batch.name}</strong> ({batch.studentCount} students)</span>
                  <Badge variant="purple" size="sm">{batch.attendanceRate}% Attd</Badge>
                </div>
                <ProgressBar value={batch.syllabusProgress} variant="default" />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Panel
          title="Students Recommended for Academic Intervention"
          subtitle="Identified automatically by Prepzii's score and attendance trend algorithm"
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Recent Test Score</th>
                  <th>Attendance</th>
                  <th>Identified Weakness</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>APX-2026-1101</code></td>
                  <td><strong>Rohan Verma</strong></td>
                  <td>JEE 11B - Nucleus</td>
                  <td><strong style={{ color: "#d67b32" }}>54%</strong> (68 / 180)</td>
                  <td><span style={{ color: "#d67b32" }}>86.2%</span></td>
                  <td>Organic Reaction Mechanisms, Complex Numbers</td>
                  <td>
                    {assignedDPPs["std-2"] ? (
                      <span style={{ color: "#1f8d61", fontSize: "12px", fontWeight: 600 }}>✓ DPP Assigned</span>
                    ) : (
                      <Button
                        variant="outline"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => handleAssignDPP("std-2", "Rohan Verma")}
                      >
                        Assign Revision DPP
                      </Button>
                    )}
                  </td>
                </tr>
                <tr>
                  <td><code>APX-2026-1001</code></td>
                  <td><strong>Kabir Sengupta</strong></td>
                  <td>Foundation 10 - Olympiad</td>
                  <td><strong style={{ color: "#d67b32" }}>58%</strong> (74 / 180)</td>
                  <td><span style={{ color: "#d67b32" }}>89.0%</span></td>
                  <td>Trigonometric Identities, Newton&apos;s Laws</td>
                  <td>
                    {assignedDPPs["std-4"] ? (
                      <span style={{ color: "#1f8d61", fontSize: "12px", fontWeight: 600 }}>✓ DPP Assigned</span>
                    ) : (
                      <Button
                        variant="outline"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => handleAssignDPP("std-4", "Kabir Sengupta")}
                      >
                        Assign Revision DPP
                      </Button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* PTM Report Cards Generation Modal */}
      {showPTMModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "14px",
            padding: "24px",
            width: "480px",
            maxWidth: "92vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Generate Parent-Teacher Meeting (PTM) Report Cards
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#68736d" }}>
              Export consolidated academic report cards including test scores, attendance rates, and faculty remarks.
            </p>

            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Select Target Batch
                </label>
                <select
                  value={selectedBatchForPTM}
                  onChange={(e) => setSelectedBatchForPTM(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                >
                  <option value="ALL">All Batches (Whole Coaching Roster)</option>
                  {mockBatches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.studentCount} students)</option>
                  ))}
                </select>
              </div>

              <div style={{ background: "#f8faf9", padding: "14px", borderRadius: "8px", fontSize: "12px", color: "#444", lineHeight: 1.6 }}>
                <div>✓ Includes all latest Chapter Tests & Full Mock Percentiles</div>
                <div>✓ Calculates batch rank and institute benchmark score</div>
                <div>✓ Formatted for direct parent dispatch via PrepZii WhatsApp</div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <Button variant="secondary" onClick={() => setShowPTMModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleGeneratePTMReport}>
                  📥 Export & Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

