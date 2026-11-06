"use client";

import { type FormEvent, useState } from "react";
import styles from "./landing.module.css";

export function DemoForm() {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/demo-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        instituteName: form.get("instituteName"),
        email: form.get("email"),
        phone: form.get("phone"),
        city: form.get("city"),
        studentCount: form.get("studentCount"),
        notes: form.get("notes"),
      }),
    }).catch(() => null);

    if (!response) {
      setResult({ success: false, message: "Unable to submit the request. Please try again." });
    } else {
      const payload = await response.json().catch(() => ({}));
      setResult({
        success: response.ok,
        message: response.ok ? payload.message ?? "Your walkthrough request was received." : payload.error ?? "Unable to submit the request.",
      });
      if (response.ok) formElement.reset();
    }
    setSubmitting(false);
  }

  return (
    <form className={styles.demoForm} onSubmit={submitDemo}>
      <h3>Request a 1-on-1 Walkthrough</h3>
      <div className={styles.formGrid}>
        <label>Your full name<input name="fullName" autoComplete="name" required placeholder="e.g. Dr. Rajesh Agrawal" /></label>
        <label>Institute name<input name="instituteName" autoComplete="organization" required placeholder="e.g. Apex IIT Academy" /></label>
        <label>Work email<input name="email" type="email" autoComplete="email" required placeholder="director@institute.in" /></label>
        <label>Phone number<input name="phone" type="tel" autoComplete="tel" required placeholder="+91 98765 43210" /></label>
        <label>City<input name="city" autoComplete="address-level2" required placeholder="Kota" /></label>
        <label>Enrolled students<select name="studentCount" defaultValue="100-500"><option value="under-100">Under 100</option><option value="100-500">100–500</option><option value="500-1500">500–1,500</option><option value="1500+">1,500+</option></select></label>
      </div>
      <label>What would you like to evaluate? (optional)<textarea name="notes" rows={3} placeholder="Courses, assessments, attendance, reporting…" /></label>
      {result && <p className={result.success ? styles.formSuccess : "form-error"} role="status">{result.message}</p>}
      <button className={styles.primaryButton} disabled={submitting}>{submitting ? "Submitting…" : "Request walkthrough"}</button>
    </form>
  );
}
