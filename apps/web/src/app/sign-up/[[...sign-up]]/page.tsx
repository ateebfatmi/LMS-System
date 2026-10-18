import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function SignUpPage() {
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
          Create Your PrepZii Account
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
          Join your coaching institute or establish a new institutional workspace.
        </p>
      </div>

      <div
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        <SignUp
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
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/onboarding"
        />
      </div>

      <div style={{ marginTop: "24px", textAlign: "center" }}>
        <p style={{ color: "#64748b", fontSize: "13px" }}>
          Already have an institute account?{" "}
          <Link href="/sign-in" style={{ color: "#facc15", fontWeight: 700, textDecoration: "none" }}>
            Sign in here →
          </Link>
        </p>
      </div>
    </div>
  );
}
