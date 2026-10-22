"use client";

import { useState, useEffect } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { StudentRecord } from "@/lib/mock-data";
import { getActiveOrganizationId, useActiveOrganizationId } from "@/lib/client-org";

export default function StudentsPage() {
  const activeOrganizationId = useActiveOrganizationId();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("ALL");
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentsAndBatches() {
      try {
        setLoading(true);
        const orgId = getActiveOrganizationId();
        const orgParam = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : "";
        const [resStudents, resBatches] = await Promise.allSettled([
          fetch(`/api/students${orgParam}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/batches${orgParam}`).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (resStudents.status === "fulfilled" && resStudents.value?.students) {
          setStudents(resStudents.value.students);
        }
        if (resBatches.status === "fulfilled" && resBatches.value?.batches) {
          setBatches(resBatches.value.batches);
        }
      } catch (err) {
        console.error("Failed to load real students or batches:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStudentsAndBatches();
  }, [activeOrganizationId]);

  // Enroll Student Modal State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBatchId, setNewBatchId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newParentPhone, setNewParentPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBatch =
      selectedBatch === "ALL" ||
      student.batchId === selectedBatch ||
      student.batchName.toLowerCase().includes(selectedBatch.toLowerCase());
    return matchesSearch && matchesBatch;
  });

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    try {
      setIsSubmitting(true);
      const orgId = getActiveOrganizationId();
      const url = orgId ? `/api/students?organizationId=${encodeURIComponent(orgId)}` : "/api/students";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          batchId: newBatchId || batches[0]?.id,
          phone: newPhone,
          parentPhone: newParentPhone || newPhone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStudents([data.student, ...students]);
        setShowEnrollModal(false);
        setNewName("");
        setNewPhone("");
        setNewParentPhone("");
      }
    } catch (err) {
      console.error("Failed to enroll student:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Student Directory & Roster"
      subtitle="Track enrollments, attendance percentages, test performance, and parent communications"
      action={
        <Button variant="primary" onClick={() => setShowEnrollModal(true)}>
          ＋ Enroll Student
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Enrolled" value={String(students.length)} detail="Current roster" accent="yellow" />
        <MetricCard label="Batch Retention" value="No data" detail="Term renewal" accent="green" />
        <MetricCard label="Top Performers (>90%)" value={String(students.filter((s) => s.averageScore > 90).length)} detail="JEE & NEET rankers" accent="blue" />
        <MetricCard label="Active Batches" value={String(batches.length)} detail="Assigned cohorts" accent="orange" />
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
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({(b.targetExam || "JEE").replace("_", " ")})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary">Export CSV</Button>
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
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
                  Loading enrolled students from institute backend...
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
                  No enrolled students found. When students are enrolled or join via batch codes, their records will display here.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Student Profile Drawer */}
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

            <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "13px" }}>Parent / Guardian Contact</h4>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span>Primary Contact Phone:</span>
                <strong>{selectedStudent.parentPhone}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "28px",
              borderRadius: "16px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                Enroll New Student
              </h2>
              <button
                onClick={() => setShowEnrollModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Student Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="search-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. Diya Nambiar"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Target Batch Allocation
                </label>
                <select
                  value={newBatchId}
                  onChange={(e) => setNewBatchId(e.target.value)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({(b.targetExam || "JEE").replace("_", " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Student Mobile Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="+91 98765 00000"
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Parent Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                    placeholder="+91 98765 11111"
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <Button type="button" variant="secondary" onClick={() => setShowEnrollModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Enrolling..." : "Complete Enrollment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
