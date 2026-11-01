import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";
import { SignOutOtherAccount } from "@/components/sign-out-other-account";

const portalErrors: Record<string, string> = {
  platform: "This account is not authorized for platform administration.",
  "institute-admin": "This account is not an owner or institute administrator.",
  member: "This account is not registered as faculty or a student.",
};

export default async function PortalChooserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; portal?: string; redirect_url?: string }>;
}) {
  const query = await searchParams;
  const error = query.error === "role_mismatch"
    ? portalErrors[query.portal ?? ""] ?? "This account does not have access to the selected portal."
    : null;
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const returnTo = query.redirect_url?.startsWith("/") && !query.redirect_url.startsWith("//")
    ? query.redirect_url
    : null;
  const portalHref = (path: string) => returnTo
    ? `${path}?return_to=${encodeURIComponent(returnTo)}`
    : path;

  return (
    <main className="portal-chooser">
      <Link href="/" className="portal-chooser-brand" aria-label="PrepZii LMS home">
        <PrepziiMark theme="light" />
      </Link>
      <div className="portal-chooser-heading">
        <p>SECURE ACCESS</p>
        <h1>Choose your sign-in portal</h1>
        <span>Each account type has a separate entry point and role check.</span>
      </div>

      {error && (
        <div className="portal-error" role="alert">
          <strong>Wrong portal for this account</strong>
          <span>{error}</span>
          {clerkConfigured && <SignOutOtherAccount />}
        </div>
      )}

      <section className="portal-grid" aria-label="Sign-in portals">
        <Link href={portalHref("/institute/login")} className="portal-card portal-card-admin">
          <span className="portal-card-icon" aria-hidden="true">🏫</span>
          <small>INSTITUTE OPERATIONS</small>
          <h2>Institute admin</h2>
          <p>For institute owners and administrators managing people, courses and academic operations.</p>
          <strong>Admin sign in →</strong>
        </Link>

        <Link href={portalHref("/portal/login")} className="portal-card portal-card-member">
          <span className="portal-card-icon" aria-hidden="true">🎓</span>
          <small>LEARNING WORKSPACE</small>
          <h2>Faculty & students</h2>
          <p>For teachers delivering courses and students completing their learning activities.</p>
          <strong>Workspace sign in →</strong>
        </Link>

        <Link href="/admin/login" className="portal-card portal-card-platform">
          <span className="portal-card-icon" aria-hidden="true">🛡️</span>
          <small>PREPZII INTERNAL</small>
          <h2>Platform super admin</h2>
          <p>Restricted to allowlisted PrepZii operators managing institutes and platform health.</p>
          <strong>Platform sign in →</strong>
        </Link>
      </section>

      <p className="portal-help">Need an institute workspace? <Link href="/sign-up">Create an owner account</Link></p>
    </main>
  );
}
