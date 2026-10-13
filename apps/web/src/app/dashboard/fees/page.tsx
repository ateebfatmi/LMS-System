"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout, type AppRole } from "@/components/dashboard-layout";
import { mockStudentFees, mockFeeTransactions } from "@/lib/mock-data";
import type { StudentFeeRecord, FeeTransaction, FeePaymentMethod } from "@prepzii/contracts";

function FeesContent() {
  const searchParams = useSearchParams();
  const currentRole = (searchParams?.get("role") as AppRole) || "DIRECTOR";

  const [feeRecords, setFeeRecords] = useState<StudentFeeRecord[]>(mockStudentFees);
  const [transactions, setTransactions] = useState<FeeTransaction[]>(mockFeeTransactions);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"ALL" | "OVERDUE" | "PARTIAL" | "PAID">("ALL");
  const [activeTab, setActiveTab] = useState<"LEDGER" | "TRANSACTIONS" | "COLLECTIONS">("LEDGER");

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(feeRecords[0]?.studentId || "");
  const [paymentAmount, setPaymentAmount] = useState<number>(40000);
  const [paymentMethod, setPaymentMethod] = useState<FeePaymentMethod>("UPI");
  const [paymentRef, setPaymentRef] = useState("UPI-77891234901");
  const [installmentTitle, setInstallmentTitle] = useState("Term 2 (Mid-Year)");

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<FeeTransaction | null>(null);

  // Financial aggregates
  const totalBilled = feeRecords.reduce((sum, r) => sum + r.netPayable, 0);
  const totalCollected = feeRecords.reduce((sum, r) => sum + r.totalPaid, 0);
  const totalOutstanding = feeRecords.reduce((sum, r) => sum + r.totalDue, 0);
  const totalScholarships = feeRecords.reduce((sum, r) => sum + r.concessionAmount, 0);
  const collectionPercentage = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;

  const filteredRecords = feeRecords.filter((rec) => {
    if (selectedBatchFilter !== "ALL" && rec.batchId !== selectedBatchFilter) return false;
    if (selectedStatusFilter !== "ALL" && rec.status !== selectedStatusFilter) return false;
    return true;
  });

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const student = feeRecords.find((s) => s.studentId === selectedStudentId);
    if (!student) return;

    const newTx: FeeTransaction = {
      id: `tx-${Date.now()}`,
      organizationId: "org-1",
      studentId: student.studentId,
      studentName: student.studentName,
      rollNumber: student.rollNumber,
      batchName: student.batchName,
      amount: Number(paymentAmount),
      method: paymentMethod,
      referenceNumber: paymentRef,
      installmentTitle,
      receiptNumber: `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      recordedBy: "Accounts Desk (Ateeb Fatmi)",
      createdAt: new Date().toISOString(),
    };

    setTransactions([newTx, ...transactions]);

    // Update student ledger
    setFeeRecords((prev) =>
      prev.map((rec) => {
        if (rec.studentId !== selectedStudentId) return rec;
        const newPaid = rec.totalPaid + Number(paymentAmount);
        const newDue = Math.max(0, rec.netPayable - newPaid);
        const newStatus = newDue === 0 ? "PAID" : "PARTIAL";

        const updatedInstallments = rec.installments.map((inst) => {
          if (inst.title === installmentTitle) {
            return {
              ...inst,
              status: "PAID" as const,
              paidAmount: inst.amount,
              paidAt: new Date().toISOString().split("T")[0],
              receiptNumber: newTx.receiptNumber,
            };
          }
          return inst;
        });

        return {
          ...rec,
          totalPaid: newPaid,
          totalDue: newDue,
          status: newStatus,
          installments: updatedInstallments,
        };
      })
    );

    setShowPaymentModal(false);
    setActiveReceipt(newTx);
  };

  const studentFeeView = feeRecords.find((f) => f.studentId === "std-1") || feeRecords[0];

  return (
    <DashboardLayout
      title={
        currentRole === "STUDENT"
          ? "My Fee Ledger & Installments"
          : currentRole === "PARENT"
          ? "Fee Dues & Payment Receipts: Aarav Sharma"
          : "Institute Fee Management & Accounts"
      }
      subtitle={
        currentRole === "STUDENT" || currentRole === "PARENT"
          ? "Apex JEE & NEET Academy · Batch: JEE 12A Titans · Academic Year 2026–27"
          : "Track batch installment collections, scholarship concessions, payment receipts, and overdue alerts"
      }
      action={
        currentRole === "DIRECTOR" ? (
          <Button variant="primary" onClick={() => setShowPaymentModal(true)}>
            ＋ Record Fee Payment
          </Button>
        ) : (
          <Button variant="primary" onClick={() => alert("Redirecting to Razorpay / UPI payment gateway...")}>
            ⚡ Pay Next Installment (₹40,000)
          </Button>
        )
      }
    >
      {/* --- STUDENT / PARENT VIEW --- */}
      {(currentRole === "STUDENT" || currentRole === "PARENT") && (
        <div style={{ display: "grid", gap: "20px" }}>
          <div className="metrics-grid">
            <MetricCard
              label="Net Course Fee"
              value={`₹${studentFeeView.netPayable.toLocaleString("en-IN")}`}
              detail={studentFeeView.concessionAmount > 0 ? `Includes ₹${studentFeeView.concessionAmount.toLocaleString("en-IN")} scholarship waiver` : "Full Fee"}
              accent="navy"
            />
            <MetricCard
              label="Total Paid"
              value={`₹${studentFeeView.totalPaid.toLocaleString("en-IN")}`}
              detail="2 of 3 installments cleared"
              accent="green"
            />
            <MetricCard
              label="Remaining Due"
              value={`₹${studentFeeView.totalDue.toLocaleString("en-IN")}`}
              detail="Due by 15 November 2026"
              accent="yellow"
            />
            <MetricCard
              label="Scholarship Awarded"
              value={`₹${studentFeeView.concessionAmount.toLocaleString("en-IN")}`}
              detail={studentFeeView.concessionReason || "Merit Concession"}
              accent="brand"
            />
          </div>

          <div className="dashboard-grid">
            <Panel title="Tuition Installment Breakdown">
              <div style={{ display: "grid", gap: "12px" }}>
                {studentFeeView.installments.map((inst) => (
                  <div
                    key={inst.id}
                    style={{
                      padding: "16px",
                      border: "1px solid var(--line)",
                      borderRadius: "14px",
                      background: inst.status === "PAID" ? "#f8fafc" : "#fffdf2",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <strong style={{ fontSize: "14px" }}>{inst.title}</strong>
                        <Badge variant={inst.status === "PAID" ? "success" : inst.status === "OVERDUE" ? "danger" : "warning"} size="sm">
                          {inst.status}
                        </Badge>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                        Due Date: <strong>{inst.dueDate}</strong> · Amount: <strong>₹{inst.amount.toLocaleString("en-IN")}</strong>
                        {inst.receiptNumber && ` · Receipt: ${inst.receiptNumber}`}
                      </div>
                    </div>

                    <div>
                      {inst.status === "PAID" ? (
                        <Button
                          variant="secondary"
                          style={{ fontSize: "12px" }}
                          onClick={() => {
                            const matchTx = transactions.find((t) => t.receiptNumber === inst.receiptNumber) || {
                              id: "tx-fallback",
                              organizationId: "org-1",
                              studentId: studentFeeView.studentId,
                              studentName: studentFeeView.studentName,
                              rollNumber: studentFeeView.rollNumber,
                              batchName: studentFeeView.batchName,
                              amount: inst.amount,
                              method: "UPI" as FeePaymentMethod,
                              referenceNumber: "UPI-42991823901",
                              installmentTitle: inst.title,
                              receiptNumber: inst.receiptNumber || "REC-2026-0419",
                              recordedBy: "Accounts Desk",
                              createdAt: inst.paidAt || "2026-08-12",
                            };
                            setActiveReceipt(matchTx);
                          }}
                        >
                          📄 Download Receipt
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          style={{ fontSize: "12px" }}
                          onClick={() => alert(`Initiating payment for ${inst.title} (₹${inst.amount})...`)}
                        >
                          💳 Pay Now (UPI / Card)
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Official Payment Receipts">
              <div style={{ display: "grid", gap: "10px" }}>
                {transactions
                  .filter((t) => t.studentId === studentFeeView.studentId)
                  .map((tx) => (
                    <div
                      key={tx.id}
                      style={{
                        padding: "14px",
                        border: "1px solid var(--line)",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px" }}>{tx.installmentTitle}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                          {tx.receiptNumber} · Paid via {tx.method} · {tx.createdAt.split("T")[0]}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontWeight: 700, color: "var(--green)" }}>₹{tx.amount.toLocaleString("en-IN")}</span>
                        <Button variant="outline" style={{ fontSize: "11px", padding: "6px 10px" }} onClick={() => setActiveReceipt(tx)}>
                          Print
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* --- DIRECTOR / MANAGEMENT VIEW --- */}
      {currentRole === "DIRECTOR" && (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Total Net Fees Billed"
              value={`₹${totalBilled.toLocaleString("en-IN")}`}
              detail="Academic Year 2026–27"
              accent="navy"
            />
            <MetricCard
              label="Total Fees Collected"
              value={`₹${totalCollected.toLocaleString("en-IN")}`}
              detail={<><b>{collectionPercentage}%</b> collected on schedule</>}
              accent="green"
            />
            <MetricCard
              label="Outstanding Dues"
              value={`₹${totalOutstanding.toLocaleString("en-IN")}`}
              detail="Pending across 4 batches"
              accent="yellow"
            />
            <MetricCard
              label="Merit Scholarships Granted"
              value={`₹${totalScholarships.toLocaleString("en-IN")}`}
              detail="Talent concessions awarded"
              accent="orange"
            />
          </div>

          <div className="tabs-bar">
            <button
              onClick={() => setActiveTab("LEDGER")}
              className={`tab-link ${activeTab === "LEDGER" ? "active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              📋 Student Fee Ledgers ({feeRecords.length})
            </button>
            <button
              onClick={() => setActiveTab("TRANSACTIONS")}
              className={`tab-link ${activeTab === "TRANSACTIONS" ? "active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              📜 Recent Receipts & Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab("COLLECTIONS")}
              className={`tab-link ${activeTab === "COLLECTIONS" ? "active" : ""}`}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              📊 Batch-wise Recovery Analytics
            </button>
          </div>

          {/* TAB 1: LEDGER */}
          {activeTab === "LEDGER" && (
            <>
              <div className="filter-bar">
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      Batch Filter
                    </label>
                    <select
                      value={selectedBatchFilter}
                      onChange={(e) => setSelectedBatchFilter(e.target.value)}
                      className="select-input"
                      style={{ minWidth: "200px" }}
                    >
                      <option value="ALL">All Batches</option>
                      <option value="batch-1">JEE 12A - Titans</option>
                      <option value="batch-2">JEE 11B - Nucleus</option>
                      <option value="batch-3">NEET 12 - Medico Super 50</option>
                      <option value="batch-4">Foundation 10 - Olympiad</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                      Payment Status
                    </label>
                    <select
                      value={selectedStatusFilter}
                      onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                      className="select-input"
                      style={{ minWidth: "160px" }}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="OVERDUE">Overdue Defaulters</option>
                      <option value="PARTIAL">Partially Paid</option>
                      <option value="PAID">Fully Cleared</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    variant="outline"
                    onClick={() => alert(`Queued automated WhatsApp payment reminder to ${feeRecords.filter((r) => r.totalDue > 0).length} parents!`)}
                  >
                    💬 WhatsApp Overdue Reminders
                  </Button>
                  <Button variant="primary" onClick={() => setShowPaymentModal(true)}>
                    ＋ Record Payment
                  </Button>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Student & Batch</th>
                      <th>Gross Course Fee</th>
                      <th>Concession</th>
                      <th>Net Payable</th>
                      <th>Paid to Date</th>
                      <th>Current Balance</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                            {record.rollNumber}
                          </code>
                        </td>
                        <td>
                          <strong>{record.studentName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{record.batchName}</div>
                        </td>
                        <td>₹{record.totalCourseFee.toLocaleString("en-IN")}</td>
                        <td>
                          {record.concessionAmount > 0 ? (
                            <span style={{ color: "var(--green)", fontWeight: 600 }}>
                              -₹{record.concessionAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <strong>₹{record.netPayable.toLocaleString("en-IN")}</strong>
                        </td>
                        <td>
                          <span style={{ color: "var(--green)", fontWeight: 700 }}>
                            ₹{record.totalPaid.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: record.totalDue > 0 ? "var(--danger)" : "var(--muted)", fontWeight: 700 }}>
                            {record.totalDue > 0 ? `₹${record.totalDue.toLocaleString("en-IN")}` : "Cleared"}
                          </span>
                        </td>
                        <td>
                          <Badge
                            variant={record.status === "PAID" ? "success" : record.status === "OVERDUE" ? "danger" : "warning"}
                            size="sm"
                          >
                            {record.status}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <button
                              onClick={() => {
                                setSelectedStudentId(record.studentId);
                                setShowPaymentModal(true);
                              }}
                              className="pz-button pz-button-secondary"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              Collect
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 2: TRANSACTIONS */}
          {activeTab === "TRANSACTIONS" && (
            <Panel title="Verified Institute Payment Receipts">
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Student & Roll</th>
                      <th>Batch</th>
                      <th>Installment</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference #</th>
                      <th>Recorded By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <strong>{tx.receiptNumber}</strong>
                          <div style={{ fontSize: "10px", color: "var(--muted)" }}>{tx.createdAt.split("T")[0]}</div>
                        </td>
                        <td>
                          <strong>{tx.studentName}</strong>
                          <div style={{ fontSize: "11px", color: "var(--muted)" }}>{tx.rollNumber}</div>
                        </td>
                        <td>{tx.batchName}</td>
                        <td>{tx.installmentTitle}</td>
                        <td>
                          <strong style={{ color: "var(--green)" }}>₹{tx.amount.toLocaleString("en-IN")}</strong>
                        </td>
                        <td>
                          <Badge variant="brand" size="sm">{tx.method}</Badge>
                        </td>
                        <td>
                          <code style={{ fontSize: "11px" }}>{tx.referenceNumber}</code>
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", color: "var(--muted)" }}>{tx.recordedBy}</span>
                        </td>
                        <td>
                          <Button variant="outline" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => setActiveReceipt(tx)}>
                            📄 View Receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {/* TAB 3: COLLECTIONS */}
          {activeTab === "COLLECTIONS" && (
            <div className="card-grid-2">
              <Panel title="Batch Recovery Progress">
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>JEE 12A - Titans</strong> (AIR Rankers)</span>
                      <span><strong>₹2,30,000 / ₹2,70,000</strong> (85.1%)</span>
                    </div>
                    <ProgressBar value={85.1} variant="success" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>NEET 12 - Medico Super 50</strong></span>
                      <span><strong>₹1,40,000 / ₹1,40,000</strong> (100%)</span>
                    </div>
                    <ProgressBar value={100} variant="success" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>JEE 11B - Nucleus</strong></span>
                      <span><strong>₹40,000 / ₹1,20,000</strong> (33.3% - Overdue Follow-up)</span>
                    </div>
                    <ProgressBar value={33.3} variant="warning" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span><strong>Foundation 10 - Olympiad</strong></span>
                      <span><strong>₹50,000 / ₹80,000</strong> (62.5%)</span>
                    </div>
                    <ProgressBar value={62.5} variant="brand" />
                  </div>
                </div>
              </Panel>

              <Panel title="Payment Gateway & Mode Distribution">
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong>UPI (QR / GooglePay / PhonePe)</strong>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>Instant confirmation · Zero merchant fee</div>
                    </div>
                    <strong style={{ color: "var(--green)" }}>58.4% (₹3,56,000)</strong>
                  </div>
                  <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong>Direct Netbanking (NEFT / RTGS / IMPS)</strong>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>Bank reconciled transfer</div>
                    </div>
                    <strong style={{ color: "var(--blue)" }}>28.2% (₹1,72,000)</strong>
                  </div>
                  <div style={{ padding: "14px", border: "1px solid var(--line)", borderRadius: "12px", display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <strong>Bank Cheque / DD / Cash Deposit</strong>
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>Accounts desk branch collection</div>
                    </div>
                    <strong style={{ color: "var(--orange)" }}>13.4% (₹82,000)</strong>
                  </div>
                </div>
              </Panel>
            </div>
          )}
        </>
      )}

      {/* --- RECORD PAYMENT MODAL --- */}
      {showPaymentModal && (
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
              borderRadius: "18px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                💳 Record Fee Payment
              </h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                  Select Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  {feeRecords.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentName} ({s.rollNumber}) · Due: ₹{s.totalDue.toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Installment Title
                  </label>
                  <select
                    value={installmentTitle}
                    onChange={(e) => setInstallmentTitle(e.target.value)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="Term 1 (Enrollment)">Term 1 (Enrollment)</option>
                    <option value="Term 2 (Mid-Year)">Term 2 (Mid-Year)</option>
                    <option value="Term 3 (Final Mocks)">Term 3 (Final Mocks)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="search-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="select-input"
                    style={{ width: "100%" }}
                  >
                    <option value="UPI">UPI (QR / App)</option>
                    <option value="NET_BANKING">Net Banking</option>
                    <option value="CHEQUE">Bank Cheque</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="CASH">Cash at Desk</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                    Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  ✓ Confirm & Generate Receipt
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PRINTABLE RECEIPT MODAL --- */}
      {activeReceipt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "32px",
              borderRadius: "20px",
              maxWidth: "500px",
              width: "100%",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ borderBottom: "2px dashed #cbd5e1", paddingBottom: "16px", marginBottom: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#854d0e", background: "#fefce8", display: "inline-block", padding: "2px 8px", borderRadius: "4px", marginBottom: "6px" }}>
                OFFICIAL PAYMENT RECEIPT
              </div>
              <h2 style={{ margin: "2px 0", fontSize: "20px", fontFamily: "var(--font-display)" }}>
                Apex JEE & NEET Academy
              </h2>
              <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                North Campus · Affiliated Coaching Institute · GSTIN: 07AAACA1234F1Z5
              </p>
            </div>

            <div style={{ display: "grid", gap: "8px", fontSize: "12px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Receipt Number:</span>
                <strong>{activeReceipt.receiptNumber}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Date & Time:</span>
                <span>{activeReceipt.createdAt.replace("T", " ").substring(0, 16)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Student Name:</span>
                <strong>{activeReceipt.studentName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Roll Number:</span>
                <code>{activeReceipt.rollNumber}</code>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Batch:</span>
                <span>{activeReceipt.batchName}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Installment:</span>
                <span>{activeReceipt.installmentTitle}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Payment Mode:</span>
                <Badge variant="brand" size="sm">{activeReceipt.method}</Badge>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Ref / UTR Number:</span>
                <code>{activeReceipt.referenceNumber}</code>
              </div>
            </div>

            <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700 }}>Total Amount Paid:</span>
              <strong style={{ fontSize: "22px", color: "var(--green)", fontFamily: "var(--font-display)" }}>
                ₹{activeReceipt.amount.toLocaleString("en-IN")}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => setActiveReceipt(null)}
                className="pz-button pz-button-secondary"
                style={{ fontSize: "12px" }}
              >
                Close
              </button>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button variant="outline" style={{ fontSize: "12px" }} onClick={() => window.print()}>
                  🖨 Print Receipt
                </Button>
                <Button variant="primary" style={{ fontSize: "12px" }} onClick={() => alert("Receipt sent via WhatsApp to registered guardian number!")}>
                  💬 Send on WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center" }}>Loading fee ledger...</div>}>
      <FeesContent />
    </Suspense>
  );
}
