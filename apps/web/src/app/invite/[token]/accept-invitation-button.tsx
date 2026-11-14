"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to accept invitation.");
        return;
      }
      router.replace("/dashboard/workspace");
      router.refresh();
    } catch {
      setError("Unable to accept invitation. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="pz-button pz-button-primary" disabled={busy} onClick={() => void accept()}>
        {busy ? "Verifying invitation…" : "Accept invitation"}
      </button>
    </>
  );
}
