"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Panel } from "@prepzii/ui";
import { useDashboardInstitute } from "@/components/dashboard-layout";

type Installment = { id: string; title: string; due_date: string; amount: number; paid_amount: number; status: string };
type Ledger = { id: string; student?: string; amount: number; status: string; installments: Installment[] };
type Data = { ledgers: Ledger[]; total: number; canManage: boolean };
type Student = { member_id: string; user_id: string | null; display_name: string };
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

export function FeesWorkspace() {
  const selection = useDashboardInstitute()?.selection;
  const slug = selection?.organization.slug;
  const staff = selection?.permissions?.includes("fees:manage");
  const base = slug && selection.permissions?.includes("fees:read") ? `/api/organizations/${encodeURIComponent(slug)}` : "";
  const [page, setPage] = useState(1);
  const [version, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState({ student: "", batch: "", plan: "" });
  const [count, setCount] = useState(1);
  const [data, setData] = useState<{ key: string; value?: Data; error?: string }>();
  const [academic, setAcademic] = useState<{ key: string; students: Student[]; batches: { id: string; name: string }[]; plans: { id: string; name: string }[]; error?: string }>();
  const query = `${base}/fees?page=${page}`;
  const current = data?.key === query ? data : undefined;
  const optionsUrl = `${base}/fees?${new URLSearchParams({ options: "1", ...search })}`;
  const directory = academic?.key === optionsUrl ? academic : undefined;

  useEffect(() => {
    if (!base) return;
    const controller = new AbortController();
    void fetch(query, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      setData({ key: query, value: await response.json() });
    }).catch(() => {
      if (!controller.signal.aborted) setData({ key: query, error: "Unable to load fees." });
    });
    return () => controller.abort();
  }, [base, query, version]);

  useEffect(() => {
    if (!base || !staff) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(optionsUrl, { signal: controller.signal }).then(async (response) => {
        if (!response.ok) throw new Error();
        setAcademic({ key: optionsUrl, ...await response.json() });
      }).catch(() => {
        if (!controller.signal.aborted) setAcademic({ key: optionsUrl, students: [], batches: [], plans: [], error: "Unable to load assignment options." });
      });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [base, optionsUrl, staff, version]);

  async function save(event: FormEvent<HTMLFormElement>, action: string, payload: (form: FormData) => object) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(`${base}/fees`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload: payload(new FormData(form)) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      form.reset();
      setFeedback("Fee record saved.");
      refresh((value) => value + 1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save the fee operation.");
    } finally {
      setBusy(false);
    }
  }

  if (!base) return <p>Fee records are unavailable for this account.</p>;
  const value = current?.value;
  return (
    <>
      {feedback && <p role="status">{feedback}</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {!current && <p role="status">Loading fees…</p>}
      {value?.canManage && <div className="dashboard-grid">
        <Panel title="Create fee plan">
          <form className="compact-form" onSubmit={(event) => void save(event, "CREATE_PLAN", (form) => {
            const installments = Array.from({ length: count }, (_, index) => ({
              sequenceNumber: index + 1, title: form.get(`title-${index}`), dueDate: form.get(`due-${index}`),
              amountPaise: Math.round(Number(form.get(`amount-${index}`)) * 100),
            }));
            return { name: form.get("name"), targetExam: form.get("exam"), installments,
              totalAmountPaise: installments.reduce((sum, item) => sum + item.amountPaise, 0) };
          })}>
            <label>Plan name<input name="name" required minLength={2} /></label>
            <label>Target exam<select name="exam">{["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"].map((exam) => <option key={exam}>{exam}</option>)}</select></label>
            <label>Installments<select value={count} onChange={(event) => setCount(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((size) => <option key={size}>{size}</option>)}
            </select></label>
            {Array.from({ length: count }, (_, index) => <fieldset key={index}>
              <legend>Installment {index + 1}</legend>
              <label>Title<input name={`title-${index}`} defaultValue={`Installment ${index + 1}`} required /></label>
              <label>Amount (INR)<input name={`amount-${index}`} type="number" min=".01" step=".01" required /></label>
              <label>Due date<input name={`due-${index}`} type="date" required /></label>
            </fieldset>)}
            <Button disabled={busy}>Create plan</Button>
          </form>
        </Panel>
        <Panel title="Assign fee plan">
          <div className="compact-form">
            <label>Find student<input value={search.student} maxLength={120} onChange={(event) => setSearch({ ...search, student: event.target.value })} /></label>
            <label>Find batch<input value={search.batch} maxLength={120} onChange={(event) => setSearch({ ...search, batch: event.target.value })} /></label>
            <label>Find plan<input value={search.plan} maxLength={120} onChange={(event) => setSearch({ ...search, plan: event.target.value })} /></label>
          </div>
          {!directory && <p role="status">Loading assignment options…</p>}
          {directory?.error && <p role="alert">{directory.error}</p>}
          <form className="compact-form" onSubmit={(event) => void save(event, "ASSIGN_PLAN", (form) => ({
            ...Object.fromEntries(form), concessionAmountPaise: Math.round(Number(form.get("concession")) * 100),
          }))}>
            <label>Student<select name="studentId" required defaultValue=""><option value="">Choose an active student</option>
              {directory?.students.filter(({ user_id }) => user_id).map((student) => <option key={student.member_id} value={student.user_id!}>{student.display_name}</option>)}
            </select></label>
            <label>Batch<select name="batchId" required defaultValue=""><option value="">Choose the student’s batch</option>
              {directory?.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select></label>
            <label>Fee plan<select name="planId" required defaultValue=""><option value="">Choose a plan</option>
              {directory?.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select></label>
            <label>Concession (INR)<input type="number" name="concession" step=".01" min="0" defaultValue="0" /></label>
            <Button disabled={busy || !directory || Boolean(directory.error)}>Assign plan</Button>
          </form>
        </Panel>
      </div>}
      {value && <Panel title={value.canManage ? "Student ledgers" : "My fee installments"}>
        {!value.ledgers.length && <p>No fee plans have been assigned.</p>}
        {value.ledgers.map((ledger) => <article key={ledger.id} className="panel">
          <h3>{ledger.student ?? "Fee summary"}</h3>
          <p>{inr.format(ledger.amount)} · {ledger.status}</p>
          {ledger.installments.map((item) => <details key={item.id}>
            <summary>{item.title} · Due {item.due_date} · {inr.format(Math.max(0, item.amount - item.paid_amount))} outstanding</summary>
            <p>{inr.format(item.paid_amount)} paid of {inr.format(item.amount)} · {item.status}</p>
            {value.canManage && item.amount > item.paid_amount && <form className="compact-form"
              onSubmit={(event) => void save(event, "RECORD_PAYMENT", (form) => ({
                studentFeeId: ledger.id, installmentId: item.id,
                amountPaise: Math.round(Number(form.get("amount")) * 100), method: form.get("method"),
                referenceNumber: form.get("reference"),
              }))}>
              <label>Received amount (INR)<input name="amount" type="number" min=".01" step=".01" max={(item.amount - item.paid_amount).toFixed(2)} required /></label>
              <label>Method<select name="method">{["CASH", "UPI", "NET_BANKING", "CARD", "CHEQUE", "DD"].map((method) => <option key={method}>{method}</option>)}</select></label>
              <label>Payment reference<input name="reference" required minLength={2} /></label>
              <Button disabled={busy}>Record payment</Button>
            </form>}
          </details>)}
        </article>)}
        {value.total > 25 && <>
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>{" "}
          <Button variant="outline" disabled={page * 25 >= value.total} onClick={() => setPage(page + 1)}>Next</Button>
        </>}
      </Panel>}
    </>
  );
}
