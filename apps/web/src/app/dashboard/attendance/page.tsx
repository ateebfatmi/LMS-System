"use client";

import { useActiveOrganizationId } from "@/lib/client-org";

import { useState, useEffect } from "react";
import { Badge, Button, DatePicker, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { AttendanceStatus, NotificationDispatchLog, Batch } from "@prepzii/contracts";

interface RegisterRecord {
  studentId: string;
  studentName: string;
  rollNumber: string;
  parentPhone: string;
  status: AttendanceStatus;
  remarks?: string;
}

export default function AttendancePage() {
  const activeOrganizationId = useActiveOrganizationId();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [activeTab, setActiveTab] = useState<"REGISTER" | "DISPATCHER" | "LOGS">("REGISTER");

  // Server state
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<RegisterRecord[]>([]);
  const [logs, setLogs] = useState<NotificationDispatchLog[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Dispatch Modal State
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [selectedTemplate, setSelectedTemplate] = useState<"ABSENT" | "LATE" | "PTM" | "NOTICE">("ABSENT");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/batches").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      if (!cancelled) {
        setBatches(result.batches || []);
        setSelectedBatch(result.batches?.[0]?.id || "");
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [activeOrganizationId]);

  // 1. Fetch real register for selected batch and date
  useEffect(() => {
    async function loadRegister() {
      if (!selectedBatch) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/attendance?batchId=${selectedBatch}&date=${attendanceDate}`);
        if (res.ok) {
          const data = await res.json();
          setRecords(data.records || []);
        }
      } catch (err) {
        console.error("Failed to load attendance register:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRegister();
  }, [selectedBatch, attendanceDate, activeOrganizationId]);

  // 2. Fetch logs when tab changes to LOGS
  useEffect(() => {
    if (activeTab === "LOGS") {
      fetch("/api/attendance?type=LOGS")
        .then((res) => res.json())
        .then((data) => setLogs(data.logs || []))
        .catch(console.error);
    }
  }, [activeTab, activeOrganizationId]);

  // Toggle status: PRESENT -> ABSENT -> LATE -> EXCUSED -> PRESENT
  const toggleStatus = (studentId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        let next: AttendanceStatus = "PRESENT";
        if (r.status === "PRESENT") next = "ABSENT";
        else if (r.status === "ABSENT") next = "LATE";
        else if (r.status === "LATE") next = "EXCUSED";
        else if (r.status === "EXCUSED") next = "PRESENT";
        return { ...r, status: next };
      })
    );
  };

  const markAllPresent = () => {
    setRecords((prev) => prev.map((r) => ({ ...r, status: "PRESENT" })));
  };

  // Metrics
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const excusedCount = records.filter((r) => r.status === "EXCUSED").length;
  const total = records.length || 1;
  const attendanceRate = Math.round(((presentCount + lateCount * 0.5 + excusedCount) / total) * 1000) / 10;

  // Save register to server
  const handleSaveRegister = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: selectedBatch,
          sessionDate: attendanceDate,
          records,
        }),
      });

      if (res.ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to save register:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendParentAlerts = async () => {
    await handleSaveRegister();
    setShowNotifyModal(false);
    // Reload logs
    const logRes = await fetch("/api/attendance?type=LOGS");
    if (logRes.ok) {
      const data = await logRes.json();
      setLogs(data.logs || []);
    }
  };

  return (
    <DashboardLayout
      title="Daily Attendance & Parent Automation"
      subtitle="Mark class attendance, trigger automated morning parent alerts via WhatsApp & SMS, and track delivery logs"
      action={
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" onClick={handleSaveRegister} disabled={isSaving}>
            {isSaved ? "✓ Register Saved" : isSaving ? "Saving..." : "💾 Save Register"}
          </Button>
          <Button variant="primary" onClick={() => setShowNotifyModal(true)}>
            ⚡ Dispatch Parent Alerts
          </Button>
        </div>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Today's Present" value={`${presentCount} / ${total}`} detail={`${attendanceRate}% effective attendance`} accent="green" />
        <MetricCard label="Absentees Pending Alert" value={String(absentCount)} detail="Parents auto-queued" accent="orange" />
        <MetricCard label="Late Arrivals" value={String(lateCount)} detail="Late slip queued" accent="blue" />
        <MetricCard label="Excused" value={String(excusedCount)} detail="Medical / Leave slip" accent="yellow" />
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        <button
          onClick={() => setActiveTab("REGISTER")}
          className={`tab-link ${activeTab === "REGISTER" ? "active" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          📋 Attendance Register
        </button>
        <button
          onClick={() => setActiveTab("DISPATCHER")}
          className={`tab-link ${activeTab === "DISPATCHER" ? "active" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          📱 WhatsApp / SMS Dispatcher
        </button>
        <button
          onClick={() => setActiveTab("LOGS")}
          className={`tab-link ${activeTab === "LOGS" ? "active" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          📜 Parent Delivery Logs
        </button>
      </div>

      {/* --- TAB 1: ATTENDANCE REGISTER --- */}
      {activeTab === "REGISTER" && (
        <>
          <div className="filter-bar">
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Select Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="select-input"
                  style={{ minWidth: "220px" }}
                >
                  {batches.length === 0 && <option value="">No batches available</option>}
                  {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Attendance Date
                </label>
                <DatePicker
                  value={attendanceDate}
                  onChange={(val) => setAttendanceDate(val)}
                  style={{ width: "200px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" onClick={markAllPresent}>
                ✓ Mark All Present
              </Button>
              <Button variant="primary" onClick={handleSaveRegister} disabled={isSaving}>
                {isSaved ? "✓ Saved" : "💾 Save Changes"}
              </Button>
            </div>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Status (Click to toggle)</th>
                  <th>Parent Contact</th>
                  <th>Automation Queue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      Loading attendance register...
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.studentId}>
                      <td>
                        <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          {r.rollNumber}
                        </code>
                      </td>
                      <td>
                        <strong>{r.studentName}</strong>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleStatus(r.studentId)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            border: "none",
                            background:
                              r.status === "PRESENT"
                                ? "#22c55e"
                                : r.status === "ABSENT"
                                ? "#ef4444"
                                : r.status === "LATE"
                                ? "#f59e0b"
                                : "#8b5cf6",
                            color: "white",
                          }}
                        >
                          {r.status === "PRESENT" && "✓ Present"}
                          {r.status === "ABSENT" && "✕ Absent"}
                          {r.status === "LATE" && "⏱ Late"}
                          {r.status === "EXCUSED" && "✉ Excused"}
                        </button>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                          {r.parentPhone}
                        </span>
                      </td>
                      <td>
                        {r.status === "ABSENT" ? (
                          <Badge variant="warning" size="sm">Auto-Queued WhatsApp</Badge>
                        ) : r.status === "LATE" ? (
                          <Badge variant="info" size="sm">Late Slip Queued</Badge>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --- TAB 2: WHATSAPP / SMS DISPATCHER --- */}
      {activeTab === "DISPATCHER" && (
        <div className="card-grid-2">
          <Panel title="Automated Notice Dispatcher">
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Notice Template Category
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value as typeof selectedTemplate)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  <option value="ABSENT">🚨 Morning Absence Alert (Immediate)</option>
                  <option value="LATE">⏰ Late Arrival Notification</option>
                  <option value="PTM">📊 PTM Test Result & Rank Card</option>
                  <option value="NOTICE">📢 General Institute Announcement</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Delivery Channel
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="channel"
                      checked={selectedChannel === "WHATSAPP"}
                      onChange={() => setSelectedChannel("WHATSAPP")}
                    />
                    💬 WhatsApp Business API (High Open Rate)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="channel"
                      checked={selectedChannel === "SMS"}
                      onChange={() => setSelectedChannel("SMS")}
                    />
                    📩 DLT Verified SMS Gateway
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Live Message Preview (Rendered Template)
                </label>
                <div style={{ padding: "14px", background: "#f8fafc", border: "1px solid var(--line)", borderRadius: "10px", fontSize: "13px", lineHeight: "1.6" }}>
                  {selectedTemplate === "ABSENT" && (
                    <p style={{ margin: 0 }}>
                      &ldquo;Dear Parent, <strong>Aarav Sharma</strong> was marked <strong>ABSENT</strong> for lectures at <strong>Apex Academy</strong> on {attendanceDate}. Please contact institute if unexpected.&rdquo;
                    </p>
                  )}
                  {selectedTemplate === "LATE" && (
                    <p style={{ margin: 0 }}>
                      &ldquo;Dear Parent, <strong>Aarav Sharma</strong> arrived 20 minutes LATE for class today on {attendanceDate}.&rdquo;
                    </p>
                  )}
                  {selectedTemplate === "PTM" && (
                    <p style={{ margin: 0 }}>
                      &ldquo;Dear Parent, All India Mock Test 04 score for <strong>Aarav Sharma</strong> is published. Batch Rank: #2, Score: 156/180 (98.5%ile).&rdquo;
                    </p>
                  )}
                  {selectedTemplate === "NOTICE" && (
                    <p style={{ margin: 0 }}>
                      &ldquo;Dear Parent, Institute will remain closed on Tuesday for celebrations. Regular classes resume Wednesday.&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <Button variant="primary" onClick={handleSendParentAlerts} style={{ marginTop: "10px" }}>
                🚀 Dispatch Alerts & Save Register
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 3: NOTIFICATION DELIVERY LOGS --- */}
      {activeTab === "LOGS" && (
        <Panel title="Parent Notice Dispatch & Delivery Logs">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Recipient Name</th>
                  <th>Parent Phone</th>
                  <th>Channel</th>
                  <th>Notice Template</th>
                  <th>Message Preview</th>
                  <th>Provider Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      No dispatched notifications recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td>
                        <strong>{log.recipientName}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: "11px" }}>{log.recipientPhone}</code>
                      </td>
                      <td>
                        <Badge variant={log.channel === "WHATSAPP" ? "success" : "info"} size="sm">
                          {log.channel === "WHATSAPP" ? "💬 WhatsApp" : "📩 SMS"}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontWeight: 600 }}>{log.templateKey}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.renderedContent}
                        </div>
                      </td>
                      <td>
                        <Badge variant={log.status === "DELIVERED" ? "success" : "brand"} size="sm">
                          {log.status} ({log.provider})
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* --- DISPATCH MODAL --- */}
      {showNotifyModal && (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                ⚡ Dispatch Parent Attendance Alerts
              </h2>
              <button
                onClick={() => setShowNotifyModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gap: "14px" }}>
              <div style={{ padding: "14px", background: "#fffdf2", border: "1px solid var(--cream-border)", borderRadius: "10px" }}>
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Alert Queue Summary:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "12px", color: "var(--muted)" }}>
                  <li><strong>{absentCount} Absentees</strong> queued for morning absence warning</li>
                  <li><strong>{lateCount} Late Students</strong> queued for late arrival notice</li>
                  <li>Batch: <strong>{batches.find((batch) => batch.id === selectedBatch)?.name || "No batch selected"}</strong></li>
                </ul>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Delivery Channel
                </label>
                <div style={{ display: "flex", gap: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="modalChannel"
                      checked={selectedChannel === "WHATSAPP"}
                      onChange={() => setSelectedChannel("WHATSAPP")}
                    />
                    💬 WhatsApp API
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="modalChannel"
                      checked={selectedChannel === "SMS"}
                      onChange={() => setSelectedChannel("SMS")}
                    />
                    📩 Telecom SMS
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
                <Button variant="secondary" onClick={() => setShowNotifyModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSendParentAlerts}>
                  🚀 Confirm & Send ({absentCount + lateCount} Alerts)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
