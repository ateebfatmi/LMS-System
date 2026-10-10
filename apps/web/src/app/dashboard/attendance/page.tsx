"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockStudents } from "@/lib/mock-data";

export interface ParentNotificationLog {
  id: string;
  studentName: string;
  parentPhone: string;
  batchName: string;
  type: "ABSENT_ALERT" | "LATE_WARNING" | "PTM_SCORES" | "ANNOUNCEMENT";
  channel: "WHATSAPP" | "SMS";
  messageText: string;
  status: "DELIVERED" | "READ" | "SENT" | "FAILED";
  sentAt: string;
}

const mockLogs: ParentNotificationLog[] = [
  {
    id: "notif-1",
    studentName: "Rohan Verma",
    parentPhone: "+91 98765 43221",
    batchName: "JEE 11B - Nucleus",
    type: "ABSENT_ALERT",
    channel: "WHATSAPP",
    messageText: "Dear Parent, Rohan Verma was marked ABSENT for 09:00 AM Physics class at Apex Academy today (10 Oct). Please contact institute if unexpected.",
    status: "READ",
    sentAt: "Today, 09:15 AM",
  },
  {
    id: "notif-2",
    studentName: "Kabir Sengupta",
    parentPhone: "+91 98765 43223",
    batchName: "Foundation 10",
    type: "LATE_WARNING",
    channel: "SMS",
    messageText: "Dear Parent, Kabir Sengupta arrived 20 minutes LATE for class today. Late slip issued.",
    status: "DELIVERED",
    sentAt: "Today, 09:25 AM",
  },
  {
    id: "notif-3",
    studentName: "Isha Patel",
    parentPhone: "+91 98765 43220",
    batchName: "JEE 12A - Titans",
    type: "PTM_SCORES",
    channel: "WHATSAPP",
    messageText: "Dear Parent, Mock Test 04 result for Isha Patel is published. Rank: #1 in Batch, Score: 168/180 (93.3%). Download report card on PrepZii portal.",
    status: "READ",
    sentAt: "Yesterday, 06:30 PM",
  },
];

export default function AttendancePage() {
  const [selectedBatch, setSelectedBatch] = useState("batch-1");
  const [attendanceDate, setAttendanceDate] = useState("2026-10-10");
  const [activeTab, setActiveTab] = useState<"REGISTER" | "DISPATCHER" | "LOGS">("REGISTER");

  // Dispatch Modal State
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [selectedTemplate, setSelectedTemplate] = useState<"ABSENT" | "LATE" | "PTM" | "NOTICE">("ABSENT");
  const [logs, setLogs] = useState<ParentNotificationLog[]>(mockLogs);

  const batchStudents = mockStudents.filter(
    (s) => s.batchId === selectedBatch || selectedBatch === "ALL"
  );

  const [studentStatus, setStudentStatus] = useState<Record<string, "PRESENT" | "ABSENT" | "LATE">>(
    Object.fromEntries(batchStudents.map((s) => [s.id, s.id === "std-3" ? "ABSENT" : "PRESENT"]))
  );

  const [isSubmitted, setIsSubmitted] = useState(false);

  const toggleStatus = (id: string) => {
    const current = studentStatus[id] || "PRESENT";
    const next = current === "PRESENT" ? "ABSENT" : current === "ABSENT" ? "LATE" : "PRESENT";
    setStudentStatus((prev) => ({ ...prev, [id]: next }));
  };

  const markAllPresent = () => {
    setStudentStatus(Object.fromEntries(batchStudents.map((s) => [s.id, "PRESENT"])));
  };

  const presentCount = Object.values(studentStatus).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(studentStatus).filter((s) => s === "ABSENT").length;
  const lateCount = Object.values(studentStatus).filter((s) => s === "LATE").length;
  const total = batchStudents.length || 1;
  const attendanceRate = Math.round((presentCount / total) * 1000) / 10;

  const handleSendParentAlerts = () => {
    // Generate notification logs for absent & late students
    const newAlerts: ParentNotificationLog[] = batchStudents
      .filter((s) => studentStatus[s.id] === "ABSENT" || studentStatus[s.id] === "LATE")
      .map((s, idx) => ({
        id: `notif-new-${Date.now()}-${idx}`,
        studentName: s.name,
        parentPhone: s.parentPhone,
        batchName: s.batchName,
        type: studentStatus[s.id] === "ABSENT" ? "ABSENT_ALERT" : "LATE_WARNING",
        channel: selectedChannel,
        messageText:
          studentStatus[s.id] === "ABSENT"
            ? `Dear Parent, ${s.name} was marked ABSENT for morning lecture at Apex Academy on ${attendanceDate}. Please contact institute.`
            : `Dear Parent, ${s.name} arrived LATE for class on ${attendanceDate}.`,
        status: "DELIVERED",
        sentAt: "Just now",
      }));

    setLogs([...newAlerts, ...logs]);
    setShowNotifyModal(false);
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 4000);
  };

  return (
    <DashboardLayout
      title="Daily Attendance & Parent Automation"
      subtitle="Mark class attendance, trigger automated morning parent alerts via WhatsApp & SMS, and track delivery logs"
      action={
        <Button
          variant="primary"
          onClick={() => setShowNotifyModal(true)}
        >
          {isSubmitted ? "✓ Alerts Dispatched!" : "⚡ Dispatch Parent Alerts"}
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Today's Present" value={`${presentCount} / ${total}`} detail={`${attendanceRate}% batch attendance`} accent="green" />
        <MetricCard label="Absentees Pending Alert" value={String(absentCount)} detail="Parents auto-queued" accent="orange" />
        <MetricCard label="Late Arrivals" value={String(lateCount)} detail="Slip issued" accent="blue" />
        <MetricCard label="Parent Delivery Rate" value="99.4%" detail="WhatsApp & SMS gateway" accent="yellow" />
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
          📜 Parent Delivery Logs ({logs.length})
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
                  <option value="batch-1">JEE 12A - Titans</option>
                  <option value="batch-2">JEE 11B - Nucleus</option>
                  <option value="batch-3">NEET 12 - Medico Super 50</option>
                  <option value="batch-4">Foundation 10 - Olympiad</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="search-input"
                  style={{ height: "40px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button variant="secondary" onClick={markAllPresent}>
                ✓ Mark All Present
              </Button>
              <Button variant="primary" onClick={() => setShowNotifyModal(true)}>
                🚀 Notify {absentCount + lateCount} Parents
              </Button>
            </div>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Attendance %</th>
                  <th>Status (Click to toggle)</th>
                  <th>Parent Contact</th>
                  <th>Auto-SMS Action</th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.map((student) => {
                  const status = studentStatus[student.id] || "PRESENT";
                  return (
                    <tr key={student.id}>
                      <td>
                        <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          {student.rollNumber}
                        </code>
                      </td>
                      <td>
                        <strong>{student.name}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: student.attendancePercentage >= 90 ? "var(--green)" : "var(--orange)" }}>
                          {student.attendancePercentage}%
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleStatus(student.id)}
                          className={`attendance-toggle-btn ${status.toLowerCase()}`}
                        >
                          {status === "PRESENT" && "✓ Present"}
                          {status === "ABSENT" && "✕ Absent"}
                          {status === "LATE" && "⏱ Late"}
                        </button>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                          {student.parentPhone}
                        </span>
                      </td>
                      <td>
                        {status === "ABSENT" ? (
                          <Badge variant="warning" size="sm">Auto-Queued WhatsApp</Badge>
                        ) : status === "LATE" ? (
                          <Badge variant="info" size="sm">Late Slip Sent</Badge>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                  onChange={(e) => setSelectedTemplate(e.target.value as any)}
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
                      "Dear Parent, <strong>Aarav Sharma</strong> was marked <strong>ABSENT</strong> for morning lecture at <strong>Apex Academy</strong> on {attendanceDate}. Please contact institute if unexpected."
                    </p>
                  )}
                  {selectedTemplate === "LATE" && (
                    <p style={{ margin: 0 }}>
                      "Dear Parent, <strong>Aarav Sharma</strong> arrived 20 minutes LATE for class today on {attendanceDate}."
                    </p>
                  )}
                  {selectedTemplate === "PTM" && (
                    <p style={{ margin: 0 }}>
                      "Dear Parent, All India Mock Test 04 score for <strong>Aarav Sharma</strong> is published. Batch Rank: #2, Score: 156/180 (98.5%ile)."
                    </p>
                  )}
                  {selectedTemplate === "NOTICE" && (
                    <p style={{ margin: 0 }}>
                      "Dear Parent, Institute will remain closed on Tuesday for Diwali celebrations. Regular classes resume Wednesday."
                    </p>
                  )}
                </div>
              </div>

              <Button variant="primary" onClick={handleSendParentAlerts} style={{ marginTop: "10px" }}>
                🚀 Send Bulk Message to Selected Parents
              </Button>
            </div>
          </Panel>

          <Panel title="Delivery Channel Performance">
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ padding: "16px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <strong style={{ color: "#047857" }}>WhatsApp Business Gateway</strong>
                  <Badge variant="success" size="sm">Connected · Live</Badge>
                </div>
                <div style={{ fontSize: "12px", color: "#047857" }}>
                  Delivery Rate: <strong>99.8%</strong> · Read Rate: <strong>94.2%</strong>
                </div>
              </div>

              <div style={{ padding: "16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <strong style={{ color: "#1d4ed8" }}>DLT Telecom SMS Gateway</strong>
                  <Badge variant="info" size="sm">Active · DLT Approved</Badge>
                </div>
                <div style={{ fontSize: "12px", color: "#1d4ed8" }}>
                  Delivery Rate: <strong>98.9%</strong> · Backup route active
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* --- TAB 3: LOGS --- */}
      {activeTab === "LOGS" && (
        <Panel title="Real-time Parent Notification Delivery Logs">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time Sent</th>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Parent Phone</th>
                  <th>Channel</th>
                  <th>Message Body</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{log.sentAt}</span>
                    </td>
                    <td>
                      <strong>{log.studentName}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>{log.batchName}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: "11px" }}>{log.parentPhone}</code>
                    </td>
                    <td>
                      <Badge variant={log.channel === "WHATSAPP" ? "success" : "info"} size="sm">
                        {log.channel === "WHATSAPP" ? "💬 WhatsApp" : "📩 SMS"}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.messageText}
                      </div>
                    </td>
                    <td>
                      <Badge variant={log.status === "READ" ? "brand" : log.status === "DELIVERED" ? "success" : "neutral"} size="sm">
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
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
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Alert Summary:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "12px", color: "var(--muted)" }}>
                  <li><strong>{absentCount} Absentees</strong> queued for morning absence warning</li>
                  <li><strong>{lateCount} Late Students</strong> queued for late arrival slip</li>
                  <li>Batch: <strong>{selectedBatch === "batch-1" ? "JEE 12A Titans" : "Selected Batch"}</strong></li>
                </ul>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Select Delivery Channel
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
