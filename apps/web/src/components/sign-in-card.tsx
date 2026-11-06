import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";
import type { ReactNode } from "react";

export function SignInCard({ title, children, footer }: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="sign-in-page">
      <section className="sign-in-card" aria-labelledby="sign-in-title">
        <Link href="/" className="sign-in-brand" aria-label="PrepZii LMS home">
          <PrepziiMark theme="light" />
        </Link>
        <h1 id="sign-in-title">{title}</h1>
        {children}
        {footer && <div className="sign-in-footer">{footer}</div>}
      </section>
    </main>
  );
}

export function ClerkSignIn({ path, resolveUrl }: { path: string; resolveUrl: string }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return <p role="status">Sign-in is temporarily unavailable. Please try again later.</p>;
  }

  return (
    <SignIn
      appearance={{
        variables: {
          colorPrimary: "#0b1528",
          colorPrimaryForeground: "#ffffff",
          colorForeground: "#0b1528",
          colorBackground: "#ffffff",
          fontFamily: "inherit",
        },
        elements: {
          rootBox: { width: "100%", maxWidth: "100%" },
          cardBox: { width: "100%", maxWidth: "100%", boxShadow: "none" },
          card: { boxShadow: "none", paddingInline: 0 },
          formButtonPrimary: {
            backgroundColor: "#facc15",
            color: "#0b1528",
            "&:hover": { backgroundColor: "#eab308" },
          },
        },
      }}
      routing="path"
      path={path}
      withSignUp={false}
      forceRedirectUrl={resolveUrl}
      fallbackRedirectUrl={resolveUrl}
    />
  );
}
