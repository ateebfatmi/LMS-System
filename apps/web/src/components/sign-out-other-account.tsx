"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export function SignOutOtherAccount({ redirectUrl = "/sign-in" }: { redirectUrl?: string }) {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="sign-in-account-switch"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut({ redirectUrl });
      }}
    >
      {busy ? "Signing out…" : "Sign out and use another account"}
    </button>
  );
}
