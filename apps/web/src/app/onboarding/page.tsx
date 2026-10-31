"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PrepziiMark, Select } from "@prepzii/ui";
import { rememberActiveOrganization } from "@/lib/client-org";

const INSTITUTE_TYPE_OPTIONS = [
  { value: "COACHING", label: "Coaching institute", description: "JEE, NEET, Foundation & competitive test-prep academy" },
  { value: "TUITION", label: "Tuition centre", description: "Subject-wise school curriculum & board exam batches" },
  { value: "SCHOOL", label: "School", description: "K-12 educational institute or junior college" },
  { value: "ONLINE_ACADEMY", label: "Online academy", description: "Digital-first live streaming & hybrid learning" },
  { value: "INDIVIDUAL_TUTOR", label: "Individual tutor", description: "Independent educator or private coaching mentor" },
  { value: "OTHER", label: "Other", description: "Vocational or specialized training institute" },
];

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
              <Select
                name="instituteType"
                defaultValue="COACHING"
                options={INSTITUTE_TYPE_OPTIONS}
              />
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
