"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockBatches } from "@/lib/mock-data";
import type { TargetExam } from "@prepzii/contracts";

export default function BatchesPage() {
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [batchList, setBatchList] = useState(mockBatches);

  // New batch form state
  const [newBatchName, setNewBatchName] = useState("");
  const [newTargetExam, setNewTargetExam] = useState<TargetExam>("JEE_ADVANCED");
  const [newGradeLevel, setNewGradeLevel] = useState("Class 12");
  const [newRoom, setNewRoom] = useState("Hall 101");
  const [newFaculty, setNewFaculty] = useState("Er. Vivek Gupta");

  const filteredBatches = batchList.filter((b) => {
    const matchesFilter = selectedFilter === "ALL" || b.targetExam === selectedFilter;
    const matchesSearch =
      b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.roomNumber && b.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    const created = {
      id: `batch-${Date.now()}`,
      organizationId: "org-1",
      name: newBatchName,
      targetExam: newTargetExam,
      gradeLevel: newGradeLevel,
      roomNumber: newRoom,
      studentCount: 0,
      facultyName: newFaculty,
      attendanceRate: 100,
      syllabusProgress: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setBatchList([created, ...batchList]);
    setShowCreateModal(false);
    setNewBatchName("");
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
        <MetricCard label="Total Batches" value={String(batchList.length)} detail="Across 4 academic streams" accent="yellow" />
        <MetricCard label="Enrolled Students" value={String(batchList.reduce((acc, b) => acc + b.studentCount, 0))} detail="North Campus total" accent="blue" />
        <MetricCard label="Avg. Syllabus Covered" value="72.0%" detail="On track for target exams" accent="green" />
        <MetricCard label="Active Classrooms" value="8 Rooms" detail="All smart boards active" accent="orange" />
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
          placeholder="Filter batches by name, room, or faculty..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="card-grid-2">
        {filteredBatches.map((batch) => (
          <div key={batch.id} className="batch-card" style={{ padding: "22px" }}>
            <header>
              <div>
                <h3 style={{ fontSize: "18px" }}>{batch.name}</h3>
                <p style={{ marginTop: "4px" }}>
                  Mentor: <strong>{batch.facultyName}</strong> · {batch.gradeLevel} · {batch.roomNumber}
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
                {batch.targetExam.replace("_", " ")}
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
                    onChange={(e) => setNewTargetExam(e.target.value as TargetExam)}
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
                <Button type="submit" variant="primary">
                  Create Batch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
