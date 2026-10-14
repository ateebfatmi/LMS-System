import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function NotFound() {
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
      <div style={{ marginBottom: "24px" }}>
        <PrepziiMark theme="light" />
      </div>

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
        <span
          style={{
            fontSize: "12px",
            fontWeight: 800,
            background: "#fef3c7",
            color: "#b45309",
            padding: "4px 10px",
            borderRadius: "12px",
          }}
        >
          404 ERROR
        </span>
        <h1 style={{ fontSize: "24px", margin: "16px 0 10px", color: "#0f172a" }}>
          Page Not Found
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 24px", lineHeight: "1.5" }}>
          The requested URL does not exist or has been moved to a different institutional branch.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <Link href="/dashboard" className="pz-button pz-button-primary" style={{ textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
          <Link href="/" className="pz-button pz-button-outline" style={{ textDecoration: "none" }}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
