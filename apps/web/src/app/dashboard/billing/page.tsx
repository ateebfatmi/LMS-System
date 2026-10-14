"use client";

import { useState } from "react";
import { Badge, Button, MetricCard, Panel, ProgressBar } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { mockSubscriptionPlans, mockSubscription } from "@/lib/mock-data";
import type { SubscriptionTier } from "@prepzii/contracts";

export default function BillingPage() {
  const [subscription, setSubscription] = useState(mockSubscription);
  const [plans] = useState(mockSubscriptionPlans);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<SubscriptionTier | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Invoices mock
  const [invoices] = useState([
    {
      id: "INV-PREPZII-2026-001",
      date: "01 Oct 2026",
      plan: "Growth Plan (Monthly)",
      amount: "₹3,499",
      status: "PAID",
      receiptUrl: "#",
    },
    {
      id: "INV-PREPZII-2026-002",
      date: "01 Sep 2026",
      plan: "Growth Plan (Monthly)",
      amount: "₹3,499",
      status: "PAID",
      receiptUrl: "#",
    },
    {
      id: "INV-PREPZII-2026-003",
      date: "01 Aug 2026",
      plan: "Basic Plan (Monthly)",
      amount: "₹1,499",
      status: "PAID",
      receiptUrl: "#",
    },
  ]);

  const currentPlan = plans.find((p) => p.id === subscription.planId) || plans[1];
  const usagePercent = Math.min(100, Math.round((subscription.activeStudentCount / subscription.studentLimit) * 100));

  const handleSimulateUpgrade = (tier: SubscriptionTier) => {
    setSelectedUpgradePlan(tier);
  };

  const confirmUpgrade = () => {
    if (!selectedUpgradePlan) return;
    setIsProcessingPayment(true);

    // Simulate verified Razorpay checkout & webhook transition
    setTimeout(() => {
      const newPlan = plans.find((p) => p.id === selectedUpgradePlan);
      if (newPlan) {
        setSubscription({
          ...subscription,
          planId: newPlan.id,
          planName: newPlan.name,
          studentLimit: newPlan.studentLimit,
          status: "ACTIVE",
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      }
      setIsProcessingPayment(false);
      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setSelectedUpgradePlan(null);
      }, 2500);
    }, 1200);
  };

  return (
    <DashboardLayout
      title="Subscription & Plan Quotas"
      subtitle="Manage your coaching institute SaaS subscription tier, active student quotas, and billing invoices"
    >
      {/* Metrics Row */}
      <div className="metrics-grid">
        <MetricCard
          label="Current Tier"
          value={currentPlan.name}
          detail={`₹${currentPlan.priceInr.toLocaleString("en-IN")} / month · Active`}
          accent="yellow"
        />
        <MetricCard
          label="Active Student Quota"
          value={`${subscription.activeStudentCount} / ${subscription.studentLimit}`}
          detail={`${subscription.studentLimit - subscription.activeStudentCount} seats available`}
          accent="navy"
        />
        <MetricCard
          label="Next Renewal Date"
          value="31 Oct 2026"
          detail="Auto-renews via Razorpay mandate"
          accent="green"
        />
        <MetricCard
          label="AI Generation Credits"
          value={`${currentPlan.aiCreditsPerMonth} Qs / mo`}
          detail="Refreshes on 1st of month"
          accent="orange"
        />
      </div>

      {/* Plan Usage & Quota Alert */}
      <div style={{ marginBottom: "24px" }}>
        <Panel title="Institute Quota Utilization">
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                <span>
                  <strong>Active Students Enrolled:</strong> {subscription.activeStudentCount} of {subscription.studentLimit}
                </span>
                <span style={{ fontWeight: 700, color: usagePercent > 85 ? "#dc2626" : "#047857" }}>
                  {usagePercent}% Used
                </span>
              </div>
              <ProgressBar value={usagePercent} variant={usagePercent > 85 ? "warning" : "default"} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginTop: "8px" }}>
              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Campus Branches Allowed
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                  1 / {currentPlan.branchLimit} Branch
                </div>
              </div>

              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Private Document & DPP Storage
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                  4.2 GB / {currentPlan.storageGb} GB
                </div>
              </div>

              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", border: "1px solid var(--line)" }}>
                <div style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Active Plan Status
                </div>
                <div style={{ marginTop: "4px" }}>
                  <Badge variant="success" size="sm">
                    ● {subscription.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Available Plans Comparison */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Available Subscription Tiers
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--muted)" }}>
              Upgrade seamlessly as your student enrollment grows. Switch plans anytime with pro-rated billing.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "8px",
              gap: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              style={{
                border: "none",
                background: billingCycle === "monthly" ? "white" : "transparent",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: billingCycle === "monthly" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              style={{
                border: "none",
                background: billingCycle === "yearly" ? "white" : "transparent",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: billingCycle === "yearly" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              Annual Billing (Save 20%)
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
          {plans.map((plan) => {
            const isCurrent = subscription.planId === plan.id;
            const price =
              billingCycle === "yearly"
                ? Math.round(plan.priceInr * 0.8)
                : plan.priceInr;

            return (
              <div
                key={plan.id}
                style={{
                  background: "white",
                  borderRadius: "16px",
                  border: isCurrent ? "2px solid #EAB308" : "1px solid var(--line)",
                  padding: "24px",
                  boxShadow: isCurrent ? "0 4px 20px rgba(234, 179, 8, 0.15)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-12px",
                      right: "20px",
                      background: "#EAB308",
                      color: "#0F172A",
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: "12px",
                      textTransform: "uppercase",
                    }}
                  >
                    Current Plan
                  </div>
                )}

                <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
                  {plan.name}
                </h3>

                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "10px 0 16px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 800 }}>
                    ₹{price.toLocaleString("en-IN")}
                  </span>
                  <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                    / month {billingCycle === "yearly" ? "(billed annually)" : ""}
                  </span>
                </div>

                <div style={{ fontSize: "13px", color: "#334155", marginBottom: "16px", fontWeight: 600 }}>
                  ⚡ Up to {plan.studentLimit.toLocaleString("en-IN")} Active Students
                </div>

                <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "grid", gap: "10px", flex: 1 }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} style={{ fontSize: "12px", color: "#475569", display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ color: "#047857", fontWeight: 800 }}>✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                  <li style={{ fontSize: "12px", color: "#475569", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ color: "#047857", fontWeight: 800 }}>✓</span>
                    <span>{plan.branchLimit} Campus Branch{plan.branchLimit > 1 ? "es" : ""}</span>
                  </li>
                  <li style={{ fontSize: "12px", color: "#475569", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ color: "#047857", fontWeight: 800 }}>✓</span>
                    <span>{plan.storageGb} GB Private Storage</span>
                  </li>
                </ul>

                <div>
                  {isCurrent ? (
                    <Button variant="outline" style={{ width: "100%" }} disabled>
                      Active Plan
                    </Button>
                  ) : (
                    <Button
                      variant={plan.id === "scale" ? "primary" : "outline"}
                      style={{ width: "100%" }}
                      onClick={() => handleSimulateUpgrade(plan.id)}
                    >
                      {plan.studentLimit > subscription.studentLimit ? "Upgrade to " + plan.name : "Select " + plan.name}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Invoices */}
      <Panel title="Billing & Tax Invoices">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Billing Date</th>
                <th>Subscription Description</th>
                <th>Amount (incl. GST)</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.id}</strong>
                  </td>
                  <td style={{ fontSize: "13px" }}>{inv.date}</td>
                  <td style={{ fontSize: "13px" }}>{inv.plan}</td>
                  <td style={{ fontWeight: 700 }}>{inv.amount}</td>
                  <td>
                    <Badge variant="success" size="sm">
                      {inv.status}
                    </Badge>
                  </td>
                  <td>
                    <a
                      href={inv.receiptUrl}
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Downloading official tax invoice ${inv.id} with GSTIN & Razorpay payment reference.`);
                      }}
                      style={{ color: "var(--blue)", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
                    >
                      📥 Download PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* UPGRADE / CHANGE PLAN MODAL */}
      {selectedUpgradePlan && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: "500px" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "18px", fontFamily: "var(--font-display)" }}>
              Confirm Subscription Change
            </h2>

            {paymentSuccess ? (
              <div
                style={{
                  padding: "20px",
                  background: "#ecfdf5",
                  border: "1px solid #10b981",
                  borderRadius: "10px",
                  color: "#065f46",
                  fontWeight: 600,
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                🎉 Payment verified! Your institute has been upgraded to{" "}
                <strong>{plans.find((p) => p.id === selectedUpgradePlan)?.name}</strong>.
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>
                  You are switching to the{" "}
                  <strong>{plans.find((p) => p.id === selectedUpgradePlan)?.name}</strong> (₹
                  {plans.find((p) => p.id === selectedUpgradePlan)?.priceInr.toLocaleString("en-IN")}/month).
                  New student quota will take effect immediately.
                </p>

                <div
                  style={{
                    padding: "14px",
                    background: "#f8fafc",
                    border: "1px solid var(--line)",
                    borderRadius: "10px",
                    fontSize: "13px",
                    display: "grid",
                    gap: "6px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>New Student Limit:</span>
                    <strong>{plans.find((p) => p.id === selectedUpgradePlan)?.studentLimit} students</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Payment Gateway:</span>
                    <span style={{ color: "#2563eb", fontWeight: 700 }}>Razorpay Mandate (Sandbox)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Pro-rated Amount Due:</span>
                    <strong style={{ color: "#047857" }}>
                      ₹{plans.find((p) => p.id === selectedUpgradePlan)?.priceInr.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setSelectedUpgradePlan(null)}
                    disabled={isProcessingPayment}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={confirmUpgrade}
                    disabled={isProcessingPayment}
                  >
                    {isProcessingPayment ? "Verifying with Razorpay..." : "Authorize via Razorpay →"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
