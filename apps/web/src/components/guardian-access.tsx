"use client";

import { useEffect, useState } from "react";
import { Button, Panel } from "@prepzii/ui";
import { useDashboardInstitute } from "@/components/dashboard-layout";

type GuardianLink = {
  id: string;
  studentId: string;
  studentName: string;
  guardianId?: string;
  guardianEmail?: string;
  relationship: string;
  status: string;
  results?: { id: string; title: string; percentage: number | null; submitted_at: string | null }[];
  attendance?: { recorded: number; present: number; late: number; absent: number; excused: number };
  installments?: { id: string; title: string; dueDate: string; amount: number; paid: number; status: string }[];
};

export function GuardianAccess() {
  const selection = useDashboardInstitute()?.selection;
  const role = selection?.role;
  const slug = selection?.organization.slug;
  const endpoint = slug && (role === "OWNER" || role === "PARENT")
    ? `/api/organizations/${encodeURIComponent(slug)}/guardians` : null;
  const [result, setResult] = useState<{ endpoint: string; links: GuardianLink[]; error?: string }>();
  const [selectedChild, setSelectedChild] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { links } = await response.json() as { links: GuardianLink[] };
      setResult({ endpoint, links });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ endpoint, links: [], error: "Unable to load guardian access." });
    });
    return () => controller.abort();
  }, [endpoint, refresh]);

  if (!endpoint) return null;
  const visible = result?.endpoint === endpoint ? result : null;

  async function review(link: GuardianLink, approved: boolean) {
    if (!endpoint || !link.guardianId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guardianId: link.guardianId, studentId: link.studentId, relationship: link.relationship, approved }),
      });
      if (!response.ok) throw new Error();
      setRefresh((value) => value + 1);
    } catch {
      setError("Unable to update guardian access.");
    } finally {
      setBusy(false);
    }
  }

  const child = visible?.links.find(({ id }) => id === selectedChild) ?? visible?.links[0];
  const shown = role === "PARENT" ? (child ? [child] : []) : visible?.links;
  const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

  return (
    <Panel title={role === "OWNER" ? "Guardian access reviews" : "Linked students"}>
      {(error || visible?.error) && <p role="alert">{error || visible?.error}</p>}
      {!visible && <p role="status">Loading guardian access…</p>}
      {visible && !visible.links.length && <p>No {role === "OWNER" ? "guardian requests" : "approved student links"}.</p>}
      {role === "PARENT" && child && (visible?.links.length ?? 0) > 1 && (
        <label>Student <select value={child.id} onChange={(event) => setSelectedChild(event.target.value)}>
          {visible?.links.map((link) => <option value={link.id} key={link.id}>{link.studentName}</option>)}
        </select></label>
      )}
      <ul className="invitation-list">
        {shown?.map((link) => (
          <li key={link.id} className="invitation-row">
            <strong>{link.studentName}</strong>
            <span>{link.relationship.toLowerCase().replaceAll("_", " ")}</span>
            {role === "PARENT" && (
              <div className="dashboard-grid" style={{ width: "100%" }}>
                <Panel title="Attendance">
                  {link.attendance?.recorded ? <p>{link.attendance.present} present · {link.attendance.late} late · {link.attendance.absent} absent · {link.attendance.excused} excused across {link.attendance.recorded} recent records.</p> : <p>No attendance recorded.</p>}
                </Panel>
                <Panel title="Released assessment results">
                  {!link.results?.length ? <p>No released results.</p> : <ul>
                    {link.results.map((result) => <li key={result.id}>
                      {result.title} · {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString() : "Submitted"}
                      {result.percentage === null ? "" : ` · ${result.percentage}%`}
                    </li>)}
                  </ul>}
                </Panel>
                <Panel title="Fee installments">
                  {!link.installments?.length ? <p>No installments assigned.</p> : <ul>
                    {link.installments.map((item) => <li key={item.id}>{item.title} · Due {item.dueDate} · {currency.format(Math.max(0, item.amount - item.paid))} outstanding</li>)}
                  </ul>}
                </Panel>
              </div>
            )}
            {role === "OWNER" && (
              <>
                <span>{link.guardianEmail} · {link.status.replaceAll("_", " ")}</span>
                {["PENDING_REVIEW", "REVOKED"].includes(link.status) && <Button disabled={busy} onClick={() => void review(link, true)}>Approve access</Button>}
                {["PENDING_REVIEW", "APPROVED"].includes(link.status) && <Button disabled={busy} variant="outline" onClick={() => void review(link, false)}>Revoke access</Button>}
              </>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
