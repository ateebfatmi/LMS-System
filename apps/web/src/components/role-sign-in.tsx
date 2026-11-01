import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";

type Portal = "platform" | "institute-admin" | "member";

export function RoleSignIn({
  portal,
  path,
  eyebrow,
  title,
  description,
  guidance,
  signUpUrl,
  returnTo,
}: {
  portal: Portal;
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  guidance: string;
  signUpUrl?: string;
  returnTo?: string;
}) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const resolveParams = new URLSearchParams({ portal });
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    resolveParams.set("return_to", returnTo);
  }
  const resolveUrl = `/auth/resolve?${resolveParams.toString()}`;

  return (
    <main className={`role-login role-login-${portal}`}>
      <section className="role-login-intro">
        <Link href="/" className="role-login-brand" aria-label="PrepZii LMS home">
          <PrepziiMark theme="dark" />
        </Link>
        <p className="role-login-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="role-login-guidance">
          <strong>This portal is only for:</strong>
          <span>{guidance}</span>
        </div>
        <Link href="/sign-in" className="role-login-switch">← Choose a different portal</Link>
      </section>

      <section className="role-login-form" aria-label={`${title} sign in`}>
        {clerkConfigured ? (
          <SignIn
            appearance={{
              elements: {
                card: { borderRadius: "22px", background: "#ffffff", boxShadow: "none" },
                formButtonPrimary: {
                  backgroundColor: portal === "member" ? "#1d4ed8" : "#0b1528",
                  "&:hover": { backgroundColor: portal === "member" ? "#1e40af" : "#1e293b" },
                },
              },
            }}
            routing="path"
            path={path}
            signUpUrl={signUpUrl}
            withSignUp={Boolean(signUpUrl)}
            forceRedirectUrl={resolveUrl}
            fallbackRedirectUrl={resolveUrl}
          />
        ) : (
          <div className="role-login-unconfigured" role="status">
            <h2>Authentication is not configured</h2>
            <p>Add the Clerk publishable and secret keys before signing in.</p>
          </div>
        )}
      </section>
    </main>
  );
}
