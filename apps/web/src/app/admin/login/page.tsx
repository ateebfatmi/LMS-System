import { redirect } from "next/navigation";

export default function PlatformAdminLoginPage() {
  redirect("/sign-in?redirect_url=%2Fadmin");
}
