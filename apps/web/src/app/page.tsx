"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { PrepziiMark } from "@prepzii/ui";
import { Navbar1 } from "@/components/ui/navbar-1";

const modules = [
  ["People", "Manage students and faculty with secure invitations and CSV imports."],
  ["Batches & courses", "Organize academic sessions, batches, subjects, courses and learning materials."],
  ["Assignments", "Publish work, collect files, enforce deadlines and return grades with feedback."],
  ["Assessments", "Build question banks, schedule CBT tests and grade objective or descriptive responses."],
  ["Attendance", "Record batch attendance and retain an auditable correction history."],
  ["Announcements", "Send role- and batch-scoped notices through the institute workspace."],
  ["Reports", "Review attendance, assignment completion and assessment performance."],
  ["Access control", "Give owners, administrators, faculty and students only the permissions they need."],
] as const;

const roles = [
  ["Institute administrators", "Configure the institute, manage people and monitor academic operations."],
  ["Faculty", "Manage assigned batches, materials, assignments, assessments and attendance."],
  ["Students", "Access courses, submit assignments, take assessments and review attendance."],
] as const;

export default function Home() {
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
    <main className="landing focused-landing">
      <div className="hero-glow" aria-hidden="true" />
      <Navbar1 />

      <section className="hero focused-hero" id="product">
        <div className="premium-badge"><span aria-hidden="true">●</span> PREPZII FOR INSTITUTES</div>
        <h1 className="hero-title">A focused learning-management system for coaching institutes.</h1>
        <p>
          Run courses, assignments, assessments, attendance and academic communication from one secure workspace—without unnecessary ERP complexity.
        </p>
        <div className="focused-actions">
          <Link className="primary-link" href="/onboarding">Create institute workspace</Link>
          <Link className="secondary-link" href="/sign-in">Sign in</Link>
          <Link className="secondary-link" href="/cbt-demo">Try the CBT demo</Link>
        </div>
        <div className="trust-row" aria-label="Platform guarantees">
          <span>Tenant-isolated data</span>
          <span>Role-based access</span>
          <span>Audited academic records</span>
          <span>CSV member imports</span>
        </div>
      </section>

      <section className="focused-section" id="modules">
        <header className="focused-section-heading">
          <p className="eyebrow">CORE LMS</p>
          <h2>Only the tools required to teach and learn</h2>
          <p>Every module belongs to the daily academic workflow. CRM, accounting, OMR scanning and speculative AI features are intentionally outside the core product.</p>
        </header>
        <div className="focused-module-grid">
          {modules.map(([title, description], index) => (
            <article className="bento-card" key={title}>
              <span className="focused-card-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="focused-band" id="roles">
        <div className="focused-section focused-role-section">
          <header className="focused-section-heading">
            <p className="eyebrow">ROLE-SCOPED WORKSPACES</p>
            <h2>A simpler experience for every user</h2>
          </header>
          <div className="focused-role-grid">
            {roles.map(([title, description]) => <article key={title}><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </div>
      </section>

      <section className="focused-section focused-security" id="security">
        <div>
          <p className="eyebrow">SECURITY BY DEFAULT</p>
          <h2>Institute data stays inside its institute</h2>
          <p>Tenant-owned records carry an organization identifier and are protected by database row-level security. Server-side membership checks determine every organization-scoped request.</p>
        </div>
        <ul>
          <li>Server-authoritative assessment attempts and grading</li>
          <li>Permission-scoped routes and mutations</li>
          <li>Private files with controlled access</li>
          <li>Health checks, backups and deployment validation</li>
        </ul>
      </section>

      <section className="focused-section focused-demo" id="demo-request">
        <div className="focused-demo-copy">
          <p className="eyebrow">PERSONALIZED WALKTHROUGH</p>
          <h2>See PrepZii with your institute workflow</h2>
          <p>Tell us about your institute and we’ll arrange a focused walkthrough of the core LMS.</p>
        </div>
        <form className="focused-demo-form" onSubmit={submitDemo}>
          <h3>Request a 1-on-1 Walkthrough</h3>
          <div className="focused-form-grid">
            <label>Your full name<input name="fullName" required placeholder="e.g. Dr. Rajesh Agrawal" /></label>
            <label>Institute name<input name="instituteName" required placeholder="e.g. Apex IIT Academy" /></label>
            <label>Work email<input name="email" type="email" required placeholder="director@institute.in" /></label>
            <label>Phone number<input name="phone" type="tel" required placeholder="+91 98765 43210" /></label>
            <label>City<input name="city" required placeholder="Kota" /></label>
            <label>Enrolled students<select name="studentCount" defaultValue="100-500"><option value="under-100">Under 100</option><option value="100-500">100–500</option><option value="500-1500">500–1,500</option><option value="1500+">1,500+</option></select></label>
          </div>
          <label>What would you like to evaluate?<textarea name="notes" rows={3} placeholder="Courses, assessments, attendance, reporting…" /></label>
          {result && <p className={result.success ? "focused-form-success" : "form-error"} role="status">{result.message}</p>}
          <button className="pz-button pz-button-primary" disabled={submitting}>{submitting ? "Submitting…" : "Request walkthrough"}</button>
        </form>
      </section>

      <section className="focused-section focused-faq" id="faqs">
        <header className="focused-section-heading"><p className="eyebrow">FAQ</p><h2>Common questions</h2></header>
        <details open><summary>Can we import existing students and faculty?</summary><p>Yes. Administrators can validate CSV files before committing student or faculty records.</p></details>
        <details><summary>Can one institute see another institute’s records?</summary><p>No. Organization membership is verified server-side and tenant data is protected by row-level security.</p></details>
        <details><summary>Which users are supported?</summary><p>The focused product supports institute administrators, faculty and students.</p></details>
      </section>

      <footer className="focused-footer">
        <div><PrepziiMark theme="dark" /><p>Focused learning management for coaching institutes.</p></div>
        <nav aria-label="Footer navigation"><Link href="/sign-in">Sign in</Link><Link href="/onboarding">Create workspace</Link><a href="#demo-request">Request walkthrough</a></nav>
      </footer>
    </main>
  );
}
