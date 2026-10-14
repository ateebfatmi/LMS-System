"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@prepzii/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error securely in production monitoring
    console.error("Application runtime error caught by boundary:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-prepzii-body, system-ui, sans-serif)",
        background: "#f8fafc",
        textAlign: "center",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          border: "1px solid var(--line, #e2e8f0)",
          padding: "40px",
          maxWidth: "480px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
        <h1 style={{ fontSize: "22px", margin: "0 0 10px", color: "#0f172a" }}>
          Something unexpected occurred
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px", lineHeight: "1.5" }}>
          We encountered an issue processing your request. The incident has been recorded for diagnostics.
        </p>

        {error.digest && (
          <div
            style={{
              background: "#f1f5f9",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              color: "#475569",
              fontFamily: "monospace",
              marginBottom: "20px",
            }}
          >
            Digest: {error.digest}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Button variant="primary" onClick={() => reset()}>
            ↻ Try Again
          </Button>
          <Link href="/dashboard" className="pz-button pz-button-outline" style={{ textDecoration: "none" }}>
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
