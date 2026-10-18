import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #090e1a 0%, #0e172a 50%, #1e293b 100%)",
        padding: "24px",
      }}
    >
      <div style={{ marginBottom: "28px", textAlign: "center" }}>
        <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
          <PrepziiMark />
        </Link>
        <h1
          style={{
            color: "white",
            fontSize: "22px",
            fontWeight: 800,
            marginTop: "16px",
            marginBottom: "6px",
            fontFamily: "var(--font-display, inherit)",
            letterSpacing: "-0.02em",
          }}
        >
          Sign In to Your Institute Workspace
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
          Enter your faculty, student, or administrative credentials to continue.
        </p>
      </div>

      <div
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        <SignIn
          appearance={{
            elements: {
              card: {
                borderRadius: "24px",
                background: "#ffffff",
                boxShadow: "none",
              },
              formButtonPrimary: {
                backgroundColor: "#0B1528",
                "&:hover": {
                  backgroundColor: "#1e293b",
                },
              },
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
        />
      </div>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <p style={{ color: "#64748b", fontSize: "13px" }}>
          New Coaching Institute?{" "}
          <Link href="/onboarding" style={{ color: "#facc15", fontWeight: 700, textDecoration: "none" }}>
            Register your institution →
          </Link>
        </p>
      </div>
    </div>
  );
}
