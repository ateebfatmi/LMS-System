"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrepziiLogoIcon } from "@prepzii/ui";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [accessKey, setAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/platform/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed. Invalid master key.");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to connect to platform authentication gateway.");
      setLoading(false);
    }
  };

  const handleDevUnlock = () => {
    setAccessKey("prepzii-root-2026");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#060D1A",
        backgroundImage: `
          radial-gradient(circle at 50% 15%, rgba(250, 204, 21, 0.12) 0%, transparent 45%),
          linear-gradient(180deg, #060D1A 0%, #0B1528 50%, #040810 100%)
        `,
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "rgba(11, 21, 40, 0.85)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(250, 204, 21, 0.25)",
          borderRadius: "24px",
          padding: "40px 36px",
          boxShadow: "0 28px 70px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(250, 204, 21, 0.08)",
          color: "#ffffff",
        }}
      >
        {/* Top Branding */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "rgba(250, 204, 21, 0.12)",
              border: "1px solid rgba(250, 204, 21, 0.3)",
              marginBottom: "16px",
              boxShadow: "0 0 24px rgba(250, 204, 21, 0.2)",
            }}
          >
            <PrepziiLogoIcon className="w-10 h-10" />
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              borderRadius: "999px",
              backgroundColor: "rgba(250, 204, 21, 0.12)",
              border: "1px solid rgba(250, 204, 21, 0.3)",
              color: "#FACC15",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            <span>🛡️</span>
            <span>Root Platform Access</span>
          </div>

          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#ffffff",
              margin: "0 0 8px 0",
              letterSpacing: "-0.02em",
            }}
          >
            Super Admin Control Center
          </h1>
          <p
            style={{
              fontSize: "13.5px",
              color: "#94a3b8",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Restricted access for institute fleet administration, SaaS quotas, and platform governance.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              color: "#fca5a5",
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "18px" }}>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <label
                style={{
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#e2e8f0",
                }}
              >
                Master Security Key
              </label>
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showKey ? "Hide key" : "Show key"}
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                required
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Enter root master passcode…"
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 14px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  backgroundColor: "rgba(6, 13, 26, 0.7)",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "var(--font-mono, monospace)",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "all 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#FACC15";
                  e.currentTarget.style.boxShadow = "0 0 0 4px rgba(250, 204, 21, 0.18)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !accessKey.trim()}
            style={{
              height: "48px",
              borderRadius: "12px",
              border: "none",
              backgroundColor: "#FACC15",
              color: "#0B1528",
              fontSize: "14.5px",
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !accessKey.trim() ? 0.7 : 1,
              boxShadow: "0 4px 16px rgba(250, 204, 21, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "transform 0.1s ease, box-shadow 0.15s ease",
            }}
          >
            {loading ? "Authenticating Platform Root…" : "Unlock Super Admin Control →"}
          </button>
        </form>

        {/* Development Quick Helper */}
        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
          }}
        >
          <span style={{ color: "#94a3b8" }}>Dev Environment Key:</span>
          <button
            type="button"
            onClick={handleDevUnlock}
            style={{
              background: "rgba(250, 204, 21, 0.12)",
              border: "1px solid rgba(250, 204, 21, 0.25)",
              borderRadius: "6px",
              color: "#FACC15",
              fontWeight: 700,
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            Auto-fill Master Key
          </button>
        </div>

        {/* Security Notice */}
        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            paddingTop: "18px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "#64748b",
              lineHeight: 1.5,
              margin: "0 0 14px 0",
            }}
          >
            🔒 All mutations, quota adjustments, and support accesses in this terminal are permanently audited in the immutable platform ledger.
          </p>

          <Link
            href="/dashboard/workspace"
            style={{
              fontSize: "12.5px",
              color: "#FACC15",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            ← Return to Institute Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
