"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockStudents, type StudentRecord } from "@/lib/mock-data";

export default function StudentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("ALL");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const filteredStudents = mockStudents.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch = selectedBatch === "ALL" || student.batchName.includes(selectedBatch);
    return matchesSearch && matchesBatch;
  });

  return (
    <DashboardLayout
      title="Student Directory & Roster"
      subtitle="Track enrollments, attendance percentages, test performance, and parent communications"
      action={
        <Button variant="primary">
          ＋ Enroll Student
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Enrolled" value="1,248" detail="North Campus" accent="yellow" />
        <MetricCard label="Batch Retention" value="98.2%" detail="Term 1 renewal" accent="green" />
        <MetricCard label="Top Performers (>90%)" value="142" detail="JEE & NEET rankers" accent="blue" />
        <MetricCard label="Intervention List (<60%)" value="18" detail="Parent calls scheduled" accent="orange" />
      </div>

      <div className="filter-bar">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by student name or roll no..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="select-input"
          >
            <option value="ALL">All Batches</option>
            <option value="JEE 12A">JEE 12A - Titans</option>
            <option value="JEE 11B">JEE 11B - Nucleus</option>
            <option value="NEET 12">NEET 12 - Medico Super 50</option>
            <option value="Foundation 10">Foundation 10 - Olympiad</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary">Export CSV</Button>
          <Button variant="secondary">Send Batch SMS</Button>
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll Number</th>
              <th>Student Name</th>
              <th>Batch & Stream</th>
              <th>Attendance</th>
              <th>Test Avg. Score</th>
              <th>Parent Contact</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student) => (
              <tr key={student.id}>
                <td>
                  <code style={{ fontSize: "11px", background: "#f0f2ef", padding: "2px 6px", borderRadius: "4px" }}>
                    {student.rollNumber}
                  </code>
                </td>
                <td>
                  <strong>{student.name}</strong>
                  <div style={{ fontSize: "11px", color: "#68736d" }}>{student.phone}</div>
                </td>
                <td>
                  <Badge variant="purple" size="sm">{student.batchName.split(" - ")[0]}</Badge>
                  <div style={{ fontSize: "11px", color: "#68736d", marginTop: "2px" }}>{student.targetExam}</div>
                </td>
                <td>
                  <strong style={{ color: student.attendancePercentage >= 90 ? "#1f8d61" : "#d67b32" }}>
                    {student.attendancePercentage}%
                  </strong>
                </td>
                <td>
                  <strong style={{ color: student.averageScore >= 80 ? "#7759e8" : "#17221d" }}>
                    {student.averageScore}%
                  </strong>
                </td>
                <td>
                  <span style={{ fontSize: "12px", color: "#555" }}>{student.parentPhone}</span>
                </td>
                <td>
                  <Badge variant="success" size="sm">{student.status}</Badge>
                </td>
                <td>
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="pz-button pz-button-secondary"
                    style={{ padding: "5px 10px", fontSize: "12px" }}
                  >
                    View Report
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "white",
              width: "100%",
              maxWidth: "540px",
              height: "100%",
              padding: "32px",
              overflowY: "auto",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <Badge variant="purple" size="sm">{selectedStudent.rollNumber}</Badge>
                <h2 style={{ margin: "8px 0 4px", fontSize: "22px", fontFamily: "var(--font-display)" }}>
                  {selectedStudent.name}
                </h2>
                <p style={{ margin: 0, color: "#68736d", fontSize: "13px" }}>
                  {selectedStudent.batchName} · {selectedStudent.targetExam}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ padding: "14px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "10px" }}>
                <span style={{ fontSize: "11px", color: "#68736d" }}>Attendance Rate</span>
                <strong style={{ display: "block", fontSize: "20px", color: "#1f8d61", marginTop: "4px" }}>
                  {selectedStudent.attendancePercentage}%
                </strong>
              </div>
              <div style={{ padding: "14px", background: "#fbfcfb", border: "1px solid #edf0ed", borderRadius: "10px" }}>
                <span style={{ fontSize: "11px", color: "#68736d" }}>Prepzii Test Average</span>
                <strong style={{ display: "block", fontSize: "20px", color: "#7759e8", marginTop: "4px" }}>
                  {selectedStudent.averageScore}%
                </strong>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Recent Assessment Performance</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ padding: "12px", border: "1px solid #edf0ed", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>All India Prepzii Mock 04</strong>
                    <div style={{ fontSize: "11px", color: "#68736d" }}>JEE Advanced Paper 1</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: "#7759e8" }}>156 / 180</strong>
                    <div style={{ fontSize: "11px", color: "#1f8d61" }}>Rank #2 (98.5%ile)</div>
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid #edf0ed", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>Chapter Test: Rotational Dynamics</strong>
                    <div style={{ fontSize: "11px", color: "#68736d" }}>Physics Advanced</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: "#7759e8" }}>84 / 100</strong>
                    <div style={{ fontSize: "11px", color: "#1f8d61" }}>Rank #3 (96.2%ile)</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Guardian & Communication</h3>
              <div style={{ padding: "14px", border: "1px solid #edf0ed", borderRadius: "10px", display: "grid", gap: "8px", fontSize: "13px" }}>
                <div><strong>Parent / Guardian Contact:</strong> {selectedStudent.parentPhone}</div>
                <div><strong>Student Contact:</strong> {selectedStudent.phone}</div>
                <div><strong>Status:</strong> Active Enrollment (Fees Clear)</div>
              </div>
            </div>

            <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
              <Button variant="primary" style={{ flex: 1 }}>
                Send WhatsApp Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
