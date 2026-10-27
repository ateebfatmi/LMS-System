"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PrepziiMark } from "@prepzii/ui";

export default function AcceptInvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: params.token }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to accept invitation.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card invite-card">
        <PrepziiMark theme="light" />
        <div className="onboarding-step">SECURE INSTITUTE INVITATION</div>
        <h1>Join your PrepZii workspace</h1>
        <p>Your verified sign-in email must match the address that received this invitation.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="pz-button pz-button-primary" disabled={busy} onClick={() => void accept()}>
          {busy ? "Verifying invitation…" : "Accept invitation →"}
        </button>
      </section>
    </main>
  );
}
