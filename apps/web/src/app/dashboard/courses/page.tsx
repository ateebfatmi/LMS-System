"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockCourses } from "@/lib/mock-data";

export default function CoursesPage() {
  const [courses] = useState(mockCourses);
  const [selectedCourse, setSelectedCourse] = useState(mockCourses[0]);

  return (
    <DashboardLayout
      title="Courses, Curriculum & DPPs"
      subtitle="Organize chapter-wise modules, lecture recordings, PDF study material, and Daily Practice Problems"
      action={
        <Button variant="primary">
          ＋ Create Course
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Active Courses" value="24" detail="All subjects covered" accent="yellow" />
        <MetricCard label="Total Video Lectures" value="384" detail="Recorded & Live archive" accent="blue" />
        <MetricCard label="Daily Practice Sheets" value="142 DPPs" detail="With step-by-step solutions" accent="green" />
        <MetricCard label="Resource Downloads" value="18.4k" detail="By students this month" accent="orange" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "18px", marginTop: "10px" }}>
        {/* Course List */}
        <div style={{ display: "grid", gap: "12px", height: "fit-content" }}>
          {courses.map((course) => (
            <div
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              style={{
                padding: "18px",
                background: "white",
                border: selectedCourse.id === course.id ? "2px solid var(--brand-hover)" : "1px solid var(--line)",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all .15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <Badge variant={course.subjectName === "Physics" ? "purple" : course.subjectName === "Biology" ? "success" : "info"} size="sm">
                  {course.subjectName}
                </Badge>
                <span style={{ fontSize: "11px", color: "#68736d" }}>{course.status}</span>
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontFamily: "var(--font-display)" }}>
                {course.title}
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#68736d", lineHeight: 1.5 }}>
                {course.description}
              </p>
              <div style={{ display: "flex", gap: "14px", marginTop: "12px", fontSize: "11px", color: "#555" }}>
                <span>📁 {course.moduleCount} Modules</span>
                <span>🎬 {course.lessonCount} Lectures</span>
                <span>📝 {course.dppCount} DPPs</span>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Course Modules & DPPs View */}
        <div>
          <Panel
            title={selectedCourse.title}
            subtitle={`Instructor: ${selectedCourse.teacherName} · ${selectedCourse.subjectName}`}
            action={
              <Button variant="secondary" style={{ fontSize: "12px" }}>
                ＋ Add Module / DPP
              </Button>
            }
          >
            <div style={{ display: "grid", gap: "14px", marginTop: "10px" }}>
              <div style={{ border: "1px solid #edf0ed", borderRadius: "10px", padding: "14px", background: "#fbfcfb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "14px" }}>Module 1: Electric Charges & Coulomb&apos;s Law</strong>
                  <Badge variant="purple" size="sm">4 Lectures · 2 DPPs</Badge>
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "6px", border: "1px solid #edf0ed" }}>
                    <span style={{ fontSize: "13px" }}>🎬 Lecture 01: Quantization & Vector Form of Coulomb&apos;s Force</span>
                    <span style={{ fontSize: "11px", color: "#68736d" }}>54 mins</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "6px", border: "1px solid #edf0ed" }}>
                    <span style={{ fontSize: "13px" }}>📝 DPP #01: Advanced Coulomb&apos;s Law & Superposition (15 MCQs)</span>
                    <Button variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Download PDF</Button>
                  </div>
                </div>
              </div>

              <div style={{ border: "1px solid #edf0ed", borderRadius: "10px", padding: "14px", background: "#fbfcfb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "14px" }}>Module 2: Electric Field & Gauss&apos;s Flux Theorem</strong>
                  <Badge variant="purple" size="sm">6 Lectures · 3 DPPs</Badge>
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "6px", border: "1px solid #edf0ed" }}>
                    <span style={{ fontSize: "13px" }}>🎬 Lecture 02: Flux Calculation through Curved Surfaces & Shells</span>
                    <span style={{ fontSize: "11px", color: "#68736d" }}>62 mins</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "6px", border: "1px solid #edf0ed" }}>
                    <span style={{ fontSize: "13px" }}>📝 DPP #02: Symmetric Charge Distributions & Gauss Law Problems</span>
                    <Button variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Download PDF</Button>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "white", borderRadius: "6px", border: "1px solid #edf0ed" }}>
                    <span style={{ fontSize: "13px" }}>📄 Handwritten Formula Sheet & Summary Notes (PDF)</span>
                    <Button variant="secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>View Notes</Button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}
