"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, type AppRole } from "@/components/dashboard-layout";
import { mockBatches, mockTests } from "@/lib/mock-data";

function OverviewContent() {
  const searchParams = useSearchParams();
  const currentRole = (searchParams?.get("role") as AppRole) || "DIRECTOR";

  return (
    <DashboardLayout
      title={
        currentRole === "STUDENT"
          ? "Welcome back, Aarav! 🎯"
          : currentRole === "PARENT"
          ? "Parent Portal: Aarav Sharma"
          : currentRole === "FACULTY"
          ? "Faculty Workspace: Er. Vivek Gupta"
          : "Good morning, Director Ateeb"
      }
      subtitle={
        currentRole === "STUDENT"
          ? "JEE 12A - Titans · Target: JEE Advanced 2027 · Roll: APX-2026-1201"
          : currentRole === "PARENT"
          ? "Apex JEE & NEET Academy · Class 12 JEE Advanced · Batch: Titans"
          : currentRole === "FACULTY"
          ? "Senior Physics Faculty · 16 Lectures/Week · 129 Total Students"
          : "Apex JEE & NEET Academy · North Campus · Academic Year 2026–27"
      }
      currentRole={currentRole}
    >
      {/* --- STUDENT ROLE VIEW --- */}
      {currentRole === "STUDENT" && (
        <>
          <div className="metrics-grid">
            <MetricCard label="Projected Rank" value="AIR 1,240" detail="98.5 percentile in recent mock" accent="yellow" />
            <MetricCard label="Overall Avg Score" value="88.4%" detail="Top 2% in batch" accent="green" />
            <MetricCard label="My Attendance" value="97.5%" detail="42 days present" accent="navy" />
            <MetricCard label="Pending DPPs" value="3 Sheets" detail="Due by Sunday 8:00 PM" accent="orange" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="Upcoming PrepZii CBT Mock Tests"
              action={<Link href="/dashboard/assessments" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>View test series →</Link>}
            >
              <div style={{ padding: "16px", border: "1px solid var(--line)", borderRadius: "12px", background: "#fffdf2", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <strong style={{ fontSize: "15px", fontFamily: "var(--font-display)" }}>
                    All India PrepZii Mock 05: JEE Advanced Paper 1
                  </strong>
                  <Badge variant="brand" size="sm">LIVE IN 2 DAYS</Badge>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--muted)" }}>
                  Pattern: JEE Advanced (54 Questions · 180 Marks · 180 Mins) · Partial marking enabled
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Link href="/dashboard/assessments" className="pz-button pz-button-primary" style={{ fontSize: "12px" }}>
                    🚀 Open CBT Exam Simulator
                  </Link>
                  <button className="pz-button pz-button-outline" style={{ fontSize: "12px" }}>
                    Download Syllabus & Pattern
                  </button>
                </div>
              </div>

              <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>Chapter Test: Rotational Mechanics & Inertia</strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>Completed yesterday · Score: 42/50 (84%)</div>
                  </div>
                  <Badge variant="success" size="sm">Evaluated</Badge>
                </div>
              </div>
            </Panel>

            <Panel title="Weak Chapter Analytics (PrepZii Engine)">
              <div style={{ display: "grid", gap: "14px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span><strong>Physics:</strong> Rotational Motion & Torque</span>
                    <span style={{ color: "#b91c1c", fontWeight: 700 }}>54% Accuracy (Focus Needed)</span>
                  </div>
                  <ProgressBar value={54} variant="warning" />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span><strong>Chemistry:</strong> Organic Reaction Mechanisms</span>
                    <span style={{ color: "#b45309", fontWeight: 700 }}>64% Accuracy</span>
                  </div>
                  <ProgressBar value={64} variant="warning" />
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span><strong>Maths:</strong> Definite Integration & Area</span>
                    <span style={{ color: "#047857", fontWeight: 700 }}>88% Accuracy (Strong)</span>
                  </div>
                  <ProgressBar value={88} variant="success" />
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* --- PARENT ROLE VIEW --- */}
      {currentRole === "PARENT" && (
        <>
          <div className="metrics-grid">
            <MetricCard label="Monthly Attendance" value="97.5%" detail="42 Present / 1 Absent" accent="green" />
            <MetricCard label="Recent Mock Rank" value="#2 in Batch" detail="Score: 156 / 180" accent="yellow" />
            <MetricCard label="Term Fee Status" value="Paid (Q3)" detail="Next due: Dec 2026" accent="navy" />
            <MetricCard label="Faculty Feedback" value="Top Performer" detail="Consistent dedication" accent="blue" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="Recent Mock Test Report Cards"
              action={<Button variant="outline" style={{ fontSize: "11px" }}>📥 Download PTM Report PDF</Button>}
            >
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "10px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <strong>All India PrepZii Mock 04 (JEE Advanced)</strong>
                    <Badge variant="brand" size="sm">Rank #2</Badge>
                  </div>
                  <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "var(--muted)" }}>
                    <span>Marks: <strong>156/180</strong></span>
                    <span>Percentile: <strong>98.5%ile</strong></span>
                    <span>Accuracy: <strong>86.6%</strong></span>
                  </div>
                </div>
                <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <strong>Physics Unit Test: Electrostatics</strong>
                    <Badge variant="success" size="sm">Rank #1</Badge>
                  </div>
                  <div style={{ display: "flex", gap: "20px", fontSize: "12px", color: "var(--muted)" }}>
                    <span>Marks: <strong>92/100</strong></span>
                    <span>Percentile: <strong>99.1%ile</strong></span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Educator Contact & Mentors">
              <div style={{ display: "grid", gap: "12px" }}>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>Er. Vivek Gupta</strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>Physics Senior Faculty & Mentor</div>
                  </div>
                  <Button variant="secondary" style={{ fontSize: "11px" }}>📞 Call Mentor</Button>
                </div>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "13px" }}>Dr. Arvind Joshi</strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>Chemistry Head</div>
                  </div>
                  <Button variant="secondary" style={{ fontSize: "11px" }}>💬 WhatsApp</Button>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* --- FACULTY ROLE VIEW --- */}
      {currentRole === "FACULTY" && (
        <>
          <div className="metrics-grid">
            <MetricCard label="Today's Lectures" value="3 Sessions" detail="Hall 204 & Room 102" accent="yellow" />
            <MetricCard label="Total Students" value="129" detail="JEE 12A & JEE 11B" accent="navy" />
            <MetricCard label="Avg Attendance" value="94.2%" detail="On track this week" accent="green" />
            <MetricCard label="DPPs Uploaded" value="18 Sheets" detail="All solutions published" accent="blue" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="My Lecture Schedule Today"
              action={<Link href="/dashboard/attendance" className="pz-button pz-button-primary" style={{ fontSize: "11px" }}>Mark Attendance →</Link>}
            >
              <div className="class-list">
                <div>
                  <time>09:00 AM</time>
                  <span className="class-line yellow" />
                  <p>
                    <strong>Electrostatics & Gauss Law</strong>
                    <small>JEE 12A Titans · Hall 204 (68 students)</small>
                  </p>
                  <Badge variant="success" size="sm">Live Now</Badge>
                </div>
                <div>
                  <time>02:30 PM</time>
                  <span className="class-line blue" />
                  <p>
                    <strong>Capacitance & Dielectrics</strong>
                    <small>JEE 11B Nucleus · Room 102 (61 students)</small>
                  </p>
                  <Badge variant="info" size="sm">Upcoming</Badge>
                </div>
              </div>
            </Panel>

            <Panel title="Pending Evaluated Mock Tests">
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <strong style={{ fontSize: "13px" }}>JEE Advanced Mock 04: Physics Paper 1</strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>68 / 68 Evaluated · Avg score: 64.2%</div>
                </div>
                <Link href="/dashboard/assessments" className="pz-button pz-button-secondary" style={{ fontSize: "12px", textAlign: "center" }}>
                  ＋ Create New DPP / Test Sheet
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}

      {/* --- DIRECTOR ROLE VIEW (DEFAULT) --- */}
      {currentRole === "DIRECTOR" && (
        <>
          <div className="metrics-grid">
            <MetricCard label="Active Students" value="1,248" detail={<><b>↑ 6.4%</b> this intake</>} accent="yellow" />
            <MetricCard label="Teaching Faculty" value="42" detail="38 lectures today" accent="navy" />
            <MetricCard label="Average Attendance" value="92.4%" detail={<><b>↑ 2.1%</b> this week</>} accent="green" />
            <MetricCard label="Tests Scheduled" value="18" detail="4 ongoing today" accent="blue" />
          </div>

          <div className="dashboard-grid">
            <Panel
              title="Today's Timetable & Classes"
              action={<Link href="/dashboard/batches" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>Manage batches →</Link>}
            >
              <div className="class-list">
                <div>
                  <time>09:00 AM</time>
                  <span className="class-line yellow" />
                  <p>
                    <strong>Electrostatics & Gauss Law</strong>
                    <small>JEE 12A · Hall 204 · Er. Vivek Gupta (68 students)</small>
                  </p>
                  <Badge variant="success" size="sm">Live Now</Badge>
                </div>
                <div>
                  <time>11:30 AM</time>
                  <span className="class-line blue" />
                  <p>
                    <strong>Plant Physiology & Photosynthesis</strong>
                    <small>NEET 12 · Lab 1 · Dr. Ananya Mehta (54 students)</small>
                  </p>
                  <Badge variant="info" size="sm">In 1h 20m</Badge>
                </div>
                <div>
                  <time>02:30 PM</time>
                  <span className="class-line orange" />
                  <p>
                    <strong>Application of Derivatives & Tangents</strong>
                    <small>JEE 11B · Room 102 · Prof. Rajesh Sen (61 students)</small>
                  </p>
                  <Badge variant="neutral" size="sm">In 4h 15m</Badge>
                </div>
              </div>
            </Panel>

            <Panel
              title="Attendance Pulse"
              action={<Link href="/dashboard/attendance" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>Mark attendance →</Link>}
            >
              <div className="attendance-wrap">
                <div className="attendance-ring">
                  <strong>92.4%</strong>
                  <span>Today</span>
                </div>
                <div className="attendance-bars">
                  {[93, 89, 94, 92, 90, 96, 92].map((value, index) => (
                    <div key={index}>
                      <span style={{ height: `${value - 35}%` }} />
                      <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel
              title="Live & Upcoming PrepZii Tests & PYQs"
              action={<Link href="/dashboard/assessments" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>All assessments →</Link>}
            >
              <div style={{ display: "grid", gap: "12px" }}>
                {mockTests.slice(0, 2).map((test) => (
                  <div key={test.id} style={{ padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px" }}>{test.title}</strong>
                      <Badge variant={test.pattern === "JEE_ADVANCED" ? "brand" : "info"} size="sm">
                        {test.pattern}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "12px" }}>
                      <span>{test.questionCount} Questions · {test.totalMarks} Marks</span>
                      <span>{test.totalSubmissions} Submissions (Avg {test.avgScorePercent}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Action Required & Alerts">
              <div className="attention-list">
                <Link href="/dashboard/attendance">
                  <span className="attention-icon amber">!</span>
                  <p>
                    <strong>3 Batches awaiting attendance submission</strong>
                    <small>Class 11 batches before 12:00 PM cutoff</small>
                  </p>
                  <b>→</b>
                </Link>
                <Link href="/dashboard/assessments">
                  <span className="attention-icon red">!</span>
                  <p>
                    <strong>14 Students scored below 50% in JEE Mock</strong>
                    <small>PrepZii revision engine recommends targeted DPP</small>
                  </p>
                  <b>→</b>
                </Link>
                <Link href="/dashboard/batches">
                  <span className="attention-icon blue">i</span>
                  <p>
                    <strong>Syllabus milestone: Physics Mechanics completed</strong>
                    <small>Batch JEE 12A reached 78% syllabus</small>
                  </p>
                  <b>→</b>
                </Link>
              </div>
            </Panel>
          </div>

          <div style={{ marginTop: "20px" }}>
            <Panel
              title="Active Batches Status"
              action={<Link href="/dashboard/batches" className="text-link" style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 700 }}>View all batches →</Link>}
            >
              <div className="card-grid-3" style={{ margin: 0 }}>
                {mockBatches.slice(0, 3).map((batch) => (
                  <div key={batch.id} className="batch-card">
                    <header>
                      <div>
                        <h3>{batch.name}</h3>
                        <p>{batch.facultyName} · {batch.roomNumber}</p>
                      </div>
                      <Badge variant="brand" size="sm">{batch.targetExam.replace("_", " ")}</Badge>
                    </header>

                    <div className="batch-stat-row">
                      <div>
                        <span>Students</span>
                        <strong>{batch.studentCount}</strong>
                      </div>
                      <div>
                        <span>Attendance</span>
                        <strong style={{ color: "var(--green)" }}>{batch.attendanceRate}%</strong>
                      </div>
                      <div>
                        <span>Syllabus</span>
                        <strong>{batch.syllabusProgress}%</strong>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--muted)", marginBottom: "5px" }}>
                        <span>Course Progress</span>
                        <span>{batch.syllabusProgress}% Completed</span>
                      </div>
                      <ProgressBar value={batch.syllabusProgress} variant="brand" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading overview...</div>}>
      <OverviewContent />
    </Suspense>
  );
}
