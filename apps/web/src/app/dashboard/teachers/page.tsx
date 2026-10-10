"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockTeachers } from "@/lib/mock-data";

export default function TeachersPage() {
  const [teachers] = useState(mockTeachers);

  return (
    <DashboardLayout
      title="Teaching Faculty & Mentors"
      subtitle="Manage your coaching faculty roster, subject specializations, and batch assignments"
      action={
        <Button variant="primary">
          ＋ Add Faculty Member
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Faculty" value="42" detail="Full-time & Senior Mentors" accent="yellow" />
        <MetricCard label="Lectures This Week" value="168" detail="Across 4 academic blocks" accent="blue" />
        <MetricCard label="Student-Faculty Ratio" value="28:1" detail="Optimal coaching standard" accent="green" />
        <MetricCard label="Avg. Faculty Rating" value="4.88 / 5" detail="From student weekly polls" accent="orange" />
      </div>

      <div className="card-grid-2">
        {teachers.map((teacher) => (
          <div key={teacher.id} className="batch-card" style={{ padding: "22px" }}>
            <header>
              <div>
                <h3 style={{ fontSize: "17px" }}>{teacher.name}</h3>
                <p style={{ marginTop: "4px", color: "var(--brand-navy)", fontWeight: 600 }}>
                  {teacher.subject}
                </p>
                <p style={{ fontSize: "12px", color: "#68736d", marginTop: "2px" }}>
                  {teacher.qualification}
                </p>
              </div>
              <Badge variant="purple" size="sm">Faculty</Badge>
            </header>

            <div className="batch-stat-row" style={{ padding: "12px 0" }}>
              <div>
                <span>Students Taught</span>
                <strong style={{ fontSize: "15px" }}>{teacher.totalStudents}</strong>
              </div>
              <div>
                <span>Classes / Week</span>
                <strong style={{ fontSize: "15px", color: "#4476db" }}>{teacher.classesPerWeek} hrs</strong>
              </div>
              <div>
                <span>Batches Assigned</span>
                <strong style={{ fontSize: "15px" }}>{teacher.batches.length}</strong>
              </div>
            </div>

            <div>
              <span style={{ display: "block", fontSize: "11px", color: "#68736d", marginBottom: "6px" }}>
                Assigned Coaching Batches:
              </span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {teacher.batches.map((batch) => (
                  <Badge key={batch} variant="neutral" size="sm">
                    {batch}
                  </Badge>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <Button variant="secondary" style={{ flex: 1, fontSize: "12px" }}>
                View Timetable
              </Button>
              <Button variant="outline" style={{ flex: 1, fontSize: "12px" }}>
                Assign Batch
              </Button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
