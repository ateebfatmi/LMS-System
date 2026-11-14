const localBase = "https://local.invalid";

export function signInReturnPath(candidate: string | undefined | null, base = localBase): string | null {
  if (!candidate || (base === localBase && !candidate.startsWith("/"))) return null;

  try {
    const target = new URL(candidate, base);
    if (target.origin !== new URL(base).origin) return null;
    if (target.pathname === "/sign-up") {
      const invitation = target.searchParams.get("invite");
      return invitation && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(invitation)
        ? `/sign-up?invite=${invitation}` : null;
    }
    if (
      target.pathname !== "/dashboard" &&
      !target.pathname.startsWith("/dashboard/") &&
      !/^\/invite\/[A-Za-z0-9_-]{40,128}$/.test(target.pathname)
    ) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function withSignInReturn(path: string, returnTo?: string | null): string {
  if (!returnTo) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams({ return_to: returnTo })}`;
}
