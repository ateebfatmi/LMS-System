"use client";

import { useEffect, useState } from "react";
import { Button, Panel } from "@prepzii/ui";
import { useDashboardInstitute } from "@/components/dashboard-layout";

type SupportRequest = { id: string; reason: string; status: string; expires_at: string | null };

export function SupportRequests() {
  const selection = useDashboardInstitute()?.selection;
  const endpoint = selection?.role === "OWNER" ? `/api/organizations/${encodeURIComponent(selection.organization.slug)}/support` : null;
  const [result, setResult] = useState<{ endpoint: string; requests: SupportRequest[] }>();
  const [version, refresh] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      setResult({ endpoint, requests: (await response.json()).requests });
    }).catch(() => {
      if (!controller.signal.aborted) setFeedback("Unable to load support requests.");
    });
    return () => controller.abort();
  }, [endpoint, version]);

  async function review(requestId: string, decision: string) {
    if (!endpoint) return;
    setBusy(true);
    setFeedback("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId, decision }),
      });
      if (!response.ok) throw new Error();
      setFeedback("Support decision recorded.");
      refresh((value) => value + 1);
    } catch {
      setFeedback("Unable to record the support decision.");
    } finally {
      setBusy(false);
    }
  }

  if (!endpoint) return null;
  const requests = result?.endpoint === endpoint ? result.requests : undefined;
  return <Panel title="Platform support requests">
    <p>Decisions are audited. This workspace grants no access to private institute records.</p>
    {feedback && <p role="status">{feedback}</p>}
    {!requests && !feedback && <p role="status">Loading support requests…</p>}
    {requests?.length === 0 && <p>No support requests.</p>}
    <ul className="invitation-list">
      {requests?.map((request) => <li key={request.id} className="invitation-row">
        <span>{request.reason} · {request.status}</span>
        {request.status === "PENDING" && <>
          <Button disabled={busy} onClick={() => void review(request.id, "APPROVE")}>Approve for 24 hours</Button>
          <Button disabled={busy} variant="outline" onClick={() => void review(request.id, "REJECT")}>Reject</Button>
        </>}
        {request.status === "APPROVED" && <Button disabled={busy} variant="outline" onClick={() => void review(request.id, "REVOKE")}>Revoke approval</Button>}
      </li>)}
    </ul>
  </Panel>;
}
