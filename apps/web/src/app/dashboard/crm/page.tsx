"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockLeads, mockBatches } from "@/lib/mock-data";
import type { Lead, LeadStage, LeadSource, TargetExam } from "@prepzii/contracts";

const STAGE_LABELS: Record<LeadStage, { label: string; variant: "neutral" | "info" | "warning" | "success" | "brand" | "danger" }> = {
  NEW: { label: "New Inquiry", variant: "info" },
  CONTACTED: { label: "Contacted", variant: "neutral" },
  COUNSELLING_SCHEDULED: { label: "Counselling Set", variant: "warning" },
  TRIAL_ATTENDED: { label: "Trial Attended", variant: "brand" },
  CONVERTED: { label: "Enrolled / Converted", variant: "success" },
  LOST: { label: "Lost / Closed", variant: "danger" },
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  WALK_IN: "Walk-in Center",
  WEBSITE: "Website Form",
  REFERRAL: "Student Referral",
  SOCIAL_MEDIA: "Instagram / FB",
  NEWSPAPER: "Print Ad",
  CAMPAIGN: "School Outreach",
  OTHER: "Other Source",
};

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [conversionRoll, setConversionRoll] = useState("");
  const [conversionBatch, setConversionBatch] = useState(mockBatches[0]?.id || "");
  const [conversionSuccessMsg, setConversionSuccessMsg] = useState("");

  // New Lead Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGuardianName, setNewGuardianName] = useState("");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");
  const [newTargetExam, setNewTargetExam] = useState<TargetExam>("JEE_ADVANCED");
  const [newSource, setNewSource] = useState<LeadSource>("WALK_IN");
  const [newEstimatedFee, setNewEstimatedFee] = useState("145000");
  const [newNotes, setNewNotes] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");

  // Metrics
  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.stage === "CONVERTED").length;
  const activePipeline = leads.filter((l) => l.stage !== "CONVERTED" && l.stage !== "LOST").length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.guardianName && lead.guardianName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStage = stageFilter === "ALL" || lead.stage === stageFilter;
    const matchesSource = sourceFilter === "ALL" || lead.source === sourceFilter;
    return matchesSearch && matchesStage && matchesSource;
  });

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const created: Lead = {
      id: `lead-${Date.now()}`,
      organizationId: "org-1",
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      guardianName: newGuardianName.trim() || undefined,
      guardianPhone: newGuardianPhone.trim() || undefined,
      targetExam: newTargetExam,
      source: newSource,
      stage: "NEW",
      followUpDate: newFollowUp || new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      estimatedFee: Number(newEstimatedFee) || 0,
      notes: newNotes.trim() || undefined,
      assignedCounsellorName: "Front Desk Counsellor",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLeads([created, ...leads]);
    setShowAddModal(false);
    // Reset form
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewGuardianName("");
    setNewGuardianPhone("");
    setNewNotes("");
  };

  const handleStageChange = (leadId: string, newStage: LeadStage) => {
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              stage: newStage,
              updatedAt: new Date().toISOString(),
            }
          : lead,
      ),
    );
  };

  const startConversion = (lead: Lead) => {
    setConvertingLead(lead);
    const deterministicRollNumber = `APX-2026-${1300 + (parseInt(lead.id.replace(/\D/g, "") || "1", 10) % 700)}`;
    setConversionRoll(deterministicRollNumber);
    setConversionBatch(lead.targetBatchId || mockBatches[0]?.id || "");
    setConversionSuccessMsg("");
  };

  const confirmConversion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;

    const targetBatch = mockBatches.find((b) => b.id === conversionBatch);

    setLeads((prev) =>
      prev.map((l) =>
        l.id === convertingLead.id
          ? {
              ...l,
              stage: "CONVERTED",
              convertedStudentId: `std-conv-${Date.now()}`,
              convertedAt: new Date().toISOString(),
              targetBatchId: targetBatch?.id,
              targetBatchName: targetBatch?.name,
              notes: `${l.notes ? l.notes + "\n" : ""}Converted to student with Roll: ${conversionRoll}`,
              updatedAt: new Date().toISOString(),
            }
          : l,
      ),
    );

    setConversionSuccessMsg(
      `✓ Successfully converted ${convertingLead.name} into Student Roll ${conversionRoll} in ${targetBatch?.name}!`,
    );

    setTimeout(() => {
      setConvertingLead(null);
      setConversionSuccessMsg("");
    }, 2200);
  };

  const stages: LeadStage[] = [
    "NEW",
    "CONTACTED",
    "COUNSELLING_SCHEDULED",
    "TRIAL_ATTENDED",
    "CONVERTED",
    "LOST",
  ];

  return (
    <DashboardLayout
      title="Admissions CRM & Inquiries"
      subtitle="Track parent walk-ins, counselling sessions, trial classes, and 1-click student admissions"
      action={
        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            variant={viewMode === "kanban" ? "primary" : "outline"}
            onClick={() => setViewMode(viewMode === "kanban" ? "table" : "kanban")}
          >
            {viewMode === "kanban" ? "📋 Table View" : "📊 Kanban Board"}
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            ＋ New Admission Lead
          </Button>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="metrics-grid">
        <MetricCard label="Total Inquiries" value={String(totalLeads)} detail="This academic season" accent="yellow" />
        <MetricCard label="Active In Pipeline" value={String(activePipeline)} detail="Requiring follow-up" accent="navy" />
        <MetricCard label="Enrolled Students" value={String(convertedLeads)} detail="Converted leads" accent="green" />
        <MetricCard label="Conversion Rate" value={`${conversionRate}%`} detail="Walk-in to admission" accent="orange" />
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "16px",
          background: "white",
          borderRadius: "14px",
          border: "1px solid var(--line)",
          marginBottom: "20px",
        }}
      >
        <div style={{ flex: "1 1 240px" }}>
          <input
            type="text"
            placeholder="🔍 Search lead name, phone number, guardian..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "13px",
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Stage:</label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              background: "white",
            }}
          >
            <option value="ALL">All Stages ({totalLeads})</option>
            {stages.map((st) => (
              <option key={st} value={st}>
                {STAGE_LABELS[st].label} ({leads.filter((l) => l.stage === st).length})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "12px",
              background: "white",
            }}
          >
            <option value="ALL">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === "kanban" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            alignItems: "start",
          }}
        >
          {stages.map((stageKey) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stageKey);
            const stageMeta = STAGE_LABELS[stageKey];

            return (
              <div
                key={stageKey}
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  minHeight: "360px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Badge variant={stageMeta.variant} size="sm">
                      {stageMeta.label}
                    </Badge>
                  </div>
                  <span
                    style={{
                      background: "white",
                      border: "1px solid var(--line)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                {stageLeads.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 12px",
                      textAlign: "center",
                      color: "var(--muted)",
                      fontSize: "12px",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "10px",
                      background: "white",
                    }}
                  >
                    No leads in {stageMeta.label}
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        background: "white",
                        border: "1px solid var(--line)",
                        borderRadius: "12px",
                        padding: "14px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                        <div>
                          <strong style={{ fontSize: "14px", fontFamily: "var(--font-display)" }}>
                            {lead.name}
                          </strong>
                          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                            {lead.targetExam.replace("_", " ")} · {SOURCE_LABELS[lead.source]}
                          </div>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857" }}>
                          ₹{(lead.estimatedFee || 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "2px", color: "#334155" }}>
                        <div>📞 <a href={`tel:${lead.phone}`} style={{ color: "inherit", textDecoration: "none" }}>{lead.phone}</a></div>
                        {lead.guardianName && (
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                            Guardian: {lead.guardianName} ({lead.guardianPhone || "Same"})
                          </div>
                        )}
                        {lead.followUpDate && (
                          <div style={{ fontSize: "11px", color: "#b45309", fontWeight: 600 }}>
                            🗓 Follow-up: {lead.followUpDate}
                          </div>
                        )}
                      </div>

                      {lead.notes && (
                        <div
                          style={{
                            background: "#f1f5f9",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            color: "#475569",
                            lineHeight: "1.4",
                          }}
                        >
                          &quot;{lead.notes}&quot;
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                        <select
                          value={lead.stage}
                          onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                          style={{
                            flex: 1,
                            padding: "4px 6px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            fontSize: "11px",
                            background: "#f8fafc",
                          }}
                        >
                          {stages.map((st) => (
                            <option key={st} value={st}>
                              Move: {STAGE_LABELS[st].label}
                            </option>
                          ))}
                        </select>

                        {lead.stage !== "CONVERTED" && (
                          <button
                            type="button"
                            onClick={() => startConversion(lead)}
                            style={{
                              background: "#047857",
                              color: "white",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            ✓ Enroll
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Panel title="All Admissions & Inquiries">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Contact</th>
                  <th>Target Exam</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Follow-up</th>
                  <th>Counsellor</th>
                  <th>Est. Fee</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.name}</strong>
                      {lead.guardianName && (
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          G: {lead.guardianName}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{lead.phone}</div>
                      {lead.email && <div style={{ fontSize: "11px", color: "var(--muted)" }}>{lead.email}</div>}
                    </td>
                    <td>
                      <Badge variant="neutral" size="sm">
                        {lead.targetExam.replace("_", " ")}
                      </Badge>
                    </td>
                    <td style={{ fontSize: "12px" }}>{SOURCE_LABELS[lead.source]}</td>
                    <td>
                      <Badge variant={STAGE_LABELS[lead.stage].variant} size="sm">
                        {STAGE_LABELS[lead.stage].label}
                      </Badge>
                    </td>
                    <td style={{ fontSize: "12px", color: "#b45309" }}>{lead.followUpDate || "—"}</td>
                    <td style={{ fontSize: "12px" }}>{lead.assignedCounsellorName || "Unassigned"}</td>
                    <td style={{ fontWeight: 600 }}>₹{(lead.estimatedFee || 0).toLocaleString("en-IN")}</td>
                    <td>
                      {lead.stage !== "CONVERTED" ? (
                        <button
                          type="button"
                          onClick={() => startConversion(lead)}
                          style={{
                            background: "#047857",
                            color: "white",
                            border: "none",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Enroll →
                        </button>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#047857", fontWeight: 700 }}>
                          Enrolled
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* MODAL: ADD NEW INQUIRY */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                New Admission Inquiry / Lead
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yash Raj"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    placeholder="Father/Mother name"
                    value={newGuardianName}
                    onChange={(e) => setNewGuardianName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Parent Contact
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={newGuardianPhone}
                    onChange={(e) => setNewGuardianPhone(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Target Exam
                  </label>
                  <select
                    value={newTargetExam}
                    onChange={(e) => setNewTargetExam(e.target.value as TargetExam)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                  >
                    <option value="JEE_ADVANCED">JEE Advanced</option>
                    <option value="JEE_MAIN">JEE Main</option>
                    <option value="NEET">NEET Medical</option>
                    <option value="FOUNDATION">Foundation (9-10)</option>
                    <option value="BOARDS">Boards / State</option>
                    <option value="OTHER">Other Exams</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Inquiry Source
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as LeadSource)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                  >
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Quoted / Est. Course Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={newEstimatedFee}
                    onChange={(e) => setNewEstimatedFee(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={newFollowUp}
                    onChange={(e) => setNewFollowUp(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Counsellor Discussion Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record student previous marks, parent preferences, trial class timings..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Admission Inquiry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONVERT LEAD TO STUDENT */}
      {convertingLead && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: "500px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              🎓 Convert Lead to Enrolled Student
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>
              Admitting <strong>{convertingLead.name}</strong> into official institute roster. This safely links the inquiry and prevents accidental duplicate admissions.
            </p>

            {conversionSuccessMsg ? (
              <div
                style={{
                  padding: "16px",
                  background: "#ecfdf5",
                  border: "1px solid #10b981",
                  borderRadius: "10px",
                  color: "#065f46",
                  fontWeight: 600,
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                {conversionSuccessMsg}
              </div>
            ) : (
              <form onSubmit={confirmConversion} style={{ display: "grid", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Student Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={conversionRoll}
                    onChange={(e) => setConversionRoll(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Assign Target Batch *
                  </label>
                  <select
                    value={conversionBatch}
                    onChange={(e) => setConversionBatch(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                  >
                    {mockBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.targetExam})
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    padding: "12px",
                    background: "#f8fafc",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#334155",
                  }}
                >
                  <div><strong>Student Name:</strong> {convertingLead.name}</div>
                  <div><strong>Phone:</strong> {convertingLead.phone}</div>
                  <div><strong>Parent Phone:</strong> {convertingLead.guardianPhone || convertingLead.phone}</div>
                  <div><strong>Agreed Course Fee:</strong> ₹{(convertingLead.estimatedFee || 0).toLocaleString("en-IN")}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <Button variant="outline" type="button" onClick={() => setConvertingLead(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Confirm Admission & Issue Roll Number
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
