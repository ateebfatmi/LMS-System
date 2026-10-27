"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, MetricCard, Panel } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";
import { resolveActiveOrganization } from "@/lib/client-org";

type Thread = { id: string; student_user_id: string; batch_id: string; subject: string; title: string; description: string; priority: string; status: string; assigned_to: string | null; created_at: string; updated_at: string };
type Message = { id: string; thread_id: string; author_user_id: string; author_role: string; body: string; is_internal: boolean; created_at: string };
type Batch = { id: string; name: string };
type Data = { role: string; threads: Thread[]; messages: Message[]; batches: Batch[] };
const EMPTY: Data = { role: "", threads: [], messages: [], batches: [] };

export function DoubtWorkspace() {
  const [slug, setSlug] = useState<string | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (activeSlug: string) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(activeSlug)}/doubts`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load doubts.");
    setData(result);
    setSelectedId((current) => current && result.threads.some((thread: Thread) => thread.id === current) ? current : result.threads[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void resolveActiveOrganization().then(async (selection) => {
      if (!selection) return;
      setSlug(selection.organization.slug);
      try { await load(selection.organization.slug); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load doubts."); }
    });
  }, [load]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    if (!slug) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/organizations/${encodeURIComponent(slug)}/doubts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save discussion.");
      await load(slug); setNotice(action === "CREATE_THREAD" ? "Doubt submitted to your batch faculty." : "Discussion updated.");
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save discussion."); return false; }
    finally { setBusy(false); }
  }

  const selected = data.threads.find((thread) => thread.id === selectedId) ?? null;
  const student = data.role === "STUDENT";
  const open = data.threads.filter((thread) => thread.status === "OPEN").length;
  const answered = data.threads.filter((thread) => thread.status === "ANSWERED").length;
  const resolved = data.threads.filter((thread) => thread.status === "RESOLVED").length;

  return <DashboardLayout title={student ? "Ask a Doubt" : "Doubt Desk"} subtitle="Batch-scoped, moderated academic discussions">
    <div className="metrics-grid">
      <MetricCard label="Visible threads" value={String(data.threads.length)} detail="Scoped to your role and batches" accent="blue" />
      <MetricCard label="Awaiting answer" value={String(open)} detail="Open questions" accent="orange" />
      <MetricCard label="Answered" value={String(answered)} detail="Ready for student review" accent="yellow" />
      <MetricCard label="Resolved" value={String(resolved)} detail="Closed learning loops" accent="green" />
    </div>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}
    {notice && <div className="success-banner" role="status">{notice}</div>}
    {student && <Panel title="Ask your faculty" subtitle="Use no unnecessary personal or sensitive information">
      <form className="compact-form doubt-create-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const ok = await mutate("CREATE_THREAD", { batchId: String(form.get("batchId")), subject: String(form.get("subject")), title: String(form.get("title")), description: String(form.get("description")), priority: String(form.get("priority")) }); if (ok) event.currentTarget.reset(); }}>
        <select name="batchId" required><option value="">Choose batch</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select>
        <input name="subject" required minLength={2} placeholder="Subject or chapter" />
        <input name="title" required minLength={3} placeholder="What do you need help with?" />
        <textarea name="description" required minLength={3} placeholder="Show what you tried and where you got stuck" />
        <select name="priority"><option value="NORMAL">Normal</option><option value="HIGH">High — blocking current work</option></select>
        <Button disabled={busy}>Submit doubt</Button>
      </form>
    </Panel>}
    <div className="doubt-layout">
      <Panel title={student ? "My doubts" : "Faculty queue"}>
        <div className="doubt-thread-list">
          {data.threads.map((thread) => <button type="button" key={thread.id} className={selectedId === thread.id ? "selected" : ""} onClick={() => setSelectedId(thread.id)}><span><strong>{thread.title}</strong><small>{thread.subject} · {new Date(thread.updated_at).toLocaleDateString("en-IN")}</small></span><span><Badge variant={thread.priority === "HIGH" ? "danger" : "neutral"}>{thread.priority}</Badge><Badge variant={thread.status === "RESOLVED" ? "success" : thread.status === "ANSWERED" ? "info" : "warning"}>{thread.status}</Badge></span></button>)}
          {!data.threads.length && <p className="empty-state">No doubt threads are visible.</p>}
        </div>
      </Panel>
      <Panel title={selected?.title ?? "Discussion"} subtitle={selected ? `${selected.subject} · student ${selected.student_user_id}` : "Choose a thread"}>
        {selected && <>
          <div className="doubt-messages">{data.messages.filter((message) => message.thread_id === selected.id).map((message) => <article key={message.id} className={message.author_role === "STUDENT" ? "student-message" : "staff-message"}><header><strong>{message.author_role === "STUDENT" ? "Student" : message.author_role.replaceAll("_", " ")}</strong>{message.is_internal && <Badge variant="warning">INTERNAL</Badge>}<small>{new Date(message.created_at).toLocaleString("en-IN")}</small></header><p>{message.body}</p></article>)}</div>
          {selected.status !== "CLOSED" && <form className="compact-form doubt-reply-form" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const ok = await mutate("ADD_MESSAGE", { threadId: selected.id, body: String(form.get("body")), isInternal: !student && form.get("isInternal") === "on" }); if (ok) event.currentTarget.reset(); }}>
            <textarea name="body" required placeholder={student ? "Reply or ask a follow-up" : "Write a clear explanation or next step"} />
            {!student && <label className="check-row"><input name="isInternal" type="checkbox" /> Internal faculty note</label>}
            <Button disabled={busy}>{student ? "Reply" : "Answer"}</Button>
          </form>}
          <div className="doubt-status-actions">
            {selected.status !== "RESOLVED" && <Button disabled={busy} variant="secondary" onClick={() => void mutate("SET_STATUS", { threadId: selected.id, status: "RESOLVED" })}>Mark resolved</Button>}
            {!student && selected.status !== "CLOSED" && <Button disabled={busy} variant="outline" onClick={() => void mutate("SET_STATUS", { threadId: selected.id, status: "CLOSED" })}>Close thread</Button>}
          </div>
        </>}
      </Panel>
    </div>
  </DashboardLayout>;
}
