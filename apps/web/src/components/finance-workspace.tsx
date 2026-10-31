"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, DatePicker, MetricCard } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

type Organization = { name: string; slug: string };
type Row = Record<string, unknown>;
type Data = { role: string; plans: Row[]; planInstallments: Row[]; batches: Row[]; academicYears: Row[]; students: Row[]; ledgers: Row[]; installments: Row[]; transactions: Row[]; invoices: Row[] };
const empty: Data = { role: "", plans: [], planInstallments: [], batches: [], academicYears: [], students: [], ledgers: [], installments: [], transactions: [], invoices: [] };
const money = (value: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));
const paise = (value: FormDataEntryValue | null) => Math.round(Number(value ?? 0) * 100);

export function FinanceWorkspace() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [data, setData] = useState<Data>(empty);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (active: Organization) => {
    const response = await fetch(`/api/organizations/${encodeURIComponent(active.slug)}/finance`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) { setData(result); setError(""); }
    else setError(result.error ?? "Unable to load institute finances.");
  }, []);

  useEffect(() => {
    async function initialize() {
      const response = await fetch("/api/organizations/active", { cache: "no-store" });
      const active = response.ok ? (await response.json()).organization as Organization | null : null;
      setOrganization(active);
      if (active) await load(active); else setError("Select an institute before opening fees.");
    }
    void initialize();
  }, [load]);

  async function mutate(action: string, payload: Row) {
    if (!organization) return false;
    setBusy(true); setError(""); setMessage("");
    const response = await fetch(`/api/organizations/${encodeURIComponent(organization.slug)}/finance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to save finance operation.");
    else { setMessage(result.result.receiptNumber ? `Saved. Receipt ${result.result.receiptNumber}` : "Finance record saved."); await load(organization); }
    setBusy(false);
    return response.ok;
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const total = paise(form.get("total"));
    const first = Math.floor(total / 3); const amounts = [first, first, total - first * 2];
    const installments = [1,2,3].map((sequenceNumber, index) => ({ sequenceNumber, title: `Installment ${sequenceNumber}`, amountPaise: amounts[index], dueDate: String(form.get(`due${sequenceNumber}`)) }));
    if (await mutate("CREATE_PLAN", { name: String(form.get("name")), targetExam: String(form.get("targetExam")), totalAmountPaise: total, installments })) event.currentTarget.reset();
  }
  async function assignPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutate("ASSIGN_PLAN", { planId: form.get("planId"), studentId: form.get("studentId"), batchId: form.get("batchId"), academicYearId: form.get("academicYearId") || null, concessionAmountPaise: paise(form.get("concession")), concessionReason: String(form.get("reason") || "") || null })) event.currentTarget.reset();
  }
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const installmentId = String(form.get("installmentId")); const installment = data.installments.find((item) => item.id === installmentId);
    if (!installment) return;
    if (await mutate("RECORD_PAYMENT", { studentFeeId: installment.student_fee_id, installmentId, amountPaise: paise(form.get("amount")), method: form.get("method"), referenceNumber: form.get("reference"), notes: String(form.get("notes") || "") || null })) event.currentTarget.reset();
  }
  async function refundPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    if (await mutate("REFUND_PAYMENT", { transactionId: form.get("transactionId"), amountPaise: paise(form.get("amount")), referenceNumber: form.get("reference"), reason: form.get("reason") })) event.currentTarget.reset();
  }

  const staff = data.role !== "STUDENT";
  const paid = data.transactions.reduce((sum, item) => sum + (item.transaction_type === "PAYMENT" ? Number(item.amount) : item.transaction_type === "REFUND" ? -Number(item.amount) : 0), 0);
  const billed = data.ledgers.reduce((sum, item) => sum + Number(item.net_payable ?? 0), 0);
  const overdue = data.installments.filter((item) => item.status !== "PAID" && String(item.due_date) < new Intl.DateTimeFormat("en-CA").format(new Date())).reduce((sum, item) => sum + Number(item.amount) - Number(item.paid_amount), 0);

  return <DashboardLayout title={staff ? "Institute fee ledger" : "My fees & receipts"} subtitle={`${organization?.name ?? "Institute"} · INR ledger with audited payments and refunds`}>
    <div className="metrics-grid"><MetricCard label="Net billed" value={money(billed)} detail={`${data.ledgers.length} student ledgers`} accent="navy"/><MetricCard label="Net collected" value={money(paid)} detail="Payments less refunds" accent="green"/><MetricCard label="Outstanding" value={money(Math.max(0, billed - paid))} detail="Authoritative ledger balance" accent="yellow"/><MetricCard label="Overdue" value={money(overdue)} detail="Past-due installments" accent="orange"/></div>
    {error && <div className="form-error directory-error" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    {staff && <div className="finance-tools"><form className="panel compact-form" onSubmit={(event) => void createPlan(event)}><h2>Create fee plan</h2><input name="name" placeholder="JEE 2027 annual fee" required/><select name="targetExam"><option>JEE_MAIN</option><option>JEE_ADVANCED</option><option>NEET</option><option>FOUNDATION</option><option>BOARDS</option><option>OTHER</option></select><input name="total" type="number" min="1" step="0.01" placeholder="Total INR" required/><div><DatePicker name="due1" required placeholder="Due date 1"/><DatePicker name="due2" required placeholder="Due date 2"/><DatePicker name="due3" required placeholder="Due date 3"/></div><Button disabled={busy}>Create 3-part plan</Button></form><form className="panel compact-form" onSubmit={(event) => void assignPlan(event)}><h2>Assign plan</h2><select name="planId" required><option value="">Choose plan</option>{data.plans.map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.name)} · {money(item.total_amount)}</option>)}</select><select name="studentId" required><option value="">Choose student</option>{data.students.map((item) => <option value={String(item.user_id)} key={String(item.member_id)}>{String(item.display_name)} · {String(item.email)}</option>)}</select><select name="batchId" required><option value="">Choose enrolled batch</option>{data.batches.map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.name)}</option>)}</select><select name="academicYearId"><option value="">No academic year</option>{data.academicYears.map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.name)}</option>)}</select><input name="concession" type="number" min="0" step="0.01" defaultValue="0" placeholder="Concession INR"/><input name="reason" placeholder="Concession reason"/><Button disabled={busy}>Create ledger & invoice</Button></form><form className="panel compact-form" onSubmit={(event) => void recordPayment(event)}><h2>Record verified payment</h2><select name="installmentId" required><option value="">Choose unpaid installment</option>{data.installments.filter((item) => item.status !== "PAID").map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.title)} · due {money(Number(item.amount) - Number(item.paid_amount))}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount INR" required/><select name="method"><option>UPI</option><option>NET_BANKING</option><option>CARD</option><option>CHEQUE</option><option>CASH</option><option>DD</option></select><input name="reference" placeholder="Bank / UPI / manual reference" required/><input name="notes" placeholder="Optional note"/><Button disabled={busy}>Record payment</Button></form><form className="panel compact-form" onSubmit={(event) => void refundPayment(event)}><h2>Record refund</h2><select name="transactionId" required><option value="">Choose payment</option>{data.transactions.filter((item) => item.transaction_type === "PAYMENT").map((item) => <option value={String(item.id)} key={String(item.id)}>{String(item.receipt_number)} · {money(item.amount)}</option>)}</select><input name="amount" type="number" min="0.01" step="0.01" placeholder="Refund INR" required/><input name="reference" placeholder="Refund reference" required/><input name="reason" placeholder="Required reason" required/><Button variant="secondary" disabled={busy}>Record refund</Button></form></div>}
    <div className="finance-ledger"><section className="panel"><h2>Student ledgers</h2>{data.ledgers.map((ledger) => { const items = data.installments.filter((item) => item.student_fee_id === ledger.id); const student = data.students.find((item) => item.user_id === ledger.student_id); return <article className="ledger-row" key={String(ledger.id)}><div><strong>{String(student?.display_name ?? ledger.student_id)}</strong><small>{money(ledger.net_payable)} net · {money(ledger.concession_amount)} concession</small></div><Badge variant={ledger.status === "PAID" ? "success" : ledger.status === "OVERDUE" ? "danger" : "warning"}>{String(ledger.status)}</Badge><div className="installment-chips">{items.map((item) => <span key={String(item.id)}>{String(item.title)}: {money(Number(item.amount) - Number(item.paid_amount))} due</span>)}</div></article>; })}{!data.ledgers.length && <p className="empty-state">No fee ledger has been assigned.</p>}</section><section className="panel"><h2>Invoices & receipts</h2>{data.invoices.map((invoice) => <article className="finance-event" key={String(invoice.id)}><div><strong>{String(invoice.invoice_number)}</strong><small>{String(invoice.due_date)} · {money(invoice.amount)}</small></div><Badge variant={invoice.status === "PAID" ? "success" : "neutral"}>{String(invoice.status)}</Badge></article>)}{data.transactions.map((transaction) => <article className="finance-event" key={String(transaction.id)}><div><strong>{String(transaction.receipt_number)}</strong><small>{String(transaction.transaction_type)} · {String(transaction.method)} · {String(transaction.reference_number)}</small></div><span className={transaction.transaction_type === "REFUND" ? "refund-amount" : "payment-amount"}>{transaction.transaction_type === "REFUND" ? "−" : "+"}{money(transaction.amount)}</span></article>)}{!data.invoices.length && !data.transactions.length && <p className="empty-state">No invoices or receipts yet.</p>}</section></div>
  </DashboardLayout>;
}
