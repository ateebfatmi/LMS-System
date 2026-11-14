import { redirect } from "next/navigation";
import { signInReturnPath, withSignInReturn } from "@/lib/sign-in-navigation";

export default async function LegacySignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; redirect_url?: string }>;
}) {
  const { return_to, redirect_url } = await searchParams;
  redirect(withSignInReturn("/sign-in", signInReturnPath(return_to ?? redirect_url)));
}
