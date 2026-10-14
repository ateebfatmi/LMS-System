"use client";

import { useState } from "react";
import { Badge, Button, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockStudents, type StudentRecord } from "@/lib/mock-data";
import { CSVImporterModal } from "@/components/csv-importer-modal";
import { WhatsAppDispatcherModal } from "@/components/whatsapp-dispatcher-modal";

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>(mockStudents);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("ALL");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Modal States
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);

  // New Enroll Form
  const [newRoll, setNewRoll] = useState(`APX-2026-${1200 + students.length + 1}`);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const [newBatch, setNewBatch] = useState("JEE 12A - Titans");

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch = selectedBatch === "ALL" || student.batchName.includes(selectedBatch);
    return matchesSearch && matchesBatch;
  });

  const handleManualEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created: StudentRecord = {
      id: `std-${Date.now()}`,
      name: newName,
      rollNumber: newRoll,
      batchId: "batch-1",
      batchName: newBatch,
      targetExam: newBatch.includes("JEE") ? "JEE Advanced" : newBatch.includes("NEET") ? "NEET" : "Foundation",
      phone: newPhone || "+91 98765 00000",
      parentPhone: newParentPhone || "+91 98765 00001",
      attendancePercentage: 100,
      averageScore: 85,
      status: "ACTIVE",
    };

    setStudents([created, ...students]);
    setShowEnrollModal(false);
    setNewName("");
    setNewPhone("");
    setNewParentPhone("");
  };

  const handleCSVImportSuccess = (parsedData: Record<string, string>[]) => {
    const imported: StudentRecord[] = parsedData.map((row, idx) => ({
      id: `std-csv-${Date.now()}-${idx}`,
      name: row.name || `Student ${idx + 1}`,
      rollNumber: row.rollNumber || `APX-2026-${1300 + idx}`,
      batchId: "batch-1",
      batchName: row.batchName || "JEE 12A - Titans",
      targetExam: row.targetExam || "JEE Main & Advanced",
      phone: row.phone || "+91 98765 11111",
      parentPhone: row.parentPhone || "+91 98765 22222",
      attendancePercentage: Number(row.attendancePercentage) || 95,
      averageScore: Number(row.averageScore) || 82,
      status: "ACTIVE",
    }));

    setStudents([...imported, ...students]);
  };

  const sampleRosterCSV = `rollNumber,name,batchName,targetExam,phone,parentPhone
APX-2026-1210,Devansh Verma,JEE 12A - Titans,JEE Advanced,+91 98765 12345,+91 98765 54321
APX-2026-1211,Sanya Malhotra,NEET 12 - Medico Super 50,NEET,+91 98765 23456,+91 98765 65432
APX-2026-1212,Yashvardhan Shukla,JEE 11B - Nucleus,JEE Main,+91 98765 34567,+91 98765 76543`;

  return (
    <DashboardLayout
      title="Student Directory & Roster"
      subtitle="Track enrollments, attendance percentages, test performance, and parent communications"
      action={
        <div style={{ display: "flex", gap: "10px" }}>
          <Button variant="outline" onClick={() => setShowCSVModal(true)}>
            📥 Import Roster CSV
          </Button>
          <Button variant="primary" onClick={() => setShowEnrollModal(true)}>
            ＋ Enroll Student
          </Button>
        </div>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Enrolled" value={String(students.length)} detail="North Campus Roster" accent="yellow" />
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
          <Button variant="secondary" onClick={() => setShowCSVModal(true)}>
            📥 CSV Importer
          </Button>
          <Button variant="brand" onClick={() => setShowWhatsAppModal(true)}>
            💬 Dispatch Parent Alerts ({filteredStudents.length})
          </Button>
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
                  <strong style={{ color: student.averageScore >= 80 ? "#1f8d61" : "#c2410c" }}>
                    {student.averageScore}%
                  </strong>
                </td>
                <td>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>{student.parentPhone}</div>
                  <div style={{ fontSize: "10px", color: "#16a34a" }}>✓ Verified WhatsApp</div>
                </td>
                <td>
                  <Badge variant={student.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                    {student.status}
                  </Badge>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <Button
                      variant="secondary"
                      className="btn-xs"
                      onClick={() => setSelectedStudent(student)}
                    >
                      👤 View Profile
                    </Button>
                    <Button
                      variant="outline"
                      className="btn-xs"
                      onClick={() => {
                        setSelectedStudent(student);
                        setShowWhatsAppModal(true);
                      }}
                    >
                      💬 Message
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Student Profile & Progress Drawer */}
      {selectedStudent && !showWhatsAppModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
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
                <Badge variant="brand" size="sm">{selectedStudent.rollNumber}</Badge>
                <h2 style={{ margin: "8px 0 4px", fontSize: "22px", fontFamily: "var(--font-display)" }}>
                  {selectedStudent.name}
                </h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                  {selectedStudent.batchName} · {selectedStudent.targetExam}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ padding: "14px", background: "#f8fafc", border: "1px solid var(--line)", borderRadius: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Attendance Rate</span>
                <strong style={{ display: "block", fontSize: "20px", color: "#10b981", marginTop: "4px" }}>
                  {selectedStudent.attendancePercentage}%
                </strong>
              </div>
              <div style={{ padding: "14px", background: "#f8fafc", border: "1px solid var(--line)", borderRadius: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>PrepZii Test Average</span>
                <strong style={{ display: "block", fontSize: "20px", color: "#2563eb", marginTop: "4px" }}>
                  {selectedStudent.averageScore}%
                </strong>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Recent Assessment Performance</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>All India PrepZii Mock 04</strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>JEE Advanced Paper 1</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: "#2563eb" }}>156 / 180</strong>
                    <div style={{ fontSize: "11px", color: "#10b981" }}>Rank #2 (98.5%ile)</div>
                  </div>
                </div>

                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>Chapter Test: Rotational Dynamics</strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>Physics Advanced</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ color: "#2563eb" }}>84 / 100</strong>
                    <div style={{ fontSize: "11px", color: "#10b981" }}>Rank #3 (96.2%ile)</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Guardian & Communication</h3>
              <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "10px", display: "grid", gap: "8px", fontSize: "13px" }}>
                <div><strong>Parent WhatsApp:</strong> {selectedStudent.parentPhone}</div>
                <div><strong>Student Mobile:</strong> {selectedStudent.phone}</div>
                <div><strong>Enrollment Status:</strong> <Badge variant="success" size="sm">ACTIVE</Badge></div>
              </div>
            </div>

            <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
              <Button variant="secondary" style={{ flex: 1 }} onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
              <Button
                variant="brand"
                style={{ flex: 1 }}
                onClick={() => setShowWhatsAppModal(true)}
              >
                💬 Send WhatsApp Alert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Enroll Modal */}
      {showEnrollModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: "24px", borderRadius: "16px", width: "100%", maxWidth: "480px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Enroll New Student</h3>
            <form onSubmit={handleManualEnroll} style={{ display: "grid", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Roll Number:
                <input value={newRoll} onChange={(e) => setNewRoll(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--line)" }} />
              </label>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Student Full Name:
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--line)" }} />
              </label>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Batch Assignment:
                <select value={newBatch} onChange={(e) => setNewBatch(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                  <option value="JEE 12A - Titans">JEE 12A - Titans</option>
                  <option value="JEE 11B - Nucleus">JEE 11B - Nucleus</option>
                  <option value="NEET 12 - Medico Super 50">NEET 12 - Medico Super 50</option>
                  <option value="Foundation 10 - Olympiad">Foundation 10 - Olympiad</option>
                </select>
              </label>
              <label style={{ fontSize: "12px", fontWeight: 700 }}>Parent Mobile (WhatsApp):
                <input value={newParentPhone} onChange={(e) => setNewParentPhone(e.target.value)} placeholder="+91 98765 00000" style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--line)" }} />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="outline" type="button" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
                <Button variant="brand" type="submit">Complete Enrollment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Importer Modal */}
      <CSVImporterModal
        isOpen={showCSVModal}
        onClose={() => setShowCSVModal(false)}
        title="Bulk Roster CSV Importer"
        subtitle="Import student rosters, roll numbers, and parent contacts in one click"
        columns={[
          { key: "rollNumber", label: "Roll Number", required: true },
          { key: "name", label: "Student Name", required: true },
          { key: "batchName", label: "Batch Name", required: true },
          { key: "targetExam", label: "Target Exam" },
          { key: "phone", label: "Student Phone" },
          { key: "parentPhone", label: "Parent WhatsApp", required: true },
        ]}
        sampleFileName="Apex_Student_Roster_Template.csv"
        sampleCSVData={sampleRosterCSV}
        onImportSuccess={handleCSVImportSuccess}
      />

      {/* WhatsApp / SMS Dispatcher Modal */}
      <WhatsAppDispatcherModal
        isOpen={showWhatsAppModal}
        onClose={() => {
          setShowWhatsAppModal(false);
          setSelectedStudent(null);
        }}
        recipients={
          selectedStudent
            ? [
                {
                  studentId: selectedStudent.id,
                  studentName: selectedStudent.name,
                  parentPhone: selectedStudent.parentPhone,
                  batchName: selectedStudent.batchName,
                  scoreOrDetail: `Avg Score: ${selectedStudent.averageScore}%`,
                },
              ]
            : filteredStudents.map((s) => ({
                studentId: s.id,
                studentName: s.name,
                parentPhone: s.parentPhone,
                batchName: s.batchName,
                scoreOrDetail: `Attendance: ${s.attendancePercentage}%`,
              }))
        }
        defaultTemplate="GENERAL_NOTICE"
      />
    </DashboardLayout>
  );
}
