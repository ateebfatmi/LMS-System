"use client";

import { useState } from "react";
import Link from "next/link";
import { PrepziiMark, Badge, Button } from "@prepzii/ui";

export default function Home() {
  // Demo Request Form state
  const [fullName, setFullName] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [studentCount, setStudentCount] = useState("100-500");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmitDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          instituteName,
          email,
          phone,
          city,
          studentCount,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitResult({ success: false, message: data.error || "Failed to submit demo request." });
      } else {
        setSubmitResult({ success: true, message: data.message });
        // Clear fields
        setFullName("");
        setInstituteName("");
        setEmail("");
        setPhone("");
        setCity("");
        setNotes("");
      }
    } catch {
      setSubmitResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="landing" style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Top Navigation */}
      <nav
        className="landing-nav"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <PrepziiMark theme="light" />
          <span className="product-chip" style={{ background: "#fef08a", color: "#854d0e", fontWeight: 700 }}>
            FOR INSTITUTES
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <a href="#features" style={{ fontSize: "14px", color: "#334155", textDecoration: "none", fontWeight: 600 }}>
            Features
          </a>
          <a href="#cbt-engine" style={{ fontSize: "14px", color: "#334155", textDecoration: "none", fontWeight: 600 }}>
            CBT Exam Engine
          </a>
          <a href="#pricing" style={{ fontSize: "14px", color: "#334155", textDecoration: "none", fontWeight: 600 }}>
            Pricing
          </a>
          <a href="#faqs" style={{ fontSize: "14px", color: "#334155", textDecoration: "none", fontWeight: 600 }}>
            FAQs
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/super-admin"
            style={{
              fontSize: "12px",
              color: "#64748b",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--line)",
            }}
          >
            Operator Login
          </Link>
          <Link className="primary-link" href="/dashboard" style={{ padding: "8px 18px", fontSize: "13px" }}>
            Open Workspace →
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero" style={{ padding: "64px 24px 40px", maxWidth: "1120px", margin: "0 auto", textAlign: "center" }}>
        <div className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <span>❖</span> Multi-Tenant Coaching Institute Management SaaS
        </div>

        <h1 style={{ fontSize: "44px", lineHeight: "1.15", letterSpacing: "-0.02em", margin: "0 0 20px", color: "#0f172a" }}>
          Everything Your Coaching Institute Needs. <br />
          <em style={{ fontStyle: "normal", color: "#b45309" }}>One Unified Platform.</em>
        </h1>

        <p style={{ fontSize: "18px", lineHeight: "1.6", color: "#475569", maxWidth: "780px", margin: "0 auto 32px" }}>
          Manage students, batches, attendance, fees, exams and academic performance with PrepZii for Institutes. Built for JEE, NEET, UPSC, and regional coaching academies across India.
        </p>

        <div className="hero-actions" style={{ display: "flex", justifyContent: "center", gap: "14px", marginBottom: "40px" }}>
          <a className="primary-link" href="#demo-request" style={{ padding: "12px 28px", fontSize: "15px" }}>
            Book a Live Demo
          </a>
          <a className="secondary-link" href="#features" style={{ padding: "12px 24px", fontSize: "15px" }}>
            Explore Features ↓
          </a>
        </div>

        <div className="trust-row" style={{ display: "flex", justifyContent: "center", gap: "28px", flexWrap: "wrap", color: "#64748b", fontSize: "13px" }}>
          <span>🔒 Multi-tenant RLS Protected</span>
          <span>🎯 Real CBT Test Engine</span>
          <span>📊 Weak Chapter Analytics</span>
          <span>⚡ Automated Fee Ledgers & Receipts</span>
          <span>📲 WhatsApp Batch Broadcasts</span>
        </div>

        {/* Live CBT Preview Card */}
        <div id="cbt-engine" className="cbt-preview-card" style={{ marginTop: "48px", textAlign: "left" }}>
          <div className="cbt-header">
            <div className="cbt-header-title">
              <span style={{ color: "#FACC15" }}>●</span> JEE Advanced All-India Mock 05 · Physics Paper 1
            </div>
            <div className="cbt-header-badge">Authentic CBT Simulator · Q 12 / 54</div>
          </div>
          <div className="cbt-body">
            <div className="cbt-question-text font-prepzii-body">
              A particle of mass <strong>m</strong> moves in a planar circular orbit of radius <strong>r</strong> under a central potential{" "}
              <code className="font-prepzii-mono" style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: "4px" }}>
                V(r) = k·r²
              </code>
              . According to Bohr-Sommerfeld quantization condition, the time period of the orbit is proportional to:
            </div>
            <div className="cbt-options-grid">
              <div className="cbt-option">
                <span className="cbt-option-marker">A</span> r¹/²
              </div>
              <div className="cbt-option selected">
                <span className="cbt-option-marker">B</span> Independent of r (Constant)
              </div>
              <div className="cbt-option">
                <span className="cbt-option-marker">C</span> r
              </div>
              <div className="cbt-option">
                <span className="cbt-option-marker">D</span> r³/²
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement Section */}
      <section style={{ background: "#0f172a", color: "white", padding: "64px 24px", margin: "48px 0" }}>
        <div style={{ maxWidth: "1080px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "30px", margin: "0 0 16px", fontFamily: "var(--font-display)" }}>
            Why Coaching Institutes Struggle with Disconnected Software
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "16px", maxWidth: "700px", margin: "0 auto 40px" }}>
            Most coaching centers juggle 5 different tools for attendance, WhatsApp groups, fee receipts, test sheets, and student records—causing lost revenue and administrative chaos.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", textAlign: "left" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", padding: "24px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>⚠️</div>
              <h3 style={{ fontSize: "16px", color: "#facc15", margin: "0 0 8px" }}>Fee Leakage & Overdue Instalments</h3>
              <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6", margin: 0 }}>
                Paper registers and Excel sheets result in missed fee reminders, unaccounted concessions, and delayed collections from parents.
              </p>
            </div>

            <div style={{ background: "rgba(255,255,255,0.05)", padding: "24px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>⏱</div>
              <h3 style={{ fontSize: "16px", color: "#facc15", margin: "0 0 8px" }}>Manual Test Checking Takes Days</h3>
              <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6", margin: 0 }}>
                Faculty spend valuable teaching hours evaluating OMR sheets manually, instead of analyzing student weak areas and delivering doubt support.
              </p>
            </div>

            <div style={{ background: "rgba(255,255,255,0.05)", padding: "24px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "24px", marginBottom: "12px" }}>📱</div>
              <h3 style={{ fontSize: "16px", color: "#facc15", margin: "0 0 8px" }}>Disorganized Parent Updates</h3>
              <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: "1.6", margin: 0 }}>
                Parents complain about lack of visibility into student attendance, test ranks, and classroom homework submissions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" style={{ maxWidth: "1160px", margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <Badge variant="brand" size="md">THE COMPLETE ACADEMIC SUITE</Badge>
          <h2 style={{ fontSize: "32px", margin: "12px 0 8px", fontFamily: "var(--font-display)" }}>
            Engineered Specifically for Competitive Coaching Institutes
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "15px" }}>
            Every module is tightly integrated with row-level security and high performance.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>01 · BATCH & ROSTER OS</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Student & Batch Management</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Organize multiple batches (JEE 12A, NEET Titans, Droppers). Bulk upload rosters via CSV importer with validation, duplicate detection, and photo IDs.
            </p>
          </div>

          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>02 · CBT ENGINE</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Authentic NTA/JEE CBT Mock Tests</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Deliver full-length exam simulations with timed sections, question palettes, numerical range tolerance, and JEE Advanced partial marking algorithms.
            </p>
          </div>

          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>03 · ACADEMIC ANALYTICS</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Weak Chapter & Accuracy Detection</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Granular AI-backed analytics automatically pinpoint chapters where students lose negative marks or spend disproportionate solving time.
            </p>
          </div>

          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>04 · FINANCIAL LEDGER</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Fee Instalments & Digital Receipts</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Track custom course fee schedules, concession policies, offline UPI/Cash payments, and generate official GST tax receipts instantly.
            </p>
          </div>

          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>05 · INQUIRIES & ADMISSIONS</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Admissions CRM Pipeline</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Track walk-in inquiries, counselling schedules, demo class attendees, and convert inquiries into enrolled students in 1-click.
            </p>
          </div>

          <div style={{ background: "white", padding: "28px", borderRadius: "16px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309" }}>06 · SMART CAMPUSES</span>
            <h3 style={{ fontSize: "18px", margin: "8px 0 10px" }}>Classroom & Room Allocator</h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Avoid scheduling clashes with real-time smart board, lab bench, and auditorium availability matrix across multiple campuses.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ background: "#f1f5f9", padding: "64px 24px" }}>
        <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <Badge variant="neutral" size="md">TRANSPARENT SUBSCRIPTION TIERS</Badge>
            <h2 style={{ fontSize: "32px", margin: "12px 0 8px", fontFamily: "var(--font-display)" }}>
              Simple, Predictable Pricing for Institutes
            </h2>
            <p style={{ color: "var(--muted)", fontSize: "15px" }}>
              No hidden fees. Scale smoothly as your coaching student intake expands.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
            {/* Basic */}
            <div style={{ background: "white", borderRadius: "16px", padding: "32px", border: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "20px", margin: "0 0 6px" }}>Basic Plan</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>For single-branch tuition and coaching centres</p>
              <div style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 16px" }}>
                ₹1,499 <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)" }}>/ month</span>
              </div>
              <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "grid", gap: "10px", fontSize: "13px", color: "#334155", flex: 1 }}>
                <li>✓ Up to <strong>100 Active Students</strong></li>
                <li>✓ 1 Campus Branch</li>
                <li>✓ Student Directory & Roster</li>
                <li>✓ CBT Mock Test Simulator</li>
                <li>✓ Daily Attendance Tracking</li>
                <li>✓ Fee Ledger & Manual Receipts</li>
              </ul>
              <a href="#demo-request" className="pz-button pz-button-outline" style={{ textAlign: "center", textDecoration: "none" }}>
                Get Started
              </a>
            </div>

            {/* Growth */}
            <div style={{ background: "white", borderRadius: "16px", padding: "32px", border: "2px solid #EAB308", display: "flex", flexDirection: "column", position: "relative", boxShadow: "0 8px 30px rgba(234, 179, 8, 0.15)" }}>
              <div style={{ position: "absolute", top: "-12px", right: "24px", background: "#EAB308", color: "#0f172a", fontSize: "11px", fontWeight: 800, padding: "4px 12px", borderRadius: "12px" }}>
                MOST POPULAR
              </div>
              <h3 style={{ fontSize: "20px", margin: "0 0 6px" }}>Growth Plan</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>For mid-sized JEE, NEET & State Exam Academies</p>
              <div style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 16px" }}>
                ₹3,499 <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)" }}>/ month</span>
              </div>
              <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "grid", gap: "10px", fontSize: "13px", color: "#334155", flex: 1 }}>
                <li>✓ Up to <strong>500 Active Students</strong></li>
                <li>✓ Up to 3 Campus Branches</li>
                <li>✓ All Features in Basic</li>
                <li>✓ Admissions CRM & Lead Pipeline</li>
                <li>✓ Weak Chapter Accuracy Analytics</li>
                <li>✓ WhatsApp & SMS Dispatcher</li>
                <li>✓ CSV Bulk Roster Import/Export</li>
              </ul>
              <a href="#demo-request" className="pz-button pz-button-primary" style={{ textAlign: "center", textDecoration: "none" }}>
                Start 14-Day Trial
              </a>
            </div>

            {/* Scale */}
            <div style={{ background: "white", borderRadius: "16px", padding: "32px", border: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "20px", margin: "0 0 6px" }}>Scale Plan</h3>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 16px" }}>For large multi-branch coaching chains & institutes</p>
              <div style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 16px" }}>
                ₹7,999 <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)" }}>/ month</span>
              </div>
              <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "grid", gap: "10px", fontSize: "13px", color: "#334155", flex: 1 }}>
                <li>✓ Up to <strong>1,500 Active Students</strong></li>
                <li>✓ Up to 10 Campus Branches</li>
                <li>✓ Everything in Growth</li>
                <li>✓ High-Concurrency CBT Test Servers</li>
                <li>✓ Custom Institute White-Label Branding</li>
                <li>✓ Automated Razorpay Online Collections</li>
                <li>✓ Dedicated Technical Account Manager</li>
              </ul>
              <a href="#demo-request" className="pz-button pz-button-outline" style={{ textAlign: "center", textDecoration: "none" }}>
                Contact Enterprise
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Book a Live Demo Section (Interactive Form) */}
      <section id="demo-request" style={{ maxWidth: "800px", margin: "64px auto", padding: "0 24px" }}>
        <div style={{ background: "white", padding: "36px", borderRadius: "20px", border: "1px solid var(--line)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <Badge variant="brand" size="md">GET IN TOUCH</Badge>
            <h2 style={{ fontSize: "28px", margin: "10px 0 6px", fontFamily: "var(--font-display)" }}>
              Book a Personalized 1-on-1 Walkthrough
            </h2>
            <p style={{ fontSize: "14px", color: "var(--muted)", margin: 0 }}>
              See how PrepZii can digitize your coaching center. We'll set up a tailored demo with your actual exam syllabus.
            </p>
          </div>

          {submitResult ? (
            <div
              style={{
                padding: "24px",
                borderRadius: "12px",
                background: submitResult.success ? "#ecfdf5" : "#fef2f2",
                border: `1px solid ${submitResult.success ? "#10b981" : "#ef4444"}`,
                color: submitResult.success ? "#065f46" : "#991b1b",
                textAlign: "center",
                fontWeight: 600,
                fontSize: "15px",
                lineHeight: "1.6",
              }}
            >
              {submitResult.message}
              {submitResult.success && (
                <div style={{ marginTop: "16px" }}>
                  <Link href="/dashboard" className="pz-button pz-button-primary">
                    Explore Demo Workspace Meanwhile →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitDemo} style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Agrawal"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Institute Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Target Point Academy"
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="director@institute.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    WhatsApp Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    City / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kota, Rajasthan"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Current Enrolled Students
                  </label>
                  <select
                    value={studentCount}
                    onChange={(e) => setStudentCount(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "white" }}
                  >
                    <option value="under-100">Under 100 Students</option>
                    <option value="100-500">100 - 500 Students</option>
                    <option value="500-1500">500 - 1,500 Students</option>
                    <option value="1500+">1,500+ Students</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  Specific Requirements or Questions (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your target exams (JEE/NEET/Boards), current problems, or campus count..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="pz-button pz-button-primary"
                style={{ padding: "12px", fontSize: "15px", fontWeight: 700, marginTop: "8px" }}
              >
                {isSubmitting ? "Submitting Request..." : "Request Live Demo →"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section id="faqs" style={{ maxWidth: "880px", margin: "40px auto 64px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "26px", margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "14px" }}>
            Common questions from coaching directors and administrators
          </p>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>Does PrepZii support both JEE and NEET exam patterns?</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Yes! Our CBT simulator natively supports single-choice, multiple-choice with JEE Advanced partial marking, and numerical value questions with configurable decimal tolerances. For NEET, it enforces the official 200-question pattern with optional section choices.
            </p>
          </div>

          <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>Can we upload our existing student roster via Excel/CSV?</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Yes. The built-in CSV Importer lets you map existing roll numbers, batch assignments, student contacts, and parent phones in bulk with live validation.
            </p>
          </div>

          <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 6px", fontSize: "15px" }}>How is our institute data isolated and protected?</h4>
            <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
              Every institution record is protected by multi-tenant PostgreSQL Row-Level Security (RLS) tied to authenticated organization memberships. Other institutes cannot view your questions, students, or financial reports.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: "#0b132b",
          color: "#94a3b8",
          padding: "48px 32px 32px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ maxWidth: "1120px", margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "32px", marginBottom: "32px" }}>
          <div>
            <PrepziiMark theme="dark" />
            <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "340px", marginTop: "12px", lineHeight: "1.5" }}>
              PrepZii for Institutes — The all-in-one academic ERP, CBT test simulator, and multi-tenant management software for Indian coaching centers.
            </p>
          </div>

          <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "white", fontSize: "13px", display: "block", marginBottom: "12px" }}>PRODUCT</strong>
              <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
                <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>Core Features</a>
                <a href="#cbt-engine" style={{ color: "inherit", textDecoration: "none" }}>CBT Simulator</a>
                <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing Plans</a>
                <Link href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Demo Workspace</Link>
              </div>
            </div>

            <div>
              <strong style={{ color: "white", fontSize: "13px", display: "block", marginBottom: "12px" }}>OPERATORS</strong>
              <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
                <Link href="/super-admin" style={{ color: "#facc15", textDecoration: "none" }}>Platform Super-Admin</Link>
                <a href="#demo-request" style={{ color: "inherit", textDecoration: "none" }}>Book Onboarding</a>
              </div>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: "1120px", margin: "0 auto", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569" }}>
          <span>© 2026 PrepZii Technologies Private Limited. All rights reserved.</span>
          <span>Designed with high precision for Indian coaching academies.</span>
        </div>
      </footer>
    </main>
  );
}
