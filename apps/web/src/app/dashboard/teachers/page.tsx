"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockTeachers } from "@/lib/mock-data";

interface TimetableSlot {
  day: string;
  time: string;
  batch: string;
  subject: string;
  room: string;
}

const mockTimetables: Record<string, TimetableSlot[]> = {
  "tch-1": [
    { day: "Monday", time: "09:00 AM - 10:30 AM", batch: "JEE 12A - Titans", subject: "Electrostatics & Gauss Law", room: "Room 101" },
    { day: "Monday", time: "11:00 AM - 12:30 PM", batch: "JEE 11B - Nucleus", subject: "Kinematics & Projectiles", room: "Room 104" },
    { day: "Tuesday", time: "09:00 AM - 10:30 AM", batch: "JEE 12A - Titans", subject: "Current Electricity & Kirchoff", room: "Room 101" },
    { day: "Wednesday", time: "02:00 PM - 03:30 PM", batch: "Foundation 10 - Olympiad", subject: "Light & Ray Optics", room: "Room 202" },
    { day: "Thursday", time: "09:00 AM - 10:30 AM", batch: "JEE 12A - Titans", subject: "Capacitance & Dielectrics", room: "Room 101" },
    { day: "Friday", time: "11:00 AM - 12:30 PM", batch: "JEE 11B - Nucleus", subject: "Newton's Laws of Motion", room: "Room 104" },
  ],
  "tch-2": [
    { day: "Monday", time: "09:00 AM - 10:30 AM", batch: "NEET 12 - Medics", subject: "Genetics & Molecular Biology", room: "Room 201" },
    { day: "Tuesday", time: "11:00 AM - 12:30 PM", batch: "NEET 12 - Medics", subject: "Human Endocrine System", room: "Room 201" },
    { day: "Thursday", time: "09:00 AM - 10:30 AM", batch: "NEET 12 - Medics", subject: "Ecology & Biomolecules", room: "Room 201" },
  ],
  "tch-3": [
    { day: "Monday", time: "11:00 AM - 12:30 PM", batch: "JEE 12A - Titans", subject: "Definite Integrals & Area", room: "Room 101" },
    { day: "Wednesday", time: "09:00 AM - 10:30 AM", batch: "JEE 11B - Nucleus", subject: "Quadratic Equations", room: "Room 104" },
    { day: "Friday", time: "09:00 AM - 10:30 AM", batch: "JEE 12A - Titans", subject: "Differential Equations", room: "Room 101" },
  ],
  "tch-4": [
    { day: "Tuesday", time: "09:00 AM - 10:30 AM", batch: "JEE 11B - Nucleus", subject: "Chemical Bonding & MOT", room: "Room 104" },
    { day: "Thursday", time: "11:00 AM - 12:30 PM", batch: "NEET 12 - Medics", subject: "Aldehydes & Ketones Mechanism", room: "Room 201" },
  ],
};

const allBatches = [
  "JEE 12A - Titans",
  "JEE 11B - Nucleus",
  "NEET 12 - Medics",
  "Foundation 10 - Olympiad",
  "JEE Droppers - Rankers",
];

export default function TeachersPage() {
  const [teachers, setTeachers] = useState(mockTeachers);

  // Modals & toast state
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [timetableTeacher, setTimetableTeacher] = useState<(typeof mockTeachers)[0] | null>(null);
  const [assignBatchTeacher, setAssignBatchTeacher] = useState<(typeof mockTeachers)[0] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Faculty Form State
  const [newFacultyName, setNewFacultyName] = useState("");
  const [newSubject, setNewSubject] = useState("Physics");
  const [newQualification, setNewQualification] = useState("");
  const [newWeeklyHours, setNewWeeklyHours] = useState("16");

  // Assign Batch State
  const [batchToAssign, setBatchToAssign] = useState(allBatches[0]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacultyName.trim()) return;

    const newTeacher = {
      id: `tch-${Date.now()}`,
      name: newFacultyName,
      subject: newSubject,
      qualification: newQualification || "M.Sc. / B.Tech, 6+ yrs Coaching Exp",
      batches: ["JEE 12A - Titans"],
      totalStudents: 45,
      classesPerWeek: Number(newWeeklyHours) || 16,
    };

    setTeachers([newTeacher, ...teachers]);
    setShowAddFacultyModal(false);
    setNewFacultyName("");
    setNewQualification("");
    triggerToast(`Faculty member "${newTeacher.name}" added to coaching roster!`);
  };

  const handleAssignBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignBatchTeacher) return;

    if (assignBatchTeacher.batches.includes(batchToAssign)) {
      triggerToast(`${assignBatchTeacher.name} is already assigned to ${batchToAssign}!`);
      setAssignBatchTeacher(null);
      return;
    }

    setTeachers((prev) =>
      prev.map((t) =>
        t.id === assignBatchTeacher.id
          ? {
              ...t,
              batches: [...t.batches, batchToAssign],
              totalStudents: t.totalStudents + 35,
              classesPerWeek: t.classesPerWeek + 4,
            }
          : t
      )
    );

    triggerToast(`Assigned ${batchToAssign} to ${assignBatchTeacher.name}!`);
    setAssignBatchTeacher(null);
  };

  const totalClasses = teachers.reduce((acc, t) => acc + t.classesPerWeek, 0);

  return (
    <DashboardLayout
      title="Teaching Faculty & Mentors"
      subtitle="Manage your coaching faculty roster, subject specializations, and batch assignments"
      action={
        <Button variant="primary" onClick={() => setShowAddFacultyModal(true)}>
          ＋ Add Faculty Member
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
        <MetricCard label="Total Faculty" value={String(teachers.length)} detail="Full-time & Senior Mentors" accent="yellow" />
        <MetricCard label="Lectures This Week" value={`${totalClasses} hrs`} detail="Across 4 academic blocks" accent="blue" />
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
              <Badge variant={teacher.subject === "Physics" ? "purple" : teacher.subject === "Biology" ? "success" : "info"} size="sm">
                Faculty
              </Badge>
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

            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <Button
                variant="secondary"
                style={{ flex: 1, fontSize: "12px" }}
                onClick={() => setTimetableTeacher(teacher)}
              >
                📅 View Timetable
              </Button>
              <Button
                variant="outline"
                style={{ flex: 1, fontSize: "12px" }}
                onClick={() => setAssignBatchTeacher(teacher)}
              >
                ＋ Assign Batch
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* View Timetable Modal */}
      {timetableTeacher && (
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
            width: "600px",
            maxWidth: "92vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                  Weekly Lecture Schedule
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#68736d" }}>
                  {timetableTeacher.name} · {timetableTeacher.subject}
                </p>
              </div>
              <Badge variant="purple" size="sm">{timetableTeacher.classesPerWeek} hrs / week</Badge>
            </div>

            <div style={{ marginTop: "14px", maxHeight: "350px", overflowY: "auto" }}>
              {mockTimetables[timetableTeacher.id]?.length ? (
                <div style={{ display: "grid", gap: "10px" }}>
                  {mockTimetables[timetableTeacher.id].map((slot, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        border: "1px solid var(--line)",
                        borderRadius: "8px",
                        background: "#fafbfa",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 700, fontSize: "12px", color: "var(--brand-dark)" }}>
                            {slot.day}
                          </span>
                          <span style={{ fontSize: "12px", color: "#68736d" }}>· {slot.time}</span>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{slot.subject}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Badge variant="neutral" size="sm">{slot.batch}</Badge>
                        <div style={{ fontSize: "11px", color: "#68736d", marginTop: "4px" }}>{slot.room}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", color: "#68736d" }}>
                  <p>Standard weekly schedule: Monday to Friday 09:00 AM - 12:30 PM.</p>
                  <p style={{ fontSize: "12px" }}>Assigned across: {timetableTeacher.batches.join(", ")}</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "18px" }}>
              <Button variant="primary" onClick={() => setTimetableTeacher(null)}>
                Close Schedule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Batch Modal */}
      {assignBatchTeacher && (
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
            width: "460px",
            maxWidth: "92vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Assign Batch to {assignBatchTeacher.name}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#68736d" }}>
              Allocate an additional batch to this mentor&apos;s teaching workload.
            </p>

            <form onSubmit={handleAssignBatch} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Select Coaching Batch
                </label>
                <select
                  value={batchToAssign}
                  onChange={(e) => setBatchToAssign(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                >
                  {allBatches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: "#f8faf9", padding: "12px", borderRadius: "8px", fontSize: "12px", color: "#555" }}>
                Current Batches: <strong>{assignBatchTeacher.batches.join(", ")}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="secondary" onClick={() => setAssignBatchTeacher(null)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Confirm Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Member Modal */}
      {showAddFacultyModal && (
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
              Add New Coaching Faculty
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#68736d" }}>
              Register mentor profile, subject expertise, and qualifications.
            </p>

            <form onSubmit={handleAddFaculty} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Faculty Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Hitesh Bhattacharya"
                  value={newFacultyName}
                  onChange={(e) => setNewFacultyName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Subject Specialization</label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Weekly Teaching Target</label>
                  <input
                    type="number"
                    value={newWeeklyHours}
                    onChange={(e) => setNewWeeklyHours(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Qualification & Experience</label>
                <input
                  type="text"
                  placeholder="e.g. M.Sc (IIT Kanpur), Ex-Allen, 8+ yrs teaching"
                  value={newQualification}
                  onChange={(e) => setNewQualification(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button variant="secondary" onClick={() => setShowAddFacultyModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Faculty Member
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

