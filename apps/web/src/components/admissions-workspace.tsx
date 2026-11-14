"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Panel } from "@prepzii/ui";
import { useDashboardInstitute } from "@/components/dashboard-layout";

const stages = ["NEW", "CONTACTED", "COUNSELLING_SCHEDULED", "TRIAL_ATTENDED", "LOST", "CONVERTED"];
const exams = ["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"];
type Lead = { id: string; name: string; email: string | null; phone: string; stage: string; follow_up_date: string | null };

export function AdmissionsWorkspace() {
  const selection = useDashboardInstitute()?.selection;
  const slug = selection?.organization.slug;
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState("");
  const [version, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const endpoint = slug && selection.permissions?.includes("crm:read") ? `/api/organizations/${encodeURIComponent(slug)}/admissions` : "";
  const url = endpoint && `${endpoint}?${new URLSearchParams({ page: String(page), ...(stage ? { stage } : {}) })}`;
  const [result, setResult] = useState<{ url: string; leads: Lead[]; total: number; error?: string }>();
  const current = result?.url === url ? result : undefined;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      setResult({ url, ...await response.json() });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ url, leads: [], total: 0, error: "Unable to load admissions." });
    });
    return () => controller.abort();
  }, [url, version]);

  async function save(action: string, payload: object): Promise<boolean> {
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setFeedback("Admission saved.");
      refresh((value) => value + 1);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save admission.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { email, followUpDate, ...fields } = Object.fromEntries(new FormData(form));
    if (await save("CREATE_LEAD", { ...fields, email: email || undefined, followUpDate: followUpDate || undefined })) {
      form.reset();
      setStage("");
      setPage(1);
    }
  }

  if (!endpoint) return <p>Admissions is available to institute owners and managers.</p>;
  return (
    <div className="dashboard-grid">
      <Panel title="New enquiry">
        <form className="compact-form" onSubmit={create}>
          <label>Student name<input name="name" required minLength={2} maxLength={160} /></label>
          <label>Phone<input type="tel" name="phone" required /></label>
          <label>Email<input type="email" name="email" /></label>
          <label>Target exam<select name="targetExam">{exams.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
          <label>Enquiry source<select name="source">{["WALK_IN", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "OTHER"].map((source) =>
            <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}</select></label>
          <label>Follow-up date<input type="date" name="followUpDate" /></label>
          <Button type="submit" disabled={busy}>Add enquiry</Button>
          {feedback && <p role="status">{feedback}</p>}
        </form>
      </Panel>
      <Panel title="Enquiries">
        <label>Stage <select value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}>
          <option value="">All stages</option>
          {stages.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select></label>
        {!current && <p role="status">Loading admissions…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {current && !current.error && !current.leads.length && <p>No enquiries match this filter.</p>}
        <ul className="invitation-list">
          {current?.leads.map((lead) => <li key={lead.id} className="panel">
            <strong>{lead.name}</strong><p>{lead.phone}{lead.email ? ` · ${lead.email}` : ""}</p>
            {lead.stage === "CONVERTED" ? <p>Converted</p> : <>
              <label>Stage for {lead.name} <select value={lead.stage} disabled={busy}
                onChange={(event) => void save("UPDATE_STAGE", { leadId: lead.id, stage: event.target.value })}>
                {stages.filter((value) => value !== "CONVERTED").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
              </select></label>
              <form className="compact-form" onSubmit={(event) => {
                event.preventDefault();
                void save("UPDATE_FOLLOW_UP", { leadId: lead.id, followUpDate: new FormData(event.currentTarget).get("date") || null });
              }}>
                <label>Follow-up for {lead.name}<input name="date" type="date" defaultValue={lead.follow_up_date ?? ""} /></label>
                <Button disabled={busy} variant="outline">Save follow-up</Button>
              </form>
            </>}
          </li>)}
        </ul>
        <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>{" "}
        <Button variant="outline" disabled={!current || page * 25 >= current.total} onClick={() => setPage(page + 1)}>Next</Button>
      </Panel>
    </div>
  );
}
