"use client";

import { useClerk } from "@clerk/nextjs";
import { useState } from "react";

export function SignOutOtherAccount() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="portal-signout"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut({ redirectUrl: "/sign-in" });
      }}
    >
      {busy ? "Signing out…" : "Sign out and use another account"}
    </button>
  );
}
