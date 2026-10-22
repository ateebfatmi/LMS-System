"use client";

import { useActiveOrganizationId } from "@/lib/client-org";

import { useState, useEffect } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import type { FeePaymentMethod, FeePlan, FeeReceiptSummary, StudentFeeLedger } from "@prepzii/contracts";

export default function FeesPage() {
  const activeOrganizationId = useActiveOrganizationId();
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFeeLedger[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFeeLedger | null>(null);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<FeePaymentMethod>("UPI");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<FeeReceiptSummary | null>(null);

  const loadFeeData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fees");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        setStudentFees(data.studentFees || []);
      }
    } catch (err) {
      console.error("Failed to load fees:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeeData();
  }, [activeOrganizationId]);

  const totalCollectedPaise = studentFees.reduce((acc, f) => acc + f.totalPaidPaise, 0);
  const totalOutstandingPaise = studentFees.reduce((acc, f) => acc + f.outstandingBalancePaise, 0);
  const totalBillable = totalCollectedPaise + totalOutstandingPaise || 1;
  const collectionRate = Math.round((totalCollectedPaise / totalBillable) * 1000) / 10;

  const handleOpenPayment = (fee: StudentFeeLedger) => {
    setSelectedFee(fee);
    setPaymentAmountRupees(String(fee.outstandingBalancePaise / 100));
    setReferenceNumber("");
    setPaymentNotes("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedFee) return;
    const amountNum = Number(paymentAmountRupees);
    if (!amountNum || amountNum <= 0) {
      setPaymentError("Please enter a valid payment amount");
      return;
    }

    try {
      setPaymentSaving(true);
      setPaymentError("");

      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RECORD_PAYMENT",
          studentFeeId: selectedFee.id,
          amountPaise: Math.round(amountNum * 100),
          paymentMethod,
          referenceNumber,
          notes: paymentNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Payment recording failed");
      }

      const data = await res.json();
      setShowPaymentModal(false);
      setActiveReceipt(data.receipt);
      await loadFeeData();
    } catch (err: any) {
      setPaymentError(err.message || "Failed to record payment");
    } finally {
      setPaymentSaving(false);
    }
  };

  const formatINR = (paise: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(paise / 100);
  };

  return (
    <DashboardLayout
      title="Fee Management & Collection Ledger"
      subtitle="Track course fee structures, installment dues, manual cash/UPI receipts, and parent payment reminders"
      action={
        <Button variant="primary" onClick={() => alert("Fee plan creation modal: Configurable in Institute Setup")}>
          ＋ New Course Fee Plan
        </Button>
      }
    >
      <div className="metrics-grid">
        <MetricCard label="Total Fees Collected" value={formatINR(totalCollectedPaise)} detail={`${collectionRate}% collection rate`} accent="green" />
        <MetricCard label="Outstanding Dues" value={formatINR(totalOutstandingPaise)} detail="Pending across all batches" accent="orange" />
        <MetricCard label="Enrolled Fee Accounts" value={String(studentFees.length)} detail="Classroom & CBT programs" accent="navy" />
        <MetricCard label="Active Fee Plans" value={String(plans.length)} detail="JEE, NEET & Foundation" accent="yellow" />
      </div>

      <div style={{ marginTop: "16px" }}>
        <Panel title="Student Fee Accounts & Installment Status">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Assigned Fee Plan</th>
                  <th>Total Fee</th>
                  <th>Paid Amount</th>
                  <th>Outstanding Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      Loading fee ledger...
                    </td>
                  </tr>
                ) : studentFees.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>
                      No student fee accounts assigned yet.
                    </td>
                  </tr>
                ) : (
                  studentFees.map((fee) => (
                    <tr key={fee.id}>
                      <td>
                        <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                          {fee.rollNumber}
                        </code>
                      </td>
                      <td>
                        <strong>{fee.studentName}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{fee.batchName}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px" }}>{fee.feePlanName}</span>
                      </td>
                      <td>
                        <strong>{formatINR(fee.finalAmountPaise)}</strong>
                      </td>
                      <td>
                        <span style={{ color: "#166534", fontWeight: 600 }}>{formatINR(fee.totalPaidPaise)}</span>
                      </td>
                      <td>
                        <strong style={{ color: fee.outstandingBalancePaise > 0 ? "#b45309" : "#16a34a" }}>
                          {formatINR(fee.outstandingBalancePaise)}
                        </strong>
                      </td>
                      <td>
                        <Badge
                          variant={
                            fee.status === "PAID"
                              ? "success"
                              : fee.status === "PARTIALLY_PAID"
                              ? "brand"
                              : fee.status === "OVERDUE"
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {fee.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {fee.outstandingBalancePaise > 0 ? (
                            <Button
                              variant="primary"
                              onClick={() => handleOpenPayment(fee)}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              💵 Collect Fee
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              onClick={() => fee.payments[0] && setActiveReceipt(fee.payments[0])}
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                            >
                              🧾 View Receipt
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

      {/* Course Fee Plans Table */}
      <div style={{ marginTop: "20px" }}>
        <Panel title="Configured Course Fee Structures">
          <div className="card-grid-3" style={{ margin: 0 }}>
            {plans.map((p) => (
              <div key={p.id} className="batch-card">
                <header>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.defaultInstallments} Installments Available</p>
                  </div>
                  <Badge variant="brand" size="sm">
                    {p.targetExam.replace("_", " ")}
                  </Badge>
                </header>
                <div style={{ margin: "14px 0" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--brand)" }}>
                    {formatINR(p.totalAmountPaise)}
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>{p.description}</p>
                </div>
                <Button variant="outline" style={{ width: "100%", fontSize: "11px" }}>
                  Configure Installments
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && selectedFee && (
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
              maxWidth: "500px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-display)" }}>
              Record Fee Payment
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "12px", color: "var(--muted)" }}>
              Student: <strong>{selectedFee.studentName}</strong> ({selectedFee.rollNumber}) · Outstanding:{" "}
              <strong style={{ color: "#b45309" }}>{formatINR(selectedFee.outstandingBalancePaise)}</strong>
            </p>

            {paymentError && (
              <div style={{ padding: "8px 12px", background: "#fef2f2", color: "#b91c1c", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>
                {paymentError}
              </div>
            )}

            <div style={{ display: "grid", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Payment Amount (in INR ₹)
                </label>
                <input
                  type="number"
                  className="search-input"
                  value={paymentAmountRupees}
                  onChange={(e) => setPaymentAmountRupees(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="select-input"
                  style={{ width: "100%" }}
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="CASH">Cash (Office Counter)</option>
                  <option value="NEFT_RTGS">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Transaction Reference / UTR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI/20261022/98765432"
                  className="search-input"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Office Notes & Remarks
                </label>
                <input
                  type="text"
                  placeholder="Installment cleared by father"
                  className="search-input"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSubmitPayment} disabled={paymentSaving}>
                  {paymentSaving ? "Processing..." : "✓ Generate Official Receipt"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Fee Receipt Modal */}
      {activeReceipt && (
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
              maxWidth: "600px",
              width: "100%",
              padding: "32px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            {/* Header */}
            <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "18px" }}>
                  APEX JEE & NEET ACADEMY
                </h3>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  Official Fee Payment Receipt · North Campus Main Center
                </div>
              </div>
              <Badge variant="success" size="sm">PAID</Badge>
            </div>

            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", marginBottom: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
              <div><strong>Receipt No:</strong> {activeReceipt.receiptNumber}</div>
              <div><strong>Date:</strong> {new Date(activeReceipt.paidAt).toLocaleDateString("en-IN")}</div>
              <div><strong>Student Name:</strong> {activeReceipt.studentName}</div>
              <div><strong>Roll Number:</strong> {activeReceipt.rollNumber}</div>
              <div><strong>Payment Mode:</strong> {activeReceipt.paymentMethod}</div>
              <div><strong>Reference:</strong> {activeReceipt.referenceNumber || "OFFICE_COUNTER"}</div>
            </div>

            <div style={{ border: "1px solid var(--line)", borderRadius: "8px", padding: "16px", marginBottom: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Amount Received</div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "#166534", margin: "4px 0" }}>
                {formatINR(activeReceipt.amountPaise)}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                Received with thanks towards classroom tuition and test series fees
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <div>Authorized Signatory: <strong>Accounts Desk</strong></div>
              <div>PrepZii B2B Financial Ledger Verified</div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <Button variant="secondary" onClick={() => setActiveReceipt(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                🖨️ Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
