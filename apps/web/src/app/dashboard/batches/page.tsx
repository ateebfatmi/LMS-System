"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getActiveOrganizationId, useActiveOrganizationId } from "@/lib/client-org";

export default function BatchesPage() {
  const activeOrganizationId = useActiveOrganizationId();
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchList, setBatchList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBatches() {
      try {
        setLoading(true);
        const orgId = getActiveOrganizationId();
        const url = orgId ? `/api/batches?organizationId=${encodeURIComponent(orgId)}` : "/api/batches";
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.batches && Array.isArray(data.batches)) {
            setBatchList(data.batches);
          }
        }
      } catch (err) {
        console.error("Failed to load real batches:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBatches();
  }, [activeOrganizationId]);

  // New batch form state
  const [newBatchName, setNewBatchName] = useState("");
  const [newTargetExam, setNewTargetExam] = useState("JEE_ADVANCED");
  const [newGradeLevel, setNewGradeLevel] = useState("Class 12");
  const [newRoom, setNewRoom] = useState("Hall 101");
  const [newFaculty, setNewFaculty] = useState("Er. Vivek Gupta");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredBatches = batchList.filter((b) => {
    const examMatch =
      selectedFilter === "ALL" ||
      b.targetExam === selectedFilter ||
      (selectedFilter === "JEE_MAIN" && (b.targetExam === "JEE" || b.targetExam === "JEE_MAIN")) ||
      (selectedFilter === "JEE_ADVANCED" && (b.targetExam === "JEE" || b.targetExam === "JEE_ADVANCED"));
    const searchMatch =
      !searchTerm.trim() ||
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.facultyName && b.facultyName.toLowerCase().includes(searchTerm.toLowerCase()));
    return examMatch && searchMatch;
  });

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    try {
      setIsSubmitting(true);
      const orgId = getActiveOrganizationId();
      const url = orgId ? `/api/batches?organizationId=${encodeURIComponent(orgId)}` : "/api/batches";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBatchName,
          targetExam: newTargetExam,
          gradeLevel: newGradeLevel,
          roomNumber: newRoom,
          facultyName: newFaculty,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBatchList([data.batch, ...batchList]);
        setShowCreateModal(false);
        setNewBatchName("");
      }
    } catch (err) {
      console.error("Failed to create batch:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Batches & Cohorts"
      subtitle="Manage your coaching batches, stream allocations, syllabus progress, and rooms"
      action={
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          ＋ Add New Batch
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Batches" value={String(batchList.length)} detail="Across active streams" accent="yellow" />
        <MetricCard label="Enrolled Students" value={String(batchList.reduce((acc, b) => acc + (b.studentCount || 0), 0))} detail="Active enrollments" accent="blue" />
        <MetricCard label="Avg. Syllabus Covered" value="No data" detail="On track for target exams" accent="green" />
        <MetricCard label="Active Classrooms" value={`${batchList.length || 0} Rooms`} detail="All smart boards active" accent="orange" />
      </div>

      <div className="filter-bar">
        <div className="tabs-bar" style={{ margin: 0, border: 0 }}>
          {["ALL", "JEE_ADVANCED", "JEE_MAIN", "NEET", "FOUNDATION"].map((exam) => (
            <button
              key={exam}
              onClick={() => setSelectedFilter(exam)}
              className={`tab-link ${selectedFilter === exam ? "active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              {exam === "ALL" ? "All Batches" : exam.replace("_", " ")}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter batches by name or faculty..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
          Loading batches from institute backend...
        </div>
      ) : filteredBatches.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            borderRadius: "12px",
            border: "1px dashed var(--line)",
          }}
        >
          <h3 style={{ fontSize: "16px", color: "#1e293b", margin: "0 0 6px" }}>No batches found</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            {selectedFilter === "ALL"
              ? "No coaching batches exist for this institute yet."
              : `No batches match the filter '${selectedFilter.replace("_", " ")}'.`}
          </p>
        </div>
      ) : (
        <div className="card-grid-2">
          {filteredBatches.map((batch) => (
            <div key={batch.id} className="batch-card" style={{ padding: "22px" }}>
              <header>
                <div>
                  <h3 style={{ fontSize: "18px" }}>{batch.name}</h3>
                  <p style={{ marginTop: "4px" }}>
                    Mentor: <strong>{batch.facultyName || "Assigned Faculty"}</strong> · {batch.gradeLevel} · {batch.roomNumber}
                  </p>
                </div>
                <Badge
                  variant={
                    batch.targetExam === "JEE_ADVANCED"
                      ? "purple"
                      : batch.targetExam === "NEET"
                      ? "success"
                      : "info"
                  }
                >
                  {(batch.targetExam || "JEE").replace("_", " ")}
                </Badge>
              </header>

              <div className="batch-stat-row" style={{ padding: "14px 0" }}>
                <div>
                  <span>Students</span>
                  <strong style={{ fontSize: "16px" }}>{batch.studentCount}</strong>
                </div>
                <div>
                  <span>Avg. Attendance</span>
                  <strong style={{ fontSize: "16px", color: "#1f8d61" }}>{batch.attendanceRate}%</strong>
                </div>
                <div>
                  <span>Syllabus Target</span>
                  <strong style={{ fontSize: "16px" }}>{batch.syllabusProgress}%</strong>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#68736d", marginBottom: "6px" }}>
                  <span>Curriculum & DPP Progress</span>
                  <span>{batch.syllabusProgress}% Complete</span>
                </div>
                <ProgressBar value={batch.syllabusProgress} variant={batch.syllabusProgress > 75 ? "success" : "default"} />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <Link href={`/dashboard/students?batchId=${batch.id}`} className="pz-button pz-button-secondary" style={{ flex: 1 }}>
                  View Roster
                </Link>
                <Link href={`/dashboard/attendance?batchId=${batch.id}`} className="pz-button pz-button-outline" style={{ flex: 1 }}>
                  Mark Attendance
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

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
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                Create New Coaching Batch
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBatch} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Batch Name (e.g. JEE 12C - Accelerate)
                </label>
                <input
                  type="text"
                  required
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="search-input"
                  style={{ width: "100%" }}
                  placeholder="e.g. JEE 12 Super 30"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Target Exam
                  </label>
                  <select
                    value={newTargetExam}
                    onChange={(e) => setNewTargetExam(e.target.value)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="JEE_ADVANCED">JEE Advanced</option>
                    <option value="JEE_MAIN">JEE Main</option>
                    <option value="NEET">NEET Medical</option>
                    <option value="FOUNDATION">Foundation / Olympiad</option>
                    <option value="BOARDS">Class 12 Boards</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Grade Level
                  </label>
                  <select
                    value={newGradeLevel}
                    onChange={(e) => setNewGradeLevel(e.target.value)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="Class 12">Class 12</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Dropper / Repeater">Dropper / Repeater</option>
                    <option value="Class 10">Class 10</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Room / Hall
                  </label>
                  <input
                    type="text"
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Lead Mentor / Faculty
                  </label>
                  <select
                    value={newFaculty}
                    onChange={(e) => setNewFaculty(e.target.value)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="Er. Vivek Gupta">Er. Vivek Gupta (Physics)</option>
                    <option value="Dr. Ananya Mehta">Dr. Ananya Mehta (Biology)</option>
                    <option value="Dr. Arvind Joshi">Dr. Arvind Joshi (Chemistry)</option>
                    <option value="Prof. Rajesh Sen">Prof. Rajesh Sen (Maths)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
