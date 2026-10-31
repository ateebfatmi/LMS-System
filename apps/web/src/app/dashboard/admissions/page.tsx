"use client";

import { useState, useEffect } from "react";
import { Badge, Button, DatePicker, MetricCard, Panel, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { AdmissionsEnquiryRecord, EnquiryStatus, LeadSource } from "@prepzii/contracts";

export default function AdmissionsPage() {
  const [enquiries, setEnquiries] = useState<AdmissionsEnquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New Lead Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [targetExam, setTargetExam] = useState<"JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION">("JEE_ADVANCED");
  const [leadSource, setLeadSource] = useState<LeadSource>("WALK_IN");
  const [currentSchool, setCurrentSchool] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Followup Modal State
  const [activeEnquiry, setActiveEnquiry] = useState<AdmissionsEnquiryRecord | null>(null);
  const [interactionType, setInteractionType] = useState<"PHONE_CALL" | "IN_PERSON_MEETING" | "WHATSAPP">("PHONE_CALL");
  const [followupRemarks, setFollowupRemarks] = useState("");
  const [nextDate, setNextDate] = useState("2026-10-25");
  const [newStatus, setNewStatus] = useState<EnquiryStatus>("COUNSELED");

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admissions");
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data.enquiries || []);
      }
    } catch (err) {
      console.error("Failed to load admissions enquiries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The async loader owns the loading lifecycle for the initial fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEnquiries();
  }, []);

  const handleCreateEnquiry = async () => {
    if (!studentName || !phone) {
      setFormError("Student name and phone number are required");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_ENQUIRY",
          studentName,
          parentName,
          phone,
          email,
          targetExam,
          leadSource,
          currentSchool,
          notes,
        }),
      });

      const data = await res.json();
      if (data.isDuplicate) {
        setFormError(`Notice: An existing enquiry with phone ${phone} already exists for ${data.enquiry.studentName}.`);
        setSaving(false);
        return;
      }

      setShowAddModal(false);
      setStudentName("");
      setParentName("");
      setPhone("");
      setEmail("");
      setNotes("");
      await loadEnquiries();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create enquiry");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFollowup = async () => {
    if (!activeEnquiry || !followupRemarks) return;
    try {
      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_FOLLOWUP",
          enquiryId: activeEnquiry.id,
          interactionType,
          remarks: followupRemarks,
          nextFollowupDate: nextDate,
          newStatus,
        }),
      });

      if (res.ok) {
        setActiveEnquiry(null);
        setFollowupRemarks("");
        await loadEnquiries();
      }
    } catch (err) {
      console.error("Failed to save follow-up:", err);
    }
  };

  const handleEnrollStudent = async (enquiry: AdmissionsEnquiryRecord) => {
    const targetBatch = enquiry.targetBatchId || "batch-1";
    if (!confirm(`Confirm enrollment of ${enquiry.studentName} into coaching batch? This will generate a roll number and student profile.`)) {
      return;
    }

    try {
      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CONVERT_STUDENT",
          enquiryId: enquiry.id,
          targetBatchId: targetBatch,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✓ Successfully enrolled ${enquiry.studentName}! Assigned Roll Number: ${data.student.rollNumber}`);
        await loadEnquiries();
      }
    } catch (err) {
      console.error("Conversion failed:", err);
    }
  };

  const newCount = enquiries.filter((e) => e.status === "NEW").length;
  const inProgressCount = enquiries.filter((e) => ["CONTACTED", "COUNSELED", "DEMO_ATTENDED"].includes(e.status)).length;
  const enrolledCount = enquiries.filter((e) => e.status === "ENROLLED").length;

  return (
    <DashboardLayout
      title="Admissions & Lead Management CRM"
      subtitle="Track student walk-ins, phone enquiries, demo class feedback, counselor follow-ups, and 1-click batch enrollment"
      action={
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          ＋ New Student Enquiry
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Inquiries" value={String(enquiries.length)} detail="This intake season" accent="navy" />
        <MetricCard label="New Leads" value={String(newCount)} detail="Awaiting counselor follow-up" accent="orange" />
        <MetricCard label="Counseled / In Demo" value={String(inProgressCount)} detail="Attending trial lectures" accent="yellow" />
        <MetricCard label="Batch Enrolled" value={String(enrolledCount)} detail="Converted to students" accent="green" />
      </div>

      <div style={{ marginTop: "16px" }}>
        <Panel title="Admissions Pipeline & Lead Tracker">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Contact Info</th>
                  <th>Target Exam</th>
                  <th>Lead Source</th>
                  <th>Counsellor</th>
                  <th>Status</th>
                  <th>Last Interaction</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      Loading admissions pipeline...
                    </td>
                  </tr>
                ) : enquiries.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      No enquiries logged yet.
                    </td>
                  </tr>
                ) : (
                  enquiries.map((enq) => (
                    <tr key={enq.id}>
                      <td>
                        <strong>{enq.studentName}</strong>
                        {enq.parentName && (
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>Parent: {enq.parentName}</div>
                        )}
                      </td>
                      <td>
                        <div>{enq.phone}</div>
                        {enq.email && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{enq.email}</div>}
                      </td>
                      <td>
                        <Badge variant="brand" size="sm">
                          {enq.targetExam.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {enq.leadSource.replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px" }}>{enq.assignedCounsellorName || "Front Desk"}</span>
                      </td>
                      <td>
                        <Badge
                          variant={
                            enq.status === "ENROLLED"
                              ? "success"
                              : enq.status === "NEW"
                              ? "warning"
                              : enq.status === "LOST"
                              ? "neutral"
                              : "brand"
                          }
                          size="sm"
                        >
                          {enq.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        {enq.followups[0] ? (
                          <div style={{ fontSize: "11px", maxWidth: "200px" }}>
                            <strong>{enq.followups[0].interactionType.replace("_", " ")}</strong>:{" "}
                            {enq.followups[0].remarks.slice(0, 50)}...
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>No notes yet</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setActiveEnquiry(enq);
                              setNewStatus(enq.status);
                            }}
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                          >
                            💬 Follow-up
                          </Button>
                          {enq.status !== "ENROLLED" && (
                            <Button
                              variant="primary"
                              onClick={() => handleEnrollStudent(enq)}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              ⚡ Enrol
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Add Enquiry Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "520px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)" }}>
              Log New Admissions Enquiry
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Record lead details from walk-in, phone call, or website enquiry.
            </p>

            {formError && (
              <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>
                {formError}
              </div>
            )}

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Student Name *
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Parent Name
                  </label>
                  <input
                    type="text"
                    className="search-input"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    placeholder="+91 9876543210"
                    className="search-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="search-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Target Examination
                  </label>
                  <Select
                    value={targetExam}
                    onChange={(val) => setTargetExam(val as typeof targetExam)}
                    style={{ width: "100%" }}
                  >
                    <option value="JEE_ADVANCED">JEE Advanced</option>
                    <option value="JEE_MAIN">JEE Main</option>
                    <option value="NEET">NEET</option>
                    <option value="FOUNDATION">Foundation</option>
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Lead Source
                  </label>
                  <Select
                    value={leadSource}
                    onChange={(val) => setLeadSource(val as LeadSource)}
                    style={{ width: "100%" }}
                  >
                    <option value="WALK_IN">Walk-in Visit</option>
                    <option value="PHONE_ENQUIRY">Phone Call</option>
                    <option value="STUDENT_REFERRAL">Student Referral</option>
                    <option value="WEBSITE">Website Form</option>
                    <option value="SEMINAR">Seminar / Talent Exam</option>
                    <option value="NEWSPAPER_AD">Newspaper / Hoarding</option>
                  </Select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Current School & Grade
                </label>
                <input
                  type="text"
                  placeholder="e.g. DPS R.K. Puram · Class 11"
                  className="search-input"
                  value={currentSchool}
                  onChange={(e) => setCurrentSchool(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Counselor Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Student scored 95% in Class 10; wants weekend batch"
                  className="search-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", height: "auto" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreateEnquiry} disabled={saving}>
                  {saving ? "Saving..." : "✓ Create Enquiry"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followup Modal */}
      {activeEnquiry && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              maxWidth: "560px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
              Counseling Follow-up: {activeEnquiry.studentName}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Phone: {activeEnquiry.phone} · Target: {activeEnquiry.targetExam.replace("_", " ")}
            </p>

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Interaction Type
                  </label>
                  <Select
                    value={interactionType}
                    onChange={(val) => setInteractionType(val as typeof interactionType)}
                    style={{ width: "100%" }}
                  >
                    <option value="PHONE_CALL">Phone Call</option>
                    <option value="IN_PERSON_MEETING">Campus Meeting</option>
                    <option value="WHATSAPP">WhatsApp Chat</option>
                  </Select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Update Lead Status
                  </label>
                  <Select
                    value={newStatus}
                    onChange={(val) => setNewStatus(val as EnquiryStatus)}
                    style={{ width: "100%" }}
                  >
                    <option value="CONTACTED">Contacted</option>
                    <option value="COUNSELED">Counseled</option>
                    <option value="DEMO_ATTENDED">Demo Attended</option>
                    <option value="OFFER_EXTENDED">Offer Extended</option>
                    <option value="LOST">Lost / Dropped</option>
                  </Select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Discussion Remarks & Feedback
                </label>
                <textarea
                  rows={3}
                  placeholder="Parent asked about scholarship test and bus routes..."
                  value={followupRemarks}
                  onChange={(e) => setFollowupRemarks(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Next follow-up date
                </label>
                <DatePicker
                  value={nextDate}
                  onChange={(val) => setNextDate(val)}
                />
              </div>

              {/* Past followups history */}
              {activeEnquiry.followups.length > 0 && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", maxHeight: "140px", overflowY: "auto" }}>
                  <strong style={{ fontSize: "11px", color: "var(--muted)" }}>Previous Notes:</strong>
                  {activeEnquiry.followups.map((f) => (
                    <div key={f.id} style={{ fontSize: "11px", marginTop: "6px", borderBottom: "1px solid var(--line)", paddingBottom: "4px" }}>
                      <strong>{f.interactionType.replace("_", " ")}</strong> ({new Date(f.createdAt).toLocaleDateString("en-IN")}): {f.remarks}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <Button variant="secondary" onClick={() => setActiveEnquiry(null)}>
                  Close
                </Button>
                <Button variant="primary" onClick={handleAddFollowup}>
                  ✓ Log Follow-up
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
