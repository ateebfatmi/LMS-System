"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockStudents, mockLeads, mockCampusRooms } from "@/lib/mock-data";

export default function OfficePage() {
  const [quickSearch, setQuickSearch] = useState("");
  const [cashierAmount, setCashierAmount] = useState("45000");
  const [cashierMode, setCashierMode] = useState("UPI");
  const [receiptGenerated, setReceiptGenerated] = useState<string | null>(null);

  const pendingLeads = mockLeads.filter((l) => l.stage !== "CONVERTED" && l.stage !== "LOST");
  const availableRooms = mockCampusRooms.filter((r) => r.status === "AVAILABLE");

  const searchResults = mockStudents.filter(
    (s) =>
      s.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(quickSearch.toLowerCase()) ||
      s.phone.includes(quickSearch),
  );

  const handleGenerateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const receiptNo = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setReceiptGenerated(receiptNo);
  };

  return (
    <DashboardLayout
      title="Front Desk & Back-Office Operations"
      subtitle="Fast-path counter for student admissions, fee cashier, visitor logs, and daily timetable dispatch"
      action={
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/dashboard" className="pz-button pz-button-outline" style={{ textDecoration: "none" }}>
            ← Executive Dashboard
          </Link>
          <Link href="/dashboard/crm" className="pz-button pz-button-primary" style={{ textDecoration: "none" }}>
            ＋ New Walk-in Admission
          </Link>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="metrics-grid">
        <MetricCard label="Today's Walk-in Inquiries" value={String(pendingLeads.length)} detail="Pending counselling" accent="yellow" />
        <MetricCard label="Cashier Collections Today" value="₹2,45,000" detail="6 installments logged" accent="green" />
        <MetricCard label="Available Classrooms" value={`${availableRooms.length} of ${mockCampusRooms.length}`} detail="North Campus" accent="navy" />
        <MetricCard label="Active Roster Enrolled" value={String(mockStudents.length)} detail="Official students" accent="orange" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", marginBottom: "24px" }}>
        {/* Fast Student / Roll Lookup */}
        <Panel title="Instant Student & Fee Dues Lookup">
          <div style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="🔍 Type Roll Number, Student Name, or Mobile Number..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid var(--line)",
                fontSize: "14px",
                outline: "none",
                background: "#f8fafc",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            {(quickSearch ? searchResults : mockStudents.slice(0, 4)).map((std) => (
              <div
                key={std.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 18px",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  background: "white",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "14px" }}>{std.name}</strong>
                    <Badge variant="brand" size="sm">
                      {std.rollNumber}
                    </Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                    {std.batchName} · Contact: {std.phone}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>Attendance</span>
                    <strong style={{ fontSize: "13px", color: "#047857" }}>{std.attendancePercentage}%</strong>
                  </div>
                  <Link
                    href={`/dashboard/fees`}
                    style={{
                      background: "#f1f5f9",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#334155",
                      textDecoration: "none",
                    }}
                  >
                    Collect Fee →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Counter Cashier & Receipt Generator */}
        <Panel title="Front Desk Cashier">
          {receiptGenerated ? (
            <div
              style={{
                padding: "24px",
                background: "#ecfdf5",
                border: "1px solid #10b981",
                borderRadius: "14px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧾</div>
              <strong style={{ fontSize: "16px", color: "#065f46", display: "block", marginBottom: "4px" }}>
                Receipt Issued: {receiptGenerated}
              </strong>
              <p style={{ fontSize: "13px", color: "#047857", margin: "0 0 16px" }}>
                Payment of ₹{Number(cashierAmount).toLocaleString("en-IN")} recorded via {cashierMode}.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <Button variant="primary" onClick={() => setReceiptGenerated(null)}>
                  New Transaction
                </Button>
                <button
                  type="button"
                  className="pz-button pz-button-outline"
                  onClick={() => alert(`Printing official counter tax receipt ${receiptGenerated}...`)}
                >
                  🖨 Print Receipt
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerateReceipt} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Select Student
                </label>
                <select
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid var(--line)",
                    fontSize: "13px",
                    background: "white",
                  }}
                >
                  {mockStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNumber}) — {s.batchName}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={cashierAmount}
                    onChange={(e) => setCashierAmount(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Payment Mode
                  </label>
                  <select
                    value={cashierMode}
                    onChange={(e) => setCashierMode(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CASH">Cash at Counter</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="NET_BANKING">Net Banking NEFT</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Installment Title
                </label>
                <input
                  type="text"
                  defaultValue="2nd Installment - Academic Term 2"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              <Button variant="primary" type="submit" style={{ width: "100%", padding: "12px", marginTop: "4px" }}>
                ✓ Log Offline Payment & Print Receipt
              </Button>
            </form>
          )}
        </Panel>
      </div>

      {/* Quick Links Grid for Office Operations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        <Link
          href="/dashboard/crm"
          style={{
            padding: "20px",
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "28px" }}>◎</div>
          <div>
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Admissions CRM</strong>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              {pendingLeads.length} leads in counselling pipeline
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/fees"
          style={{
            padding: "20px",
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "28px" }}>₹</div>
          <div>
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Fee Ledger & Dues</strong>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              Audit installment collection reports
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/campuses"
          style={{
            padding: "20px",
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "28px" }}>🏛</div>
          <div>
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Campus Classrooms</strong>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              Smart board & lab allocations
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/announcements"
          style={{
            padding: "20px",
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: "16px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "28px" }}>🔔</div>
          <div>
            <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Notice Board</strong>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
              Broadcast WhatsApp alerts to parents
            </div>
          </div>
        </Link>
      </div>
    </DashboardLayout>
  );
}
