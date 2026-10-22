"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { BulkImportResult, InstituteSetupChecklist } from "@prepzii/contracts";

export default function OnboardingPage() {
  const [checklist, setChecklist] = useState<InstituteSetupChecklist | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Form State
  const [instituteName, setInstituteName] = useState("Apex JEE & NEET Academy");
  const [campusName, setCampusName] = useState("North Campus - Main Center");
  const [academicYear, setAcademicYear] = useState("2026–2027");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([
    "JEE_MAIN",
    "JEE_ADVANCED",
    "NEET",
    "FOUNDATION",
  ]);
  const [profileSaved, setProfileSaved] = useState(false);

  // Bulk Import State
  const [csvText, setCsvText] = useState(
    `Name,Phone,RollNumber,BatchName,TargetExam,ParentName,ParentPhone
Siddharth Rao,+919811223344,APX-2026-1215,JEE 12A - Titans,JEE_ADVANCED,G. Rao,+919811223344
Tanvi Deshmukh,+919822334455,APX-2026-1216,NEET 12 - Medico Super 50,NEET,S. Deshmukh,+919822334455
Kabir Verma,+919833445566,APX-2026-1217,JEE 11B - Nucleus,JEE_MAIN,M. Verma,+919833445566`
  );
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  // Teacher Invite State
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("Physics");
  const [teacherInviteSuccess, setTeacherInviteSuccess] = useState(false);

  useEffect(() => {
    async function loadChecklist() {
      try {
        setLoading(true);
        const res = await fetch("/api/onboarding");
        if (res.ok) {
          const data = await res.json();
          setChecklist(data.checklist);
        }
      } catch (err) {
        console.error("Failed to load onboarding checklist:", err);
      } finally {
        setLoading(false);
      }
    }
    loadChecklist();
  }, []);

  const handleSaveProfile = async () => {
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_PROFILE",
          name: instituteName,
          campusName,
          academicYear,
          programs: selectedPrograms,
        }),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
    }
  };

  const handleBulkImport = async () => {
    try {
      setImporting(true);
      const lines = csvText.trim().split("\n");
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim());
        if (parts.length >= 5) {
          rows.push({
            name: parts[0],
            phone: parts[1],
            rollNumber: parts[2],
            batchName: parts[3],
            targetExam: parts[4] as any,
            parentName: parts[5] || parts[0] + " Parent",
            parentPhone: parts[6] || parts[1],
          });
        }
      }

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BULK_IMPORT", rows }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult(data);
      }
    } catch (err) {
      console.error("Bulk import failed:", err);
    } finally {
      setImporting(false);
    }
  };

  const handleInviteTeacher = async () => {
    if (!teacherName || !teacherEmail) return;
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INVITE_TEACHER",
          name: teacherName,
          email: teacherEmail,
          subject: teacherSubject,
        }),
      });
      if (res.ok) {
        setTeacherInviteSuccess(true);
        setTeacherName("");
        setTeacherEmail("");
        setTimeout(() => setTeacherInviteSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Teacher invitation failed:", err);
    }
  };

  const progress = checklist?.overallCompletedPercentage || 85;

  return (
    <DashboardLayout
      title="Institute Onboarding & Operations Setup"
      subtitle="Complete guided setup for campus locations, academic sessions, target programs, faculty invitations, and bulk student onboarding"
    >
      {/* Onboarding Checklist Progress Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#ffffff",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "18px", color: "#f8fafc" }}>
              Institute Launch Readiness: {progress}% Completed
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
              Follow these simple steps to configure your coaching academy for faculty, parents, and students.
            </p>
          </div>
          <Badge variant={progress === 100 ? "success" : "brand"} size="md">
            {progress === 100 ? "✓ READY FOR OPERATIONS" : "IN SETUP"}
          </Badge>
        </div>
        <ProgressBar value={progress} variant="brand" />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.profileConfigured ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.profileConfigured ? "#e2e8f0" : "#94a3b8" }}>1. Institute Profile</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.campusAdded ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.campusAdded ? "#e2e8f0" : "#94a3b8" }}>2. Campus Config</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.programsConfigured ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.programsConfigured ? "#e2e8f0" : "#94a3b8" }}>3. Exam Programs</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.firstBatchCreated ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.firstBatchCreated ? "#e2e8f0" : "#94a3b8" }}>4. Batches Created</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.teacherInvited ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.teacherInvited ? "#e2e8f0" : "#94a3b8" }}>5. Faculty Invited</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
            <span>{checklist?.studentsEnrolled ? "✅" : "⏳"}</span>
            <span style={{ color: checklist?.studentsEnrolled ? "#e2e8f0" : "#94a3b8" }}>6. Students Enrolled</span>
          </div>
        </div>
      </div>

      <div className="card-grid-2">
        {/* Step 1 & 2: Institute Profile & Programs */}
        <Panel title="Step 1: Institute Profile & Programs">
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Institute Name
              </label>
              <input
                type="text"
                className="search-input"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Primary Campus
                </label>
                <input
                  type="text"
                  className="search-input"
                  value={campusName}
                  onChange={(e) => setCampusName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Academic Session
                </label>
                <input
                  type="text"
                  className="search-input"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Target Coaching Programs
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS"].map((prog) => (
                  <button
                    key={prog}
                    type="button"
                    onClick={() => {
                      if (selectedPrograms.includes(prog)) {
                        setSelectedPrograms(selectedPrograms.filter((p) => p !== prog));
                      } else {
                        setSelectedPrograms([...selectedPrograms, prog]);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      background: selectedPrograms.includes(prog) ? "#fef08a" : "#f8fafc",
                      fontWeight: 600,
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    {selectedPrograms.includes(prog) ? "✓ " : "+ "}
                    {prog.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" onClick={handleSaveProfile}>
              {profileSaved ? "✓ Profile Updated" : "Save Institute Settings"}
            </Button>
          </div>
        </Panel>

        {/* Step 3: Teacher Invitations */}
        <Panel title="Step 2: Invite Faculty & Mentors">
          <div style={{ display: "grid", gap: "14px" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
              Invited teachers receive a secure Clerk link to access their batch attendance registers, CBT test creation, and DPP uploaders.
            </p>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                Teacher Name
              </label>
              <input
                type="text"
                placeholder="e.g. Er. Vivek Gupta"
                className="search-input"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="teacher@coaching.com"
                  className="search-input"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Subject Specialization
                </label>
                <select
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubject(e.target.value)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Biology">Biology</option>
                </select>
              </div>
            </div>

            <Button variant="secondary" onClick={handleInviteTeacher}>
              {teacherInviteSuccess ? "✓ Invitation Sent" : "📧 Dispatch Teacher Invite"}
            </Button>
          </div>
        </Panel>
      </div>

      {/* Step 4: Bulk CSV Student Importer with Duplicate Detection */}
      <div style={{ marginTop: "20px" }}>
        <Panel
          title="Step 3: Bulk Student Importer (CSV / Excel)"
          subtitle="Import entire batches at once. Automatic validation prevents duplicate roll numbers and telephone conflicts."
        >
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                Paste CSV Data (Header: Name, Phone, RollNumber, BatchName, TargetExam, ParentName, ParentPhone)
              </label>
              <textarea
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  background: "#f8fafc",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <Button variant="primary" onClick={handleBulkImport} disabled={importing}>
                {importing ? "Processing Import..." : "⚡ Process & Enrol Students"}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setCsvText(
                    `Name,Phone,RollNumber,BatchName,TargetExam,ParentName,ParentPhone\nAarav Sharma,+919876543210,APX-2026-1201,JEE 12A - Titans,JEE_ADVANCED,Rajesh Sharma,+919876543210`
                  )
                }
              >
                Test Duplicate Detection
              </Button>
            </div>

            {/* Import Results Banner */}
            {importResult && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  background: importResult.duplicateCount > 0 ? "#fffdf5" : "#f0fdf4",
                }}
              >
                <div style={{ display: "flex", gap: "20px", marginBottom: "10px", fontWeight: 600, fontSize: "13px" }}>
                  <span style={{ color: "#166534" }}>✅ Enrolled: {importResult.successfulCount}</span>
                  <span style={{ color: "#b45309" }}>⚠️ Duplicates Blocked: {importResult.duplicateCount}</span>
                </div>

                {importResult.duplicates.length > 0 && (
                  <div style={{ fontSize: "12px", color: "#b91c1c" }}>
                    <strong>Duplicate Conflicts:</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: "20px" }}>
                      {importResult.duplicates.map((d, i) => (
                        <li key={i}>
                          Roll No: <code>{d.rollNumber}</code> · {d.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </DashboardLayout>
  );
}
