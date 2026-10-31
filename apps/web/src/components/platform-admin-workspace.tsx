"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, MetricCard, PrepziiLogoIcon, Select } from "@prepzii/ui";

type Row = Record<string, unknown>;

type SystemHealth = {
  databaseStatus: string;
  databaseLatencyMs: number;
  storageStatus: string;
  aiModelStatus: string;
  aiModelName: string;
  environment: string;
};

type Data = {
  institutes: Row[];
  subscriptions: Row[];
  plans: Row[];
  flags: Row[];
  audits: Row[];
  counts: Row[];
  systemHealth?: SystemHealth;
};

const empty: Data = {
  institutes: [],
  subscriptions: [],
  plans: [],
  flags: [],
  audits: [],
  counts: [],
};

const money = (paise: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(paise ?? 0) / 100);

export function PlatformAdminWorkspace() {
  const router = useRouter();
  const [data, setData] = useState<Data>(empty);
  const [activeTab, setActiveTab] = useState<"overview" | "institutes" | "plans" | "flags" | "audits">("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // New Institute Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstSlug, setNewInstSlug] = useState("");
  const [newInstPlan, setNewInstPlan] = useState("basic");

  // Plan Edit Drawer
  const [selectedInstForPlan, setSelectedInstForPlan] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/platform", { cache: "no-store" });
      const result = await response.json();
      if (response.ok) {
        setData(result);
        setError("");
      } else {
        setError(result.error ?? "Unable to load platform administration.");
      }
    } catch {
      setError("Network error while connecting to platform control room.");
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function mutate(action: string, payload: Row) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to save platform operation.");
      } else {
        setMessage("Platform operation saved and permanently audited.");
        await load();
      }
      setBusy(false);
      return response.ok;
    } catch {
      setError("Failed to execute platform mutation.");
      setBusy(false);
      return false;
    }
  }

  async function handleLockSession() {
    await fetch("/api/platform/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleCreateInstitute(e: FormEvent) {
    e.preventDefault();
    if (!newInstName.trim() || !newInstSlug.trim()) return;

    const ok = await mutate("CREATE_INSTITUTE", {
      name: newInstName.trim(),
      slug: newInstSlug.trim(),
      planId: newInstPlan,
    });

    if (ok) {
      setShowCreateModal(false);
      setNewInstName("");
      setNewInstSlug("");
    }
  }

  async function handleAssignPlan(instId: string, planId: string) {
    await mutate("ASSIGN_ORGANIZATION_PLAN", {
      organizationId: instId,
      planId,
    });
    setSelectedInstForPlan(null);
  }

  async function updatePlan(event: FormEvent<HTMLFormElement>, plan: Row) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate("UPDATE_PLAN", {
      planId: plan.id,
      name: form.get("name"),
      monthlyPricePaise: Math.round(Number(form.get("monthly")) * 100),
      annualPricePaise: Math.round(Number(form.get("annual")) * 100),
      studentLimit: Number(form.get("students")),
      branchLimit: Number(form.get("branches")),
      storageGb: Number(form.get("storage")),
      aiCreditsPerMonth: Number(form.get("ai")),
      entitlements: (plan.entitlements as Record<string, unknown>) ?? {},
      isActive: form.get("active") === "on",
    });
  }

  async function saveFlag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await mutate("SET_FEATURE_FLAG", {
        key: form.get("key"),
        description: form.get("description"),
        enabled: form.get("enabled") === "on",
      })
    ) {
      event.currentTarget.reset();
    }
  }

  // Derived Fleet Stats
  const activeInstitutes = data.institutes.filter((item) => item.status === "ACTIVE").length;
  const suspendedInstitutes = data.institutes.filter((item) => item.status === "SUSPENDED").length;
  const totalStudents = data.counts.reduce((sum, item) => sum + Number(item.activeStudents ?? 0), 0);
  const totalStaff = data.counts.reduce((sum, item) => sum + Number(item.activeStaff ?? 0), 0);
  const totalBatches = data.counts.reduce((sum, item) => sum + Number(item.activeBatches ?? 0), 0);

  const mrr = data.subscriptions
    .filter((sub) => ["ACTIVE", "TRIAL"].includes(String(sub.status)))
    .reduce((sum, sub) => {
      const plan = data.plans.find((p) => p.id === sub.plan_id);
      return sum + Number(plan?.monthly_price_paise ?? 0);
    }, 0);

  // Filtered Institutes
  const filteredInstitutes = data.institutes.filter((item) => {
    const matchesSearch = `${item.name} ${item.slug} ${item.owner_user_id} ${item.contact_email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;

    const sub = data.subscriptions.find((s) => s.organization_id === item.id);
    const instPlan = (sub?.plan_id as string) || "none";
    const matchesPlan =
      planFilter === "ALL" || instPlan.toLowerCase() === planFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <div className="platform-admin" style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Super Admin High-Security Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          padding: "14px 28px",
          backgroundColor: "#0B1528",
          borderBottom: "1px solid rgba(250, 204, 21, 0.2)",
          color: "#ffffff",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <PrepziiLogoIcon className="w-8 h-8" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.02em" }}>
                PREP<span style={{ color: "#FACC15" }}>ZII</span>
              </strong>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(250, 204, 21, 0.15)",
                  color: "#FACC15",
                  border: "1px solid rgba(250, 204, 21, 0.3)",
                  letterSpacing: "0.08em",
                }}
              >
                SUPER ADMIN ROOT
              </span>
            </div>
            <small style={{ color: "#94a3b8", fontSize: "11px" }}>
              Fleet Governance & Central Control Terminal
            </small>
          </div>
        </div>

        {/* Live Vitals Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "12px",
            color: "#cbd5e1",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            padding: "6px 14px",
            borderRadius: "999px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <span style={{ color: "#4ade80" }}>●</span>
          <span>Database: {data.systemHealth?.databaseLatencyMs ?? 14}ms</span>
          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>|</span>
          <span>Storage: Online</span>
          <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>|</span>
          <span>AI: {data.systemHealth?.aiModelName ?? "Gemini 2.5"}</span>
        </div>

        {/* Actions & Session Locking */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/dashboard/workspace"
            style={{
              color: "#FACC15",
              fontSize: "12.5px",
              fontWeight: 600,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(250, 204, 21, 0.1)",
              border: "1px solid rgba(250, 204, 21, 0.25)",
            }}
          >
            ← Institute Portal
          </Link>

          <button
            type="button"
            onClick={handleLockSession}
            style={{
              color: "#f87171",
              fontSize: "12.5px",
              fontWeight: 700,
              background: "none",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Lock Session 🔒
          </button>
        </div>
      </header>

      {/* Main Terminal Area */}
      <main style={{ maxWidth: "1440px", margin: "0 auto", padding: "28px 24px" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            {[
              { id: "overview", label: "Command Center", icon: "📊" },
              { id: "institutes", label: `Institutes Fleet (${data.institutes.length})`, icon: "🏫" },
              { id: "plans", label: "Commercial Plans", icon: "💳" },
              { id: "flags", label: "Feature Switches", icon: "⚡" },
              { id: "audits", label: "Security Audit Trail", icon: "📜" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "10px 10px 0 0",
                    border: "none",
                    borderBottom: isActive ? "3px solid #ca8a04" : "3px solid transparent",
                    backgroundColor: isActive ? "#ffffff" : "transparent",
                    color: isActive ? "#0f172a" : "#64748b",
                    fontSize: "14px",
                    fontWeight: isActive ? 750 : 550,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "institutes" && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                backgroundColor: "#0B1528",
                color: "#FACC15",
                border: "none",
                borderRadius: "10px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(11, 21, 40, 0.15)",
              }}
            >
              <span>+</span>
              <span>Register New Institute</span>
            </button>
          )}
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div
            className="form-error"
            role="alert"
            style={{
              padding: "12px 16px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              color: "#991b1b",
              fontSize: "13.5px",
              marginBottom: "20px",
            }}
          >
            ⚠️ {error}
          </div>
        )}
        {message && (
          <div
            className="success-banner"
            role="status"
            style={{
              padding: "12px 16px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              color: "#166534",
              fontSize: "13.5px",
              marginBottom: "20px",
            }}
          >
            ✓ {message}
          </div>
        )}

        {/* TAB 1: COMMAND CENTER OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "24px" }}>
            {/* KPI Cards */}
            <div className="metrics-grid">
              <MetricCard
                label="Registered Institutes"
                value={String(data.institutes.length)}
                detail={`${activeInstitutes} active · ${suspendedInstitutes} suspended`}
                accent="yellow"
              />
              <MetricCard
                label="Enrolled Students (Fleet)"
                value={totalStudents.toLocaleString("en-IN")}
                detail={`${totalStaff} faculty · ${totalBatches} active batches`}
                accent="blue"
              />
              <MetricCard
                label="Monthly Run Rate (MRR)"
                value={money(mrr)}
                detail={`ARR: ${money(mrr * 12)}`}
                accent="green"
              />
              <MetricCard
                label="Audit Trail Events"
                value={String(data.audits.length)}
                detail="Real-time security ledger"
                accent="navy"
              />
            </div>

            {/* Platform Microservice & Infrastructure Status */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 16px 0", color: "#0f172a" }}>
                Platform Infrastructure & Cloud Providers
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>PostgreSQL Cluster</span>
                    <Badge variant="success">HEALTHY</Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Connection pool active · Latency {data.systemHealth?.databaseLatencyMs ?? 14}ms</div>
                </div>

                <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Supabase Object Storage</span>
                    <Badge variant="success">ONLINE</Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Secure RLS bucket for assignments, OMR, & documents</div>
                </div>

                <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Gemini AI Academic Assistant</span>
                    <Badge variant="success">OPERATIONAL</Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Model: {data.systemHealth?.aiModelName ?? "gemini-2.5-flash"} · Draft promotion enabled</div>
                </div>

                <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Razorpay B2B Billing</span>
                    <Badge variant="info">SANDBOX</Badge>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Automated subscription invoicing & webhook handler ready</div>
                </div>
              </div>
            </div>

            {/* Quick Fleet Highlights */}
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Active Institute Fleet Overview
                  </h2>
                  <small style={{ color: "#64748b" }}>Latest 5 onboarded coaching academies</small>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("institutes")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ca8a04",
                    fontSize: "13px",
                    fontWeight: 750,
                    cursor: "pointer",
                  }}
                >
                  View All Institutes →
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.institutes.slice(0, 5).map((inst) => {
                  const sub = data.subscriptions.find((s) => s.organization_id === inst.id);
                  const count = data.counts.find((c) => c.organizationId === inst.id);

                  return (
                    <div
                      key={String(inst.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{String(inst.name)}</strong>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {String(inst.slug)} · Owner {String(inst.owner_user_id).slice(0, 18)}…
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "#e2e8f0",
                            color: "#334155",
                            textTransform: "uppercase",
                          }}
                        >
                          {String(sub?.plan_id ?? "No plan")}
                        </span>
                        <span style={{ fontSize: "13px", color: "#475569", fontWeight: 600 }}>
                          {Number(count?.activeStudents ?? 0)} Students
                        </span>
                        <Badge variant={inst.status === "ACTIVE" ? "success" : "danger"}>
                          {String(inst.status)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INSTITUTES FLEET COMMAND */}
        {activeTab === "institutes" && (
          <div style={{ display: "grid", gap: "18px" }}>
            {/* Search and Filters */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px 200px",
                gap: "12px",
                backgroundColor: "#ffffff",
                padding: "16px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
              }}
            >
              <input
                type="text"
                placeholder="Search by institute name, workspace slug, or owner ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: "44px",
                  padding: "0 14px",
                  borderRadius: "10px",
                  border: "1px solid #dce2de",
                  outline: "none",
                  fontSize: "13.5px",
                }}
              />

              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                style={{ width: "160px" }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="SUSPENDED">Suspended Only</option>
              </Select>

              <Select
                value={planFilter}
                onChange={(val) => setPlanFilter(val)}
                style={{ width: "160px" }}
              >
                <option value="ALL">All Plans</option>
                <option value="basic">Basic Plan</option>
                <option value="growth">Growth Plan</option>
                <option value="scale">Scale Plan</option>
                <option value="none">No Plan</option>
              </Select>
            </div>

            {/* Institutes Directory Cards */}
            <div style={{ display: "grid", gap: "12px" }}>
              {filteredInstitutes.map((inst) => {
                const sub = data.subscriptions.find((s) => s.organization_id === inst.id);
                const count = data.counts.find((c) => c.organizationId === inst.id);
                const plan = data.plans.find((p) => p.id === sub?.plan_id);
                const studentLimit = Number(plan?.student_limit ?? 100);
                const activeStus = Number(count?.activeStudents ?? 0);
                const quotaPercent = Math.min(100, Math.round((activeStus / studentLimit) * 100));

                return (
                  <div
                    key={String(inst.id)}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      padding: "18px 20px",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "20px",
                      flexWrap: "wrap",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    }}
                  >
                    <div style={{ minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "15px", color: "#0f172a" }}>{String(inst.name)}</strong>
                        <Badge variant={inst.status === "ACTIVE" ? "success" : "danger"}>
                          {String(inst.status)}
                        </Badge>
                      </div>

                      <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "3px" }}>
                        <span>institutes.prepzii.com/<strong>{String(inst.slug)}</strong></span>
                      </div>

                      <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>
                        Owner: <code>{String(inst.owner_user_id)}</code>
                      </div>
                    </div>

                    {/* Quota & Capacity Utilization */}
                    <div style={{ minWidth: "220px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <span style={{ color: "#64748b" }}>Student Quota</span>
                        <strong style={{ color: "#0f172a" }}>
                          {activeStus} / {studentLimit} ({quotaPercent}%)
                        </strong>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${quotaPercent}%`,
                            height: "100%",
                            backgroundColor: quotaPercent > 90 ? "#ef4444" : "#ca8a04",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                        {Number(count?.activeStaff ?? 0)} Staff · {Number(count?.activeBatches ?? 0)} Batches
                      </div>
                    </div>

                    {/* Subscription & Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {/* Plan Assignment Trigger */}
                      <button
                        type="button"
                        onClick={() => setSelectedInstForPlan(inst)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid #dce2de",
                          backgroundColor: "#f8fafc",
                          fontSize: "12.5px",
                          fontWeight: 700,
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        Plan: {String(sub?.plan_id ?? "none").toUpperCase()} ▾
                      </button>

                      {/* Suspend / Reactivate */}
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void mutate("SET_ORGANIZATION_STATUS", {
                            organizationId: inst.id,
                            status: inst.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                          })
                        }
                        style={{
                          color: inst.status === "ACTIVE" ? "#ef4444" : "#166534",
                          borderColor: inst.status === "ACTIVE" ? "#fecaca" : "#bbf7d0",
                          backgroundColor: inst.status === "ACTIVE" ? "#fef2f2" : "#f0fdf4",
                          fontSize: "12.5px",
                        }}
                      >
                        {inst.status === "ACTIVE" ? "Suspend Institute" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredInstitutes.length === 0 && (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "40px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}
                >
                  No institutes match the active search criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COMMERCIAL PLANS */}
        {activeTab === "plans" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  SaaS Commercial Plans & Quotas
                </h2>
                <small style={{ color: "#64748b" }}>
                  Configure student limits, branch caps, monthly AI tokens, and commercial subscription pricing
                </small>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {data.plans.map((plan) => (
                <form
                  key={String(plan.id)}
                  className="admin-plan-card"
                  onSubmit={(event) => void updatePlan(event, plan)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "14px",
                    padding: "20px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  <div className="plan-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                      <span className="plan-id-tag">{String(plan.id).toUpperCase()}</span>
                      <input
                        name="name"
                        defaultValue={String(plan.name)}
                        placeholder="Plan name"
                        className="plan-name-input"
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <label
                        className="check-row"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          cursor: "pointer",
                          margin: 0,
                        }}
                      >
                        <input name="active" type="checkbox" defaultChecked={Boolean(plan.is_active)} />
                        <span>Active for New Signups</span>
                      </label>
                      <Button disabled={busy} type="submit">
                        Save Plan Changes
                      </Button>
                    </div>
                  </div>

                  <div className="plan-card-fields">
                    <label>
                      <span>Monthly Price (₹)</span>
                      <input
                        name="monthly"
                        type="number"
                        min="0"
                        defaultValue={Number(plan.monthly_price_paise) / 100}
                      />
                    </label>
                    <label>
                      <span>Annual Price (₹)</span>
                      <input
                        name="annual"
                        type="number"
                        min="0"
                        defaultValue={Number(plan.annual_price_paise) / 100}
                      />
                    </label>
                    <label>
                      <span>Student Limit</span>
                      <input
                        name="students"
                        type="number"
                        min="1"
                        defaultValue={Number(plan.student_limit)}
                      />
                    </label>
                    <label>
                      <span>Branch/Campus Limit</span>
                      <input
                        name="branches"
                        type="number"
                        min="1"
                        defaultValue={Number(plan.branch_limit)}
                      />
                    </label>
                    <label>
                      <span>Storage (GB)</span>
                      <input
                        name="storage"
                        type="number"
                        min="1"
                        defaultValue={Number(plan.storage_gb)}
                      />
                    </label>
                    <label>
                      <span>AI Credits / Month</span>
                      <input
                        name="ai"
                        type="number"
                        min="0"
                        defaultValue={Number(plan.ai_credits_per_month)}
                      />
                    </label>
                  </div>
                </form>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FEATURE SWITCHES */}
        {activeTab === "flags" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr", gap: "20px", alignItems: "start" }}>
            <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 16px 0", color: "#0f172a" }}>
                Platform Feature Flags & Killswitches
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.flags.map((flag) => (
                  <div
                    key={String(flag.key)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid #f1f5f9",
                      backgroundColor: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a", fontFamily: "var(--font-mono, monospace)" }}>
                        {String(flag.key)}
                      </strong>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        {String(flag.description)}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Badge variant={flag.enabled_by_default ? "success" : "neutral"}>
                        {flag.enabled_by_default ? "ENABLED" : "DISABLED"}
                      </Badge>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate("SET_FEATURE_FLAG", {
                            key: flag.key,
                            description: flag.description,
                            enabled: !flag.enabled_by_default,
                          })
                        }
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          color: "#334155",
                        }}
                      >
                        Toggle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* New Feature Flag Creator */}
            <form
              onSubmit={(e) => void saveFlag(e)}
              style={{
                backgroundColor: "#ffffff",
                padding: "20px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gap: "12px",
              }}
            >
              <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Register New Feature Switch
              </h2>
              <input
                name="key"
                required
                placeholder="e.g. feature.ai_exam_generator"
                style={{
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  border: "1px solid #dce2de",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
              <textarea
                name="description"
                required
                rows={3}
                placeholder="Rollout context and target capability description…"
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #dce2de",
                  fontSize: "13px",
                }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <input name="enabled" type="checkbox" />
                <span>Enabled by default for all institutes</span>
              </label>
              <Button disabled={busy}>Register Switch</Button>
            </form>
          </div>
        )}

        {/* TAB 5: SECURITY AUDIT TRAIL */}
        {activeTab === "audits" && (
          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "17px", fontWeight: 800, margin: "0 0 16px 0", color: "#0f172a" }}>
              Immutable Platform Audit Ledger
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data.audits.map((audit) => (
                <div
                  key={String(audit.id)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "14px",
                    fontSize: "13px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        backgroundColor: "#0B1528",
                        color: "#FACC15",
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      {String(audit.action).toUpperCase()}
                    </span>
                    <span style={{ color: "#334155" }}>
                      Actor: <strong>{String(audit.actor_user_id)}</strong>
                    </span>
                    {audit.target_organization_id ? (
                      <span style={{ color: "#64748b", fontSize: "12px" }}>
                        → Org: {String(audit.target_organization_id).slice(0, 8)}…
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    {new Date(String(audit.created_at)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                  </div>
                </div>
              ))}

              {data.audits.length === 0 && (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
                  No platform audit events logged yet.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL: REGISTER NEW INSTITUTE DIRECTLY */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Register New Coaching Institute
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateInstitute} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                  Institute Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Allen Career Institute"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid #dce2de",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                  Workspace Slug *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. allen-kota"
                  value={newInstSlug}
                  onChange={(e) =>
                    setNewInstSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-+|-+$/g, "")
                    )
                  }
                  style={{
                    width: "100%",
                    height: "44px",
                    padding: "0 12px",
                    borderRadius: "10px",
                    border: "1px solid #dce2de",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, marginBottom: "4px" }}>
                  Initial Subscription Plan *
                </label>
                <Select
                  value={newInstPlan}
                  onChange={(val) => setNewInstPlan(val)}
                  style={{ width: "100%" }}
                >
                  <option value="basic">Basic Plan (100 Students)</option>
                  <option value="growth">Growth Plan (500 Students)</option>
                  <option value="scale">Scale Plan (1,500 Students)</option>
                </Select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <Button disabled={busy || !newInstName.trim() || !newInstSlug.trim()}>
                  {busy ? "Registering…" : "Create Institute Workspace"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PLAN TO INSTITUTE */}
      {selectedInstForPlan && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "18px",
              padding: "28px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "17px", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Assign Plan: {String(selectedInstForPlan.name)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedInstForPlan(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>
              Change the commercial tier for this institute. This updates student limits, storage quotas, and feature entitlements immediately.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {["basic", "growth", "scale"].map((pId) => (
                <button
                  key={pId}
                  type="button"
                  onClick={() => void handleAssignPlan(String(selectedInstForPlan.id), pId)}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#f8fafc",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#0f172a",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef9c3")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                >
                  <span style={{ textTransform: "uppercase" }}>{pId} Plan</span>
                  <span style={{ fontSize: "12px", color: "#854d0e" }}>Apply →</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
