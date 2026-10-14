"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockCourses } from "@/lib/mock-data";

interface ModuleItem {
  id: string;
  type: "LECTURE" | "DPP" | "NOTES";
  title: string;
  durationOrQuestions?: string;
  pdfUrl?: string;
}

interface CourseModule {
  id: string;
  title: string;
  badge: string;
  items: ModuleItem[];
}

const defaultModules: Record<string, CourseModule[]> = {
  "course-1": [
    {
      id: "mod-1",
      title: "Module 1: Electric Charges & Coulomb's Law",
      badge: "4 Lectures · 2 DPPs",
      items: [
        { id: "item-1", type: "LECTURE", title: "Lecture 01: Quantization & Vector Form of Coulomb's Force", durationOrQuestions: "54 mins" },
        { id: "item-2", type: "DPP", title: "DPP #01: Advanced Coulomb's Law & Superposition (15 MCQs)", durationOrQuestions: "15 MCQs" },
      ],
    },
    {
      id: "mod-2",
      title: "Module 2: Electric Field & Gauss's Flux Theorem",
      badge: "6 Lectures · 3 DPPs",
      items: [
        { id: "item-3", type: "LECTURE", title: "Lecture 02: Flux Calculation through Curved Surfaces & Shells", durationOrQuestions: "62 mins" },
        { id: "item-4", type: "DPP", title: "DPP #02: Symmetric Charge Distributions & Gauss Law Problems", durationOrQuestions: "20 MCQs" },
        { id: "item-5", type: "NOTES", title: "Handwritten Formula Sheet & Summary Notes (PDF)", durationOrQuestions: "12 pages" },
      ],
    },
  ],
  "course-2": [
    {
      id: "mod-3",
      title: "Module 1: Limits & Continuity Fundamentals",
      badge: "5 Lectures · 3 DPPs",
      items: [
        { id: "item-6", type: "LECTURE", title: "Lecture 01: L'Hôpital's Rule & Standard Limits", durationOrQuestions: "65 mins" },
        { id: "item-7", type: "DPP", title: "DPP #01: Evaluation of Indeterminate Forms (20 MCQs)", durationOrQuestions: "20 MCQs" },
      ],
    },
  ],
  "course-3": [
    {
      id: "mod-4",
      title: "Module 1: Chemical Bonding & Molecular Orbital Theory",
      badge: "4 Lectures · 2 DPPs",
      items: [
        { id: "item-8", type: "LECTURE", title: "Lecture 01: Hybridization & VSEPR Geometry", durationOrQuestions: "58 mins" },
        { id: "item-9", type: "DPP", title: "DPP #01: Dipole Moment & MOT Bond Order Calculations", durationOrQuestions: "18 MCQs" },
      ],
    },
  ],
  "course-4": [
    {
      id: "mod-5",
      title: "Module 1: Human Circulation & Cardiac Dynamics",
      badge: "6 Lectures · 4 DPPs",
      items: [
        { id: "item-10", type: "LECTURE", title: "Lecture 01: Cardiac Cycle & ECG Pattern Analysis", durationOrQuestions: "70 mins" },
        { id: "item-11", type: "DPP", title: "DPP #01: NEET High-Yield Assertion Reason Questions", durationOrQuestions: "30 MCQs" },
      ],
    },
  ],
};

export default function CoursesPage() {
  const [courses, setCourses] = useState(mockCourses);
  const [selectedCourse, setSelectedCourse] = useState(mockCourses[0]);
  const [courseModules, setCourseModules] = useState<Record<string, CourseModule[]>>(defaultModules);

  // Modals & toast state
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<ModuleItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New course form
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("Physics");
  const [newTeacher, setNewTeacher] = useState("Dr. Arvind Sharma");
  const [newDescription, setNewDescription] = useState("");

  // New module / item form
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [itemType, setItemType] = useState<"LECTURE" | "DPP" | "NOTES">("DPP");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDetail, setItemDetail] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const currentModules = courseModules[selectedCourse.id] || [];

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newCourseObj = {
      id: `course-${Date.now()}`,
      organizationId: "org-1",
      createdBy: "usr-faculty-1",
      createdAt: new Date().toISOString(),
      title: newTitle,
      description: newDescription || "Comprehensive coaching curriculum module with video lectures & practice problems.",
      subjectName: newSubject,
      teacherName: newTeacher,
      moduleCount: 1,
      lessonCount: 3,
      dppCount: 2,
      status: "PUBLISHED" as const,
    };

    setCourses([newCourseObj, ...courses]);
    setCourseModules((prev) => ({
      ...prev,
      [newCourseObj.id]: [
        {
          id: `mod-${Date.now()}`,
          title: "Module 1: Orientation & Core Foundations",
          badge: "3 Lectures · 2 DPPs",
          items: [
            { id: `it-1`, type: "LECTURE", title: "Lecture 01: Concept Overview & Key Definitions", durationOrQuestions: "45 mins" },
            { id: `it-2`, type: "DPP", title: "DPP #01: Foundation Problem Set", durationOrQuestions: "15 MCQs" },
          ],
        },
      ],
    }));

    setSelectedCourse(newCourseObj);
    setShowCreateCourseModal(false);
    setNewTitle("");
    setNewDescription("");
    triggerToast(`Course "${newCourseObj.title}" created successfully!`);
  };

  const handleAddModuleOrItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;

    setCourseModules((prev) => {
      const existing = prev[selectedCourse.id] || [];
      const targetModId = selectedModuleId || (existing[0]?.id ?? "new-mod");
      
      let updatedModules: CourseModule[];
      if (existing.length === 0 || selectedModuleId === "NEW") {
        // Create new module
        const newMod: CourseModule = {
          id: `mod-${Date.now()}`,
          title: itemTitle.startsWith("Module") ? itemTitle : `Module ${existing.length + 1}: ${itemTitle}`,
          badge: "1 Item",
          items: [
            {
              id: `item-${Date.now()}`,
              type: itemType,
              title: itemTitle,
              durationOrQuestions: itemDetail || (itemType === "LECTURE" ? "45 mins" : itemType === "DPP" ? "15 MCQs" : "PDF"),
            },
          ],
        };
        updatedModules = [...existing, newMod];
      } else {
        updatedModules = existing.map((mod) => {
          if (mod.id === targetModId) {
            return {
              ...mod,
              items: [
                ...mod.items,
                {
                  id: `item-${Date.now()}`,
                  type: itemType,
                  title: itemTitle,
                  durationOrQuestions: itemDetail || (itemType === "LECTURE" ? "50 mins" : itemType === "DPP" ? "20 MCQs" : "8 pages"),
                },
              ],
            };
          }
          return mod;
        });
      }

      return {
        ...prev,
        [selectedCourse.id]: updatedModules,
      };
    });

    setShowAddModuleModal(false);
    setItemTitle("");
    setItemDetail("");
    triggerToast(`Added ${itemType === "DPP" ? "DPP" : itemType === "LECTURE" ? "Lecture" : "Notes"} to ${selectedCourse.title}!`);
  };

  const handleDownloadPDF = (title: string) => {
    const fakeContent = `PrepZii LMS - Study Material & Daily Practice Problem\n\nCourse: ${selectedCourse.title}\nSubject: ${selectedCourse.subjectName}\nTeacher: ${selectedCourse.teacherName}\nTitle: ${title}\n\nQuestions:\n1. Find the electric field due to a uniformly charged thin spherical shell at distance r > R.\n2. Calculate the equivalent capacitance across terminals A and B in the infinite ladder network.\n3. Identify the major product formed during electrophilic aromatic substitution.\n\n-- End of Practice Sheet --\nPrepZii AI Learning Management System`;
    const blob = new Blob([fakeContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast(`Downloaded: ${title}`);
  };

  return (
    <DashboardLayout
      title="Courses, Curriculum & DPPs"
      subtitle="Organize chapter-wise modules, lecture recordings, PDF study material, and Daily Practice Problems"
      action={
        <Button variant="primary" onClick={() => setShowCreateCourseModal(true)}>
          ＋ Create Course
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
        <MetricCard label="Active Courses" value={String(courses.length)} detail="All subjects covered" accent="yellow" />
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
                <span>📁 {courseModules[course.id]?.length ?? course.moduleCount} Modules</span>
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
              <Button variant="secondary" style={{ fontSize: "12px" }} onClick={() => setShowAddModuleModal(true)}>
                ＋ Add Module / DPP
              </Button>
            }
          >
            <div style={{ display: "grid", gap: "14px", marginTop: "10px" }}>
              {currentModules.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#68736d" }}>
                  <p>No modules yet for this course.</p>
                  <Button variant="primary" style={{ marginTop: "10px", fontSize: "12px" }} onClick={() => setShowAddModuleModal(true)}>
                    Add First Module
                  </Button>
                </div>
              ) : (
                currentModules.map((mod) => (
                  <div key={mod.id} style={{ border: "1px solid #edf0ed", borderRadius: "10px", padding: "14px", background: "#fbfcfb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <strong style={{ fontSize: "14px" }}>{mod.title}</strong>
                      <Badge variant="purple" size="sm">{mod.items.length} Items</Badge>
                    </div>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {mod.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "white",
                            borderRadius: "6px",
                            border: "1px solid #edf0ed",
                          }}
                        >
                          <span style={{ fontSize: "13px" }}>
                            {item.type === "LECTURE" ? "🎬 " : item.type === "DPP" ? "📝 " : "📄 "}
                            {item.title}
                          </span>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: "#68736d" }}>{item.durationOrQuestions}</span>
                            {item.type === "DPP" && (
                              <Button
                                variant="outline"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => handleDownloadPDF(item.title)}
                              >
                                Download PDF
                              </Button>
                            )}
                            {item.type === "NOTES" && (
                              <Button
                                variant="secondary"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => setPreviewItem(item)}
                              >
                                View Notes
                              </Button>
                            )}
                            {item.type === "LECTURE" && (
                              <Button
                                variant="outline"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => triggerToast(`Playing recording: ${item.title}`)}
                              >
                                Watch Video
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Create Course Modal */}
      {showCreateCourseModal && (
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
            width: "500px",
            maxWidth: "92vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Create New Coaching Course
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#68736d" }}>
              Define curriculum structure, lead faculty, and target subject stream.
            </p>

            <form onSubmit={handleCreateCourse} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Course Title</label>
                <input
                  type="text"
                  placeholder="e.g. Modern Physics & Electromagnetic Induction Masterclass"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Subject</label>
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
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Lead Faculty</label>
                  <select
                    value={newTeacher}
                    onChange={(e) => setNewTeacher(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  >
                    <option value="Dr. Arvind Sharma">Dr. Arvind Sharma</option>
                    <option value="Prof. Meenakshi Sundaram">Prof. Meenakshi Sundaram</option>
                    <option value="Er. Rajesh Kothari">Er. Rajesh Kothari</option>
                    <option value="Dr. Shalini Mukhopadhyay">Dr. Shalini Mukhopadhyay</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Target competitive exam, pre-requisites, and syllabus coverage..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button variant="secondary" onClick={() => setShowCreateCourseModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save & Publish Course
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Module / DPP Modal */}
      {showAddModuleModal && (
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
              Add Module Content to {selectedCourse.title}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#68736d" }}>
              Append a new lecture recording, Daily Practice Problem (DPP), or study note.
            </p>

            <form onSubmit={handleAddModuleOrItem} style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Target Module</label>
                <select
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                >
                  {currentModules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                  <option value="NEW">＋ Create as a New Module</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Content Type</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["DPP", "LECTURE", "NOTES"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setItemType(t)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "8px",
                        border: itemType === t ? "2px solid var(--brand-dark)" : "1px solid var(--line)",
                        background: itemType === t ? "#f3f5f3" : "white",
                        fontWeight: itemType === t ? 700 : 500,
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {t === "DPP" ? "📝 DPP Sheet" : t === "LECTURE" ? "🎬 Lecture" : "📄 PDF Notes"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Title / Topic Name</label>
                <input
                  type="text"
                  placeholder={itemType === "DPP" ? "e.g. DPP #03: Dielectrics & Polarisation" : "e.g. Lecture 03: Boundary Conditions"}
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  {itemType === "LECTURE" ? "Video Duration (e.g. 55 mins)" : itemType === "DPP" ? "Question Count (e.g. 20 MCQs)" : "Page Count (e.g. 15 pages)"}
                </label>
                <input
                  type="text"
                  placeholder={itemType === "LECTURE" ? "55 mins" : "20 MCQs"}
                  value={itemDetail}
                  onChange={(e) => setItemDetail(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button variant="secondary" onClick={() => setShowAddModuleModal(false)} type="button">
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Add Item
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notes Preview Modal */}
      {previewItem && (
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
            width: "550px",
            maxWidth: "92vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontFamily: "var(--font-display)" }}>
                📄 {previewItem.title}
              </h3>
              <Badge variant="purple" size="sm">{previewItem.durationOrQuestions}</Badge>
            </div>
            <div style={{
              background: "#f9faf9",
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "16px",
              fontSize: "13px",
              lineHeight: 1.6,
              maxHeight: "300px",
              overflowY: "auto",
              fontFamily: "var(--font-mono, monospace)",
            }}>
              <p><strong>[Apex Coaching Institute - Official Faculty Study Material]</strong></p>
              <p>Course: {selectedCourse.title}</p>
              <p>Lead Faculty: {selectedCourse.teacherName}</p>
              <hr style={{ border: "0", borderTop: "1px solid #ddd", margin: "10px 0" }} />
              <p><strong>Key Concepts Covered:</strong></p>
              <ul>
                <li>Electrostatic field vector formulations: E = (1 / 4πε₀) * (q / r²) * r̂</li>
                <li>Gauss&apos;s Law closed surface integration: ∮ E · dA = Q_enclosed / ε₀</li>
                <li>Boundary value conditions on dielectric interfaces</li>
                <li>High-yield JEE Advanced & NEET question patterns</li>
              </ul>
              <p style={{ color: "#68736d", fontSize: "11px" }}>This document is protected by PrepZii LMS DRM watermarking.</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <Button variant="outline" onClick={() => handleDownloadPDF(previewItem.title)}>
                Download Copy
              </Button>
              <Button variant="primary" onClick={() => setPreviewItem(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

