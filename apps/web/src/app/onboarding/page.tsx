"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrepziiMark } from "@prepzii/ui";
import { rememberActiveOrganization } from "@/lib/client-org";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function InstituteOnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const suggestedSlug = useMemo(() => customSlug || slugify(name), [customSlug, name]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding/institute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        slug: suggestedSlug,
        instituteType: form.get("instituteType"),
        phone: form.get("phone"),
        city: form.get("city"),
        state: form.get("state"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to create the institute.");
      setSubmitting(false);
      return;
    }
    rememberActiveOrganization({ organization: result.organization, role: "OWNER" });
    router.replace("/dashboard/workspace");
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <PrepziiMark theme="light" />
        <div className="onboarding-step">STEP 1 OF 4 · INSTITUTE</div>
        <h1>Create your institute workspace</h1>
        <p>Start with the essentials. Branches, courses, staff, and students come next.</p>

        <form onSubmit={submit} className="onboarding-form">
          <label>
            Institute name
            <input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Apex Coaching Academy" />
          </label>
          <label>
            Workspace URL
            <div className="slug-input"><span>institutes.prepzii.com/</span><input required value={suggestedSlug} onChange={(event) => setCustomSlug(slugify(event.target.value))} /></div>
          </label>
          <div className="onboarding-grid">
            <label>
              Institute type
              <select name="instituteType" defaultValue="COACHING">
                <option value="COACHING">Coaching institute</option>
                <option value="TUITION">Tuition centre</option>
                <option value="SCHOOL">School</option>
                <option value="ONLINE_ACADEMY">Online academy</option>
                <option value="INDIVIDUAL_TUTOR">Individual tutor</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>Contact phone<input name="phone" required placeholder="9876543210" inputMode="tel" /></label>
            <label>City<input name="city" required placeholder="Kota" /></label>
            <label>State<input name="state" required placeholder="Rajasthan" /></label>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="pz-button pz-button-primary" disabled={submitting || !suggestedSlug}>
            {submitting ? "Creating workspace…" : "Create institute workspace →"}
          </button>
        </form>
      </section>
    </main>
  );
}
