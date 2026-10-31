import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function SignInPage() {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

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
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
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
          Sign in to your coaching institute portal or switch to platform super admin.
        </p>
      </div>

      {/* Portal Selection Tabs at the Start of Login */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "24px",
          padding: "5px",
          borderRadius: "14px",
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link
          href="/sign-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#0f172a",
            backgroundColor: "#ffffff",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          <span>🏫</span>
          <span>Institute Login</span>
        </Link>

        <Link
          href="/admin/login"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#FACC15",
            backgroundColor: "rgba(250, 204, 21, 0.12)",
            border: "1px solid rgba(250, 204, 21, 0.3)",
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>🛡️</span>
          <span>Super Admin Login</span>
        </Link>
      </div>

      <div
        style={{
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          borderRadius: "24px",
          overflow: "hidden",
        }}
      >
        {clerkConfigured ? (
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
            fallbackRedirectUrl="/auth/resolve"
          />
        ) : (
          <section
            role="status"
            style={{
              maxWidth: "440px",
              padding: "28px",
              background: "#ffffff",
              color: "#0f172a",
              borderRadius: "24px",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 10px", fontSize: "18px" }}>Authentication is not configured</h2>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
              Add the Clerk publishable and secret keys to this environment before signing in.
            </p>
          </section>
        )}
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
