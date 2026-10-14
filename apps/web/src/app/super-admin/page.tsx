"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { mockPlatformInstitutes } from "@/lib/mock-data";
import type { PlatformInstituteSummary, SubscriptionTier } from "@prepzii/contracts";

export default function SuperAdminPage() {
  const [institutes, setInstitutes] = useState<PlatformInstituteSummary[]>(mockPlatformInstitutes);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // New Institute Form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newPlan, setNewPlan] = useState<SubscriptionTier>("growth");

  // Platform Audit Log
  const [auditLogs, setAuditLogs] = useState([
    {
      id: "log-1",
      action: "INSTITUTE_REACTIVATED",
      operator: "superadmin@prepzii.com",
      target: "Apex JEE & NEET Academy",
      timestamp: "Today at 09:42 AM",
    },
    {
      id: "log-2",
      action: "PLAN_UPGRADED_SCALE",
      operator: "billing-webhook@razorpay",
      target: "Resonance Career Point",
      timestamp: "Yesterday at 04:15 PM",
    },
    {
      id: "log-3",
      action: "TENANT_CREATED",
      operator: "onboarding-team@prepzii.com",
      target: "Chanakya IAS & UPSC Circle",
      timestamp: "12 Oct 2026, 11:20 AM",
    },
  ]);

  // Derived metrics
  const totalInstitutes = institutes.length;
  const activeInstitutes = institutes.filter((i) => i.status === "ACTIVE").length;
  const totalStudents = institutes.reduce((acc, curr) => acc + curr.activeStudents, 0);
  const mrrInr = institutes.reduce((acc, curr) => {
    const rate = curr.planId === "scale" ? 7999 : curr.planId === "growth" ? 3499 : 1499;
    return acc + (curr.status === "ACTIVE" ? rate : 0);
  }, 0);

  const filteredInstitutes = institutes.filter((inst) => {
    const matchesSearch =
      inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || inst.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleStatus = (id: string) => {
    setInstitutes((prev) =>
      prev.map((inst) => {
        if (inst.id === id) {
          const newStatus = inst.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
          // Add audit log
          setAuditLogs((logs) => [
            {
              id: `log-${Date.now()}`,
              action: newStatus === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REACTIVATED",
              operator: "superadmin@prepzii.com",
              target: inst.name,
              timestamp: "Just now",
            },
            ...logs,
          ]);
          return { ...inst, status: newStatus };
        }
        return inst;
      }),
    );
  };

  const handleCreateInstitute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;

    const created: PlatformInstituteSummary = {
      id: `org-${Date.now()}`,
      name: newName.trim(),
      slug: newSlug.trim().toLowerCase().replace(/\s+/g, "-"),
      ownerName: newOwnerName.trim() || "Institute Director",
      ownerEmail: newOwnerEmail.trim(),
      status: "ACTIVE",
      planId: newPlan,
      activeStudents: 0,
      activeBatches: 0,
      createdAt: new Date().toISOString(),
    };

    setInstitutes([created, ...institutes]);
    setAuditLogs((logs) => [
      {
        id: `log-${Date.now()}`,
        action: "TENANT_PROVISIONED",
        operator: "superadmin@prepzii.com",
        target: created.name,
        timestamp: "Just now",
      },
      ...logs,
    ]);

    setShowAddModal(false);
    setNewName("");
    setNewSlug("");
    setNewOwnerName("");
    setNewOwnerEmail("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "var(--font-sans)" }}>
      {/* Super Admin Top Header */}
      <header
        style={{
          background: "#0b132b",
          color: "white",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid #eab308",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <strong style={{ fontSize: "16px", letterSpacing: "0.5px" }}>PrepZii Platform Super-Admin</strong>
          </div>
          <span
            style={{
              background: "rgba(234, 179, 8, 0.2)",
              color: "#facc15",
              fontSize: "11px",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid rgba(234, 179, 8, 0.3)",
            }}
          >
            INTERNAL OPERATOR
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/dashboard"
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            ← Switch to Institute Workspace
          </Link>
          <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
            Logged in as <strong>ops@prepzii.com</strong>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: "1340px", margin: "0 auto", padding: "32px 24px" }}>
        {/* Title and Action */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: "24px", fontFamily: "var(--font-display)" }}>
              Platform Institutes & Tenancy Control
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
              Manage multi-tenant subscriptions, quota limits, account status, and platform audit trail
            </p>
          </div>

          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            ＋ Provision New Institute
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="metrics-grid" style={{ marginBottom: "28px" }}>
          <MetricCard label="Registered Institutes" value={String(totalInstitutes)} detail={`${activeInstitutes} Active · 0 Suspended`} accent="yellow" />
          <MetricCard label="Monthly Recurring Revenue" value={`₹${mrrInr.toLocaleString("en-IN")}`} detail="Platform SaaS Run-rate" accent="green" />
          <MetricCard label="Active Students Hosted" value={totalStudents.toLocaleString("en-IN")} detail="Across all coaching tenants" accent="navy" />
          <MetricCard label="CBT Exams Graded" value="28,450" detail="Pure engine evaluations" accent="orange" />
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            padding: "16px",
            background: "white",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            marginBottom: "20px",
          }}
        >
          <div style={{ flex: "1 1 280px" }}>
            <input
              type="text"
              placeholder="🔍 Search institute name, subdomain slug, director email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                fontSize: "12px",
                background: "white",
              }}
            >
              <option value="ALL">All Institutes ({totalInstitutes})</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>
        </div>

        {/* Institutes Table */}
        <div style={{ marginBottom: "32px" }}>
          <Panel title="Customer Institutes Roster">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Institute Name</th>
                    <th>Subdomain Slug</th>
                    <th>Director / Owner</th>
                    <th>Current Plan</th>
                    <th>Active Students</th>
                    <th>Status</th>
                    <th>Operator Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInstitutes.map((inst) => (
                    <tr key={inst.id}>
                      <td>
                        <strong>{inst.name}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>ID: {inst.id}</div>
                      </td>
                      <td>
                        <code
                          style={{
                            background: "#f1f5f9",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        >
                          {inst.slug}.prepzii.com
                        </code>
                      </td>
                      <td>
                        <div>{inst.ownerName}</div>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>{inst.ownerEmail}</div>
                      </td>
                      <td>
                        <Badge
                          variant={inst.planId === "scale" ? "brand" : inst.planId === "growth" ? "success" : "neutral"}
                          size="sm"
                        >
                          {inst.planId.toUpperCase()}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inst.activeStudents} Students</td>
                      <td>
                        <Badge variant={inst.status === "ACTIVE" ? "success" : "danger"} size="sm">
                          {inst.status}
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link
                            href="/dashboard"
                            style={{
                              fontSize: "11px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: "#f1f5f9",
                              color: "#334155",
                              textDecoration: "none",
                              fontWeight: 600,
                            }}
                          >
                            Impersonate View ↗
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleStatus(inst.id)}
                            style={{
                              border: "none",
                              borderRadius: "6px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                              background: inst.status === "ACTIVE" ? "#fee2e2" : "#dcfce7",
                              color: inst.status === "ACTIVE" ? "#b91c1c" : "#15803d",
                            }}
                          >
                            {inst.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Platform Audit Logs */}
        <Panel title="Platform Security & Tenancy Audit Trail">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Audit Action</th>
                  <th>Target Institute</th>
                  <th>Operator Identity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <code style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                        {log.action}
                      </code>
                    </td>
                    <td style={{ fontSize: "13px" }}>{log.target}</td>
                    <td style={{ fontSize: "12px", color: "var(--muted)" }}>{log.operator}</td>
                    <td style={{ fontSize: "12px", color: "#64748b" }}>{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* PROVISION NEW INSTITUTE MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                Provision New Coaching Institute
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstitute} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Institute Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Allen Career Institute"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }
                  }}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Subdomain Slug *
                </label>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="text"
                    required
                    placeholder="allen-career"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "8px 0 0 8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                  <span
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid var(--line)",
                      borderLeft: "none",
                      padding: "8px 12px",
                      borderRadius: "0 8px 8px 0",
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}
                  >
                    .prepzii.com
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Director Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Director Name"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Director Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="director@institute.in"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Initial Subscription Tier
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as SubscriptionTier)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                >
                  <option value="basic">Basic (Up to 100 students · ₹1,499/mo)</option>
                  <option value="growth">Growth (Up to 500 students · ₹3,499/mo)</option>
                  <option value="scale">Scale (Up to 1,500 students · ₹7,999/mo)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Provision Tenant
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
