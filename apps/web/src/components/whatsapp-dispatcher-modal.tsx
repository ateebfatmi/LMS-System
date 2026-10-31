"use client";

import { useState } from "react";
import { Badge, Button, Select } from "@prepzii/ui";

export interface RecipientTarget {
  studentId: string;
  studentName: string;
  parentPhone: string;
  batchName: string;
  scoreOrDetail?: string;
}

export interface DispatcherLogItem {
  id: string;
  studentName: string;
  parentPhone: string;
  batchName: string;
  type: string;
  channel: string;
  messageText: string;
  status: string;
  sentAt: string;
}

export interface WhatsAppDispatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: RecipientTarget[];
  defaultTemplate?: "ABSENT_ALERT" | "LOW_SCORE_WARNING" | "PTM_RANK_CARD" | "GENERAL_NOTICE";
  onAlertsSent?: (logs: DispatcherLogItem[]) => void;
}

export function WhatsAppDispatcherModal({
  isOpen,
  onClose,
  recipients,
  defaultTemplate = "ABSENT_ALERT",
  onAlertsSent,
}: WhatsAppDispatcherModalProps) {
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [template, setTemplate] = useState<
    "ABSENT_ALERT" | "LOW_SCORE_WARNING" | "PTM_RANK_CARD" | "GENERAL_NOTICE"
  >(defaultTemplate);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    recipients.map((r) => r.studentId)
  );

  const [customNoticeText, setCustomNoticeText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === recipients.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(recipients.map((r) => r.studentId));
    }
  };

  const formatMessageForStudent = (target: RecipientTarget) => {
    if (template === "ABSENT_ALERT") {
      return `Dear Parent, ${target.studentName} was marked ABSENT for today's class (${target.batchName}) at Apex JEE & NEET Academy. Please contact institute if unexpected.`;
    }
    if (template === "LOW_SCORE_WARNING") {
      return `Dear Parent, ${target.studentName} scored ${target.scoreOrDetail || "<50%"} in recent PrepZii CBT Mock Test (${target.batchName}). A special doubt & revision session is scheduled.`;
    }
    if (template === "PTM_RANK_CARD") {
      return `Dear Parent, Mock Test report card for ${target.studentName} (${target.batchName}) is now published. ${target.scoreOrDetail || "Rank Card Available"}. View report on PrepZii Parent Portal.`;
    }
    return customNoticeText || `Important Announcement for ${target.studentName} (${target.batchName}) from Apex JEE & NEET Academy.`;
  };

  const handleSendDispatch = () => {
    if (selectedStudentIds.length === 0) return;

    setIsSending(true);
    setSendProgress(20);

    const activeRecipients = recipients.filter((r) => selectedStudentIds.includes(r.studentId));

    const newLogs = activeRecipients.map((r, idx) => ({
      id: `notif-live-${Date.now()}-${idx}`,
      studentName: r.studentName,
      parentPhone: r.parentPhone,
      batchName: r.batchName,
      type: template,
      channel: channel,
      messageText: formatMessageForStudent(r),
      status: "READ",
      sentAt: "Just now",
    }));

    setTimeout(() => {
      setSendProgress(70);
    }, 500);

    setTimeout(() => {
      setSendProgress(100);
      setIsSending(false);
      setSentSuccess(true);

      if (onAlertsSent) {
        onAlertsSent(newLogs);
      }

      setTimeout(() => {
        setSentSuccess(false);
        setSendProgress(0);
        onClose();
      }, 1200);
    }, 1100);
  };

  const previewTarget = recipients.find((r) => selectedStudentIds.includes(r.studentId)) || recipients[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "820px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid var(--line)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontFamily: "var(--font-display)" }}>
                Instant Parent Alert Dispatcher
              </h2>
              <Badge variant="brand" size="sm">WHATSAPP API</Badge>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Send verified WhatsApp or SMS notifications to parents of selected students
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "20px",
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Dispatch Options Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "18px", marginBottom: "20px" }}>
          {/* Left: Template & Channel Config */}
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
              1. Select Dispatch Channel:
            </label>
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setChannel("WHATSAPP")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: channel === "WHATSAPP" ? "2px solid #25D366" : "1px solid var(--line)",
                  background: channel === "WHATSAPP" ? "#f0fdf4" : "#ffffff",
                  color: channel === "WHATSAPP" ? "#166534" : "var(--muted)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                💬 WhatsApp Business API
              </button>
              <button
                type="button"
                onClick={() => setChannel("SMS")}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: channel === "SMS" ? "2px solid #3b82f6" : "1px solid var(--line)",
                  background: channel === "SMS" ? "#eff6ff" : "#ffffff",
                  color: channel === "SMS" ? "#1e40af" : "var(--muted)",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                📱 SMS Gateway (DLT)
              </button>
            </div>

            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
              2. Select Message Template:
            </label>
            <Select
              value={template}
              onChange={(val) => setTemplate(val as "ABSENT_ALERT" | "LOW_SCORE_WARNING" | "PTM_RANK_CARD" | "GENERAL_NOTICE")}
              style={{ marginBottom: "16px" }}
            >
              <option value="ABSENT_ALERT">🚨 Absent Alert Notice</option>
              <option value="LOW_SCORE_WARNING">📉 Low Test Score Alert (&lt;50%)</option>
              <option value="PTM_RANK_CARD">📊 Rank Card & Score Card Release</option>
              <option value="GENERAL_NOTICE">📢 Custom Institute Announcement</option>
            </Select>

            {template === "GENERAL_NOTICE" && (
              <textarea
                placeholder="Type custom notification text for parents..."
                value={customNoticeText}
                onChange={(e) => setCustomNoticeText(e.target.value)}
                style={{
                  width: "100%",
                  height: "80px",
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                }}
              />
            )}
          </div>

          {/* Right: Message Live Mobile Preview Box */}
          <div
            style={{
              background: "#efeae2",
              borderRadius: "16px",
              padding: "16px",
              border: "1px solid #cbd5e1",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>
                Live {channel === "WHATSAPP" ? "WhatsApp" : "SMS"} Preview
              </span>
              <Badge variant="success" size="sm">VERIFIED TEMPLATE</Badge>
            </div>

            <div
              style={{
                background: "#ffffff",
                padding: "12px 14px",
                borderRadius: "12px 12px 12px 2px",
                fontSize: "12px",
                lineHeight: "1.5",
                color: "#1e293b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#25D366", marginBottom: "4px" }}>
                Apex JEE & NEET Academy · Official Notice
              </div>
              {previewTarget ? formatMessageForStudent(previewTarget) : "Select a target student..."}
              <div style={{ textAlign: "right", fontSize: "10px", color: "#94a3b8", marginTop: "6px" }}>
                Just now • Sent via PrepZii
              </div>
            </div>

            {previewTarget && channel === "WHATSAPP" && (
              <a
                href={`https://wa.me/${previewTarget.parentPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                  formatMessageForStudent(previewTarget)
                )}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: "12px",
                  width: "100%",
                  textAlign: "center",
                  background: "#25D366",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "12px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                ↗ Launch Direct WhatsApp to {previewTarget.studentName}&apos;s Parent
              </a>
            )}
          </div>
        </div>

        {/* Student Target List */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700 }}>
              Select Recipient Parents ({selectedStudentIds.length} of {recipients.length} Selected)
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              style={{
                fontSize: "12px",
                color: "#2563eb",
                background: "none",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {selectedStudentIds.length === recipients.length ? "Deselect All" : "Select All Target Parents"}
            </button>
          </div>

          <div
            style={{
              maxHeight: "160px",
              overflowY: "auto",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "6px",
            }}
          >
            {recipients.map((r) => {
              const isChecked = selectedStudentIds.includes(r.studentId);
              return (
                <div
                  key={r.studentId}
                  onClick={() => toggleStudent(r.studentId)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: isChecked ? "#f0fdf4" : "transparent",
                    cursor: "pointer",
                    marginBottom: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {}} />
                    <div>
                      <strong style={{ fontSize: "13px" }}>{r.studentName}</strong>
                      <span style={{ fontSize: "11px", color: "var(--muted)", marginLeft: "8px" }}>
                        ({r.batchName})
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    📱 Parent: {r.parentPhone} {r.scoreOrDetail ? `• ${r.scoreOrDetail}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar */}
        {isSending && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
              <span>Dispatching {selectedStudentIds.length} Alerts via {channel}...</span>
              <span>{sendProgress}%</span>
            </div>
            <div style={{ height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${sendProgress}%`,
                  background: "#25D366",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {sentSuccess && (
          <div
            style={{
              padding: "12px",
              borderRadius: "10px",
              background: "#ecfdf5",
              color: "#166534",
              fontWeight: 700,
              fontSize: "13px",
              textAlign: "center",
              marginBottom: "16px",
            }}
          >
            ✓ Successfully dispatched {selectedStudentIds.length} parent alerts!
          </div>
        )}

        {/* Action Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            disabled={selectedStudentIds.length === 0 || isSending}
            onClick={handleSendDispatch}
          >
            🚀 Dispatch {selectedStudentIds.length} Alerts
          </Button>
        </div>
      </div>
    </div>
  );
}
