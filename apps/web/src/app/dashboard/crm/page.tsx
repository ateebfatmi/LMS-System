"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Stage = "NEW" | "CONTACTED" | "COUNSELLING_SCHEDULED" | "TRIAL_ATTENDED" | "CONVERTED" | "LOST";
type MutableStage = Exclude<Stage, "CONVERTED">;
type Source = "WALK_IN" | "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "NEWSPAPER" | "CAMPAIGN" | "OTHER";
type Lead = { id: string; name: string; email: string | null; phone: string; guardian_name: string | null; guardian_phone: string | null; target_exam: string; target_batch_id: string | null; source: Source; assigned_counsellor_name: string | null; stage: Stage; follow_up_date: string | null; estimated_fee: number | string; notes: string | null; updated_at: string };
type Batch = { id: string; name: string; target_exam: string };
type Data = { leads: Lead[]; batches: Batch[] };

const stages: Stage[] = ["NEW", "CONTACTED", "COUNSELLING_SCHEDULED", "TRIAL_ATTENDED", "CONVERTED", "LOST"];
const labels: Record<Stage, string> = { NEW: "New inquiry", CONTACTED: "Contacted", COUNSELLING_SCHEDULED: "Counselling set", TRIAL_ATTENDED: "Trial attended", CONVERTED: "Enrolled", LOST: "Lost" };
const variants: Record<Stage, "info" | "neutral" | "warning" | "brand" | "success" | "danger"> = { NEW: "info", CONTACTED: "neutral", COUNSELLING_SCHEDULED: "warning", TRIAL_ATTENDED: "brand", CONVERTED: "success", LOST: "danger" };

export default function CRMPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>({ leads: [], batches: [] });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Stage | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/crm`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Unable to load admissions CRM."); return; }
    setData(result); setError("");
  }, []);

  useEffect(() => { void (async () => {
    const response = await fetch("/api/organizations/active", { cache: "no-store" });
    const active = response.ok ? (await response.json()).organization as Organization | null : null;
    setOrganization(active);
    if (active) await load(active); else setError("Select an institute before opening admissions CRM.");
  })(); }, [load]);

  const visible = useMemo(() => data.leads.filter((lead) => {
    const needle = search.toLowerCase();
    return (filter === "ALL" || lead.stage === filter) && (!needle || `${lead.name} ${lead.phone} ${lead.guardian_name ?? ""}`.toLowerCase().includes(needle));
  }), [data.leads, filter, search]);
  const converted = data.leads.filter((lead) => lead.stage === "CONVERTED").length;
  const active = data.leads.filter((lead) => !["CONVERTED", "LOST"].includes(lead.stage)).length;

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!organization) return false;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/crm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save CRM change.");
    else { setMessage("Admissions pipeline updated."); await load(organization); }
    setBusy(false); return response.ok;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await mutate("CREATE_LEAD", {
      name: form.get("name"), phone: form.get("phone"), email: String(form.get("email") || "") || null,
      guardianName: String(form.get("guardianName") || "") || null, guardianPhone: String(form.get("guardianPhone") || "") || null,
      targetExam: form.get("targetExam"), targetBatchId: String(form.get("targetBatchId") || "") || null,
      source: form.get("source"), assignedCounsellorName: String(form.get("counsellor") || "") || null,
      followUpDate: String(form.get("followUpDate") || "") || null,
      estimatedFeePaise: Math.round(Number(form.get("estimatedFee") || 0) * 100), notes: String(form.get("notes") || "") || null,
    });
    if (ok) setShowForm(false);
  }

  async function convertLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || !convertingLead) return;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const batchId = text("batchId");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: "STUDENT",
        displayName: form.get("displayName"),
        email: form.get("email"),
        phone: text("phone"),
        rollNumber: text("rollNumber"),
        batchId: batchId || null,
        guardianName: text("guardianName"),
        guardianPhone: text("guardianPhone"),
        joinedOn: text("joinedOn") || new Date().toISOString().split("T")[0],
        leadId: convertingLead.id,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to enroll student from lead.");
    } else {
      setConvertingLead(null);
      setMessage(`Successfully enrolled ${convertingLead.name} into batch.`);
      await load(organization);
    }
    setBusy(false);
  }

  return <DashboardLayout title="Admissions CRM" subtitle={`${organization?.name ?? "Institute"} · Audited inquiry and follow-up pipeline`} action={<Button onClick={() => setShowForm((value) => !value)}>{showForm ? "Close form" : "＋ New lead"}</Button>}>
    <div className="metrics-grid"><MetricCard label="Total inquiries" value={String(data.leads.length)} detail="All recorded leads" accent="yellow"/><MetricCard label="Active pipeline" value={String(active)} detail="Requires follow-up" accent="navy"/><MetricCard label="Enrolled" value={String(converted)} detail="Completed onboarding" accent="green"/><MetricCard label="Conversion rate" value={`${data.leads.length ? Math.round(converted / data.leads.length * 1000) / 10 : 0}%`} detail="Lead to enrolled student" accent="orange"/></div>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    {showForm && <Panel title="Record an admission inquiry"><form className="crm-form" onSubmit={(event) => void create(event)}><label>Student name<input name="name" required minLength={2}/></label><label>Phone<input name="phone" required minLength={7}/></label><label>Email<input name="email" type="email"/></label><label>Guardian name<input name="guardianName"/></label><label>Guardian phone<input name="guardianPhone"/></label><label>Target exam<select name="targetExam" defaultValue="JEE_MAIN"><option>JEE_MAIN</option><option>JEE_ADVANCED</option><option>NEET</option><option>FOUNDATION</option><option>BOARDS</option><option>OTHER</option></select></label><label>Target batch<select name="targetBatchId"><option value="">Not selected</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label><label>Source<select name="source" defaultValue="WALK_IN"><option>WALK_IN</option><option>WEBSITE</option><option>REFERRAL</option><option>SOCIAL_MEDIA</option><option>NEWSPAPER</option><option>CAMPAIGN</option><option>OTHER</option></select></label><label>Follow-up<input name="followUpDate" type="date"/></label><label>Estimated fee (INR)<input name="estimatedFee" type="number" min="0" step="0.01"/></label><label>Counsellor<input name="counsellor"/></label><label className="crm-notes">Notes<textarea name="notes" rows={3}/></label><Button disabled={busy}>{busy ? "Saving…" : "Save lead"}</Button></form></Panel>}
    <div className="directory-toolbar"><input aria-label="Search admissions leads" placeholder="Search name, phone or guardian" value={search} onChange={(event) => setSearch(event.target.value)}/><select aria-label="Filter lead stage" value={filter} onChange={(event) => setFilter(event.target.value as Stage | "ALL")}><option value="ALL">All stages</option>{stages.map((stage) => <option key={stage} value={stage}>{labels[stage]}</option>)}</select></div>
    <div className="crm-board">{stages.map((stage) => <section className="panel crm-column" key={stage}><header><Badge variant={variants[stage]}>{labels[stage]}</Badge><strong>{visible.filter((lead) => lead.stage === stage).length}</strong></header>{visible.filter((lead) => lead.stage === stage).map((lead) => <article key={lead.id}><div><strong>{lead.name}</strong><small>{lead.phone} · {lead.target_exam.replaceAll("_", " ")}</small></div><span>₹{Number(lead.estimated_fee).toLocaleString("en-IN")}</span>{lead.follow_up_date && <small>Follow-up {new Date(`${lead.follow_up_date}T00:00:00`).toLocaleDateString("en-IN")}</small>}{lead.stage !== "CONVERTED" && <div className="crm-card-actions"><select aria-label={`Update stage for ${lead.name}`} value={lead.stage} disabled={busy} onChange={(event) => void mutate("UPDATE_STAGE", { leadId: lead.id, stage: event.target.value as MutableStage })}>{stages.filter((item) => item !== "CONVERTED").map((item) => <option key={item}>{item}</option>)}</select><Button variant="secondary" className="btn-xs" disabled={busy} onClick={() => setConvertingLead(lead)}>Enroll student</Button></div>}</article>)}{!visible.some((lead) => lead.stage === stage) && <p className="empty-state">No leads</p>}</section>)}</div>

    {/* Lead-to-Student Enrollment Modal */}
    {convertingLead && (
      <div className="modal-backdrop" role="presentation">
        <form className="member-editor" onSubmit={convertLead}>
          <header>
            <div>
              <h2>Enroll lead as student</h2>
              <p>Convert {convertingLead.name} into an enrolled student with active membership and batch assignment.</p>
            </div>
            <button type="button" onClick={() => setConvertingLead(null)} aria-label="Close">✕</button>
          </header>
          <div className="member-editor-grid">
            <label>Student Name *<input name="displayName" required minLength={2} defaultValue={convertingLead.name} /></label>
            <label>Email Address *<input name="email" type="email" required defaultValue={convertingLead.email || `${convertingLead.phone}@student.local`} /></label>
            <label>Phone Number<input name="phone" defaultValue={convertingLead.phone} /></label>
            <label>Roll Number<input name="rollNumber" placeholder="e.g. JEE-26-001" /></label>
            <label>Enrolled Batch<select name="batchId" defaultValue={convertingLead.target_batch_id || ""}><option value="">Select Batch (Optional)</option>{data.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label>Guardian Name<input name="guardianName" defaultValue={convertingLead.guardian_name || ""} /></label>
            <label>Guardian Phone<input name="guardianPhone" defaultValue={convertingLead.guardian_phone || ""} /></label>
            <label>Enrollment Date<input name="joinedOn" type="date" defaultValue={new Date().toISOString().split("T")[0]} /></label>
          </div>
          <footer>
            <Button type="button" variant="outline" onClick={() => setConvertingLead(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Enrolling…" : "Complete Enrollment"}</Button>
          </footer>
        </form>
      </div>
    )}

    <p className="readiness-note">A lead is marked enrolled only after the reviewed student onboarding flow links a real membership. CRM stage changes cannot create student accounts.</p>
  </DashboardLayout>;
}
