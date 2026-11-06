"use client";

import { School } from "lucide-react";
import { useState } from "react";
import { instituteInitials } from "@prepzii/contracts";

export function InstituteMark({ name, logoUrl }: { name?: string; logoUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <span className="institute-mark" aria-hidden="true">
      {logoUrl && logoUrl !== failedUrl ? (
        // Serve private logos directly so the same-origin request carries the member session.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(logoUrl)} />
      ) : name ? instituteInitials(name) : <School size={20} />}
    </span>
  );
}
