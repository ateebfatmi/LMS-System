import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

export default function SignUpPage() {
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
        {clerkConfigured ? (
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
              Add the Clerk publishable and secret keys to this environment before creating an account.
            </p>
          </section>
        )}
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
