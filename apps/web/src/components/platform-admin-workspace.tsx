"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, MetricCard } from "@prepzii/ui";

type Row = Record<string, unknown>;
type Data = { institutes: Row[]; subscriptions: Row[]; plans: Row[]; flags: Row[]; audits: Row[]; counts: Row[] };
const empty: Data = { institutes: [], subscriptions: [], plans: [], flags: [], audits: [], counts: [] };
const money = (paise: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(paise ?? 0) / 100);

export function PlatformAdminWorkspace() {
  const [data, setData] = useState<Data>(empty); const [search, setSearch] = useState(""); const [status, setStatus] = useState("ALL"); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch("/api/platform", { cache: "no-store" }); const result = await response.json(); if (response.ok) { setData(result); setError(""); } else setError(result.error ?? "Unable to load platform administration."); }, []);
  useEffect(() => { const task = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(task); }, [load]);
  async function mutate(action: string, payload: Row) { setBusy(true); setError(""); setMessage(""); const response = await fetch("/api/platform", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) }); const result = await response.json(); if (!response.ok) setError(result.error ?? "Unable to save platform operation."); else { setMessage("Platform operation saved and audited."); await load(); } setBusy(false); return response.ok; }
  async function updatePlan(event: FormEvent<HTMLFormElement>, plan: Row) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate("UPDATE_PLAN", { planId: plan.id, name: form.get("name"), monthlyPricePaise: Math.round(Number(form.get("monthly")) * 100), annualPricePaise: Math.round(Number(form.get("annual")) * 100), studentLimit: Number(form.get("students")), branchLimit: Number(form.get("branches")), storageGb: Number(form.get("storage")), aiCreditsPerMonth: Number(form.get("ai")), entitlements: plan.entitlements ?? {}, isActive: form.get("active") === "on" }); }
  async function saveFlag(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); if (await mutate("SET_FEATURE_FLAG", { key: form.get("key"), description: form.get("description"), enabled: form.get("enabled") === "on" })) event.currentTarget.reset(); }
  const institutes = data.institutes.filter((item) => (status === "ALL" || item.status === status) && `${item.name} ${item.slug} ${item.owner_user_id}`.toLowerCase().includes(search.toLowerCase()));
  const active = data.institutes.filter((item) => item.status === "ACTIVE").length; const students = data.counts.reduce((sum, item) => sum + Number(item.activeStudents ?? 0), 0); const mrr = data.subscriptions.filter((sub) => ["ACTIVE", "TRIAL"].includes(String(sub.status))).reduce((sum, sub) => sum + Number(data.plans.find((plan) => plan.id === sub.plan_id)?.monthly_price_paise ?? 0), 0);
  return <div className="platform-admin"><header><div><strong>PrepZii platform administration</strong><Badge variant="warning">SERVER-ALLOWLIST ONLY</Badge></div><Link href="/dashboard">Return to institute workspace</Link></header><main><div className="platform-title"><div><h1>Institutes, plans & controls</h1><p>Real tenant status, subscription, quota and audit data.</p></div></div>{error && <div className="form-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}<div className="metrics-grid"><MetricCard label="Institutes" value={String(data.institutes.length)} detail={`${active} active`} accent="yellow"/><MetricCard label="Active students" value={students.toLocaleString("en-IN")} detail="Across active memberships" accent="blue"/><MetricCard label="Monthly run rate" value={money(mrr)} detail="Configured plan rates" accent="green"/><MetricCard label="Audit events" value={String(data.audits.length)} detail="Most recent 100 loaded" accent="navy"/></div><div className="platform-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, slug, owner ID"/><select value={status} onChange={(event) => setStatus(event.target.value)}><option>ALL</option><option>ACTIVE</option><option>SUSPENDED</option></select></div><section className="panel platform-institutes"><h2>Institute directory</h2>{institutes.map((item) => { const subscription = data.subscriptions.find((sub) => sub.organization_id === item.id); const counts = data.counts.find((count) => count.organizationId === item.id); return <article key={String(item.id)}><div><strong>{String(item.name)}</strong><small>{String(item.slug)} · owner {String(item.owner_user_id)}</small></div><div><Badge variant={item.status === "ACTIVE" ? "success" : "danger"}>{String(item.status)}</Badge><span>{String(subscription?.plan_id ?? "No plan")} · {Number(counts?.activeStudents ?? 0)} students</span><Button variant="secondary" disabled={busy} onClick={() => void mutate("SET_ORGANIZATION_STATUS", { organizationId: item.id, status: item.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}>{item.status === "ACTIVE" ? "Suspend" : "Reactivate"}</Button></div></article>; })}{!institutes.length && <p className="empty-state">No matching institutes.</p>}</section><div className="platform-grid">        <section className="panel platform-plans-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0 }}>Commercial plans</h2>
              <small style={{ color: "var(--muted)", fontSize: "12px" }}>Subscription tiers, student quotas, and platform feature entitlements</small>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {data.plans.map((plan) => (
              <form key={String(plan.id)} className="admin-plan-card" onSubmit={(event) => void updatePlan(event, plan)}>
                <div className="plan-card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <span className="plan-id-tag">{String(plan.id).toUpperCase()}</span>
                    <input name="name" defaultValue={String(plan.name)} placeholder="Plan name" className="plan-name-input" />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <label className="check-row" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", margin: 0 }}>
                      <input name="active" type="checkbox" defaultChecked={Boolean(plan.is_active)} />
                      <span>Active</span>
                    </label>
                    <Button disabled={busy} type="submit">Save plan</Button>
                  </div>
                </div>
                <div className="plan-card-fields">
                  <label>
                    <span>Monthly (₹)</span>
                    <input name="monthly" type="number" min="0" defaultValue={Number(plan.monthly_price_paise) / 100} />
                  </label>
                  <label>
                    <span>Annual (₹)</span>
                    <input name="annual" type="number" min="0" defaultValue={Number(plan.annual_price_paise) / 100} />
                  </label>
                  <label>
                    <span>Max Students</span>
                    <input name="students" type="number" min="1" defaultValue={Number(plan.student_limit)} />
                  </label>
                  <label>
                    <span>Max Branches</span>
                    <input name="branches" type="number" min="1" defaultValue={Number(plan.branch_limit)} />
                  </label>
                  <label>
                    <span>Storage (GB)</span>
                    <input name="storage" type="number" min="1" defaultValue={Number(plan.storage_gb)} />
                  </label>
                  <label>
                    <span>AI Credits/mo</span>
                    <input name="ai" type="number" min="0" defaultValue={Number(plan.ai_credits_per_month)} />
                  </label>
                </div>
              </form>
            ))}
          </div>
        </section><section className="panel platform-side"><form className="compact-form" onSubmit={(event) => void saveFlag(event)}><h2>Feature flag</h2><input name="key" required placeholder="feature.name"/><input name="description" required placeholder="Purpose and rollout context"/><label className="check-row"><input name="enabled" type="checkbox"/> Enabled by default</label><Button disabled={busy}>Save flag</Button></form><h2>Feature flags</h2>{data.flags.map((flag) => <article key={String(flag.key)}><div><strong>{String(flag.key)}</strong><small>{String(flag.description)}</small></div><Badge variant={flag.enabled_by_default ? "success" : "neutral"}>{flag.enabled_by_default ? "ON" : "OFF"}</Badge></article>)}<h2>Audit trail</h2>{data.audits.slice(0,20).map((audit) => <article key={String(audit.id)}><div><strong>{String(audit.action)}</strong><small>{String(audit.actor_user_id)} · {new Date(String(audit.created_at)).toLocaleString("en-IN")}</small></div></article>)}</section></div></main></div>;
}
