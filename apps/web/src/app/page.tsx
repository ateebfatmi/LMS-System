"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PrepziiMark, Badge } from "@prepzii/ui";
import { Navbar1 } from "@/components/ui/navbar-1";

// Mock CBT Question Data
const CBT_QUESTIONS = [
  {
    subject: "Physics",
    exam: "JEE Advanced 2026 Simulation",
    chapter: "Rotational Dynamics & Central Forces",
    qNumber: 12,
    totalQuestions: 54,
    timer: "02:44:18",
    question:
      "A particle of mass m moves in a planar circular orbit of radius r under an attractive central potential V(r) = k·r². Applying the Bohr-Sommerfeld quantization condition to the angular momentum, the orbital angular frequency ω and time period T are respectively:",
    options: [
      { id: "A", text: "ω ∝ r, T ∝ r⁻¹/²" },
      { id: "B", text: "ω = √(2k/m) (Independent of r), T = Constant", isCorrect: true },
      { id: "C", text: "ω ∝ r⁻², T ∝ r²" },
      { id: "D", text: "ω ∝ r¹/², T ∝ r³/²" },
    ],
    explanation:
      "For a harmonic potential V(r) = kr², the central restoring force is F = -∂V/∂r = -2kr. Equating with centripetal force m·r·ω² = 2kr yields ω = √(2k/m), which is completely independent of the orbit radius r.",
  },
  {
    subject: "Chemistry",
    exam: "NEET All-India Rank Predictor",
    chapter: "Coordination Compounds",
    qNumber: 27,
    totalQuestions: 50,
    timer: "01:15:42",
    question:
      "Which of the following octahedral complexes exhibits optical isomerism and is diamagnetic according to Crystal Field Theory (CFT)?",
    options: [
      { id: "A", text: "[Co(NH₃)₆]³⁺" },
      { id: "B", text: "cis-[Co(en)₂Cl₂]⁺", isCorrect: true },
      { id: "C", text: "trans-[Co(en)₂Cl₂]⁺" },
      { id: "D", text: "[Ni(H₂O)₆]²⁺" },
    ],
    explanation:
      "cis-[Co(en)₂Cl₂]⁺ lacks a plane or center of symmetry, rendering it non-superimposable on its mirror image (optically active). Cobalt is in +3 state (d⁶ low spin with strong-field ethylenediamine chelates), making it diamagnetic (t₂g⁶ eg⁰).",
  },
  {
    subject: "Mathematics",
    exam: "JEE Main Shift 1 Drill",
    chapter: "Calculus & Definite Integrals",
    qNumber: 34,
    totalQuestions: 75,
    timer: "00:52:10",
    question:
      "Evaluate the definite integral: I = ∫[0 to π] (x · sin x) / (1 + cos² x) dx. Using symmetry King's Rule:",
    options: [
      { id: "A", text: "π² / 8" },
      { id: "B", text: "π² / 4", isCorrect: true },
      { id: "C", text: "π / 2" },
      { id: "D", text: "2π²" },
    ],
    explanation:
      "Applying King's Rule: 2I = π ∫[0 to π] (sin x)/(1 + cos² x) dx. Substituting u = cos x gives 2I = π [tan⁻¹(-u)] from -1 to 1 = π (π/2) = π²/2 => I = π²/4.",
  },
];

// Interactive Preview Tabs
const PREVIEW_TABS = [
  { id: "cbt", label: "CBT Mock Test Simulator", badge: "Live NTA Grid" },
  { id: "analytics", label: "Weak Chapter AI Radar", badge: "Accuracy 89%" },
  { id: "admissions", label: "Admissions CRM Pipeline", badge: "₹4.8L Pipeline" },
  { id: "fees", label: "Fee Instalments & Invoicing", badge: "Instant GST" },
];

export default function Home() {
  // Active Interactive Preview Tab
  const [activeTab, setActiveTab] = useState<string>("cbt");

  // CBT Simulator Interactive State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string>("B");
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [questionStatusMap, setQuestionStatusMap] = useState<{ [key: number]: "answered" | "marked" | "unvisited" }>({
    1: "answered",
    2: "answered",
    3: "marked",
    4: "answered",
    5: "unvisited",
    12: "answered",
    13: "marked",
    14: "unvisited",
  });

  // Pricing Toggle (Monthly vs Annual with 20% savings)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  // FAQ Expandable State
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

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

  // Simulated live counter effect for trust metrics
  const [liveTestCount, setLiveTestCount] = useState(14820);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTestCount((prev) => prev + Math.floor(Math.random() * 2) + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeQ = CBT_QUESTIONS[currentQuestionIndex] || CBT_QUESTIONS[0];

  const handleSelectOption = (optId: string) => {
    setSelectedOption(optId);
    setQuestionStatusMap((prev) => ({
      ...prev,
      [activeQ.qNumber]: "answered",
    }));
  };

  const handleNextQuestion = () => {
    const nextIdx = (currentQuestionIndex + 1) % CBT_QUESTIONS.length;
    setCurrentQuestionIndex(nextIdx);
    setSelectedOption("");
    setShowExplanation(false);
  };

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

  const faqs = [
    {
      q: "Does PrepZii support authentic NTA JEE (Mains & Advanced) and NEET scoring patterns?",
      a: "Yes! PrepZii features the exact examination interface used by the National Testing Agency. It natively supports Single Choice, Multi-Correct with JEE Advanced partial negative marking schemes, and Numerical Integer ranges with configurable floating tolerances. For NEET, it incorporates the official 200-question grid with mandatory Section A and optional Section B selections.",
    },
    {
      q: "Can we migrate our existing student database and fee registers from Excel/CSV?",
      a: "Absolutely. Our smart bulk CSV ingestion wizard enables directors to upload thousands of student records, historical attendance logs, batch assignments, roll numbers, and parent contacts in under 3 minutes with real-time validation and duplicate prevention.",
    },
    {
      q: "How strictly is our coaching institute's student data isolated from competitors?",
      a: "Every coaching institute operates in an isolated tenant environment safeguarded by multi-tenant PostgreSQL Row-Level Security (RLS) enforced at the database kernel level. Your questions, answer keys, student ranks, and financial ledgers cannot be accessed by any other institution on the platform.",
    },
    {
      q: "Can we brand the student CBT portal and report cards with our institute logo?",
      a: "Yes. Institutes on our Growth and Scale plans receive custom branding where student login screens, test watermarks, hall tickets, fee tax receipts, and performance scorecards display your institute's official logo, brand colors, and registered address.",
    },
    {
      q: "Does PrepZii automate fee instalment reminders on WhatsApp?",
      a: "Yes. PrepZii comes equipped with automated WhatsApp and SMS notification dispatchers that alert parents 5 days prior to fee due dates, provide payment receipts upon fee clearance, and deliver daily absent alerts the moment faculty marks attendance.",
    },
  ];

  return (
    <main className="landing">
      {/* Background Ambient Glow */}
      <div className="hero-glow" />

      <Navbar1 />

      {/* Hero Section */}
      <section className="hero" style={{ textAlign: "center" }}>
        <div style={{ display: "inline-block", marginBottom: "16px" }}>
          <div className="premium-badge">
            <span style={{ color: "#EAB308", fontSize: "14px" }}>●</span>
            <span>INDIA&apos;S PREMIER COACHING OPERATING SYSTEM</span>
            <span style={{ background: "#FEF08A", color: "#854D0E", padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 800 }}>
              VERIFIED RLS
            </span>
          </div>
        </div>

        <h1 className="hero-title">
          Everything Your Coaching Institute Needs. <br />
          <span className="hero-highlight-pill">One Unified Platform.</span>
        </h1>

        <p
          style={{
            fontSize: "19px",
            lineHeight: "1.65",
            color: "#475569",
            maxWidth: "760px",
            margin: "0 auto 36px",
            fontWeight: 450,
          }}
        >
          Replace disconnected WhatsApp groups, paper fee registers, and clunky test software. Built for JEE, NEET,
          Foundation, and UPSC academies managing high-performing student cohorts.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap", marginBottom: "48px" }}>
          <a
            className="primary-link"
            href="#demo-request"
            style={{
              padding: "14px 32px",
              fontSize: "15px",
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Book a Personalized Walkthrough</span>
            <span>→</span>
          </a>
          <a
            className="secondary-link"
            href="#interactive-suite"
            style={{
              padding: "14px 28px",
              fontSize: "15px",
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🎮 Try Live CBT Simulator</span>
          </a>
        </div>

        {/* Live Social Proof / Trust Banner */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.8)",
            border: "1px solid rgba(226, 232, 240, 0.8)",
            borderRadius: "16px",
            padding: "16px 24px",
            maxWidth: "920px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            boxShadow: "0 4px 20px -5px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
              {liveTestCount.toLocaleString("en-IN")}+
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
              CBT Mock Tests Taken
            </div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#e2e8f0" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>₹12.4 Cr+</div>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
              Fee Collections Tracked
            </div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#e2e8f0" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>99.98%</div>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
              Exam Server Uptime
            </div>
          </div>
          <div style={{ width: "1px", height: "30px", background: "#e2e8f0" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>Kota & Hyderabad</div>
            <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
              Syllabus Standard Compliant
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Platform Simulation Showcase */}
      <section
        id="interactive-suite"
        style={{
          maxWidth: "1160px",
          margin: "32px auto 64px",
          padding: "0 24px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Badge variant="brand" size="md">
            EXPERIENCE THE INTERFACE
          </Badge>
          <h2 style={{ fontSize: "32px", margin: "12px 0 8px", fontFamily: "var(--font-display)" }}>
            A Modern, High-Velocity Academic Operating System
          </h2>
          <p style={{ color: "#64748b", fontSize: "15px", maxWidth: "680px", margin: "0 auto" }}>
            Click through our interactive simulator below to test the exact workflows your faculty and students will use every day.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "24px",
          }}
        >
          {PREVIEW_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="interactive-pill-btn"
                style={{
                  background: isActive ? "#0f172a" : "rgba(255, 255, 255, 0.9)",
                  color: isActive ? "#ffffff" : "#475569",
                  borderColor: isActive ? "#0f172a" : "#e2e8f0",
                  boxShadow: isActive ? "0 4px 14px rgba(15, 23, 42, 0.2)" : "none",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    background: isActive ? "#facc15" : "#f1f5f9",
                    color: isActive ? "#0f172a" : "#475569",
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Interactive CBT Simulator */}
        {activeTab === "cbt" && (
          <div
            className="cbt-preview-card"
            style={{
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.15), 0 0 30px rgba(250, 204, 21, 0.12)",
              border: "1px solid rgba(226, 232, 240, 0.9)",
              borderRadius: "20px",
              background: "#ffffff",
            }}
          >
            {/* Real NTA style header bar */}
            <div
              style={{
                background: "linear-gradient(90deg, #090e1a 0%, #1e293b 100%)",
                padding: "16px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#ffffff",
                borderBottom: "2px solid #facc15",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "#FACC15", fontSize: "18px" }}>⚡</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
                    {activeQ.subject}: {activeQ.exam}
                  </div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Chapter: <strong style={{ color: "#cbd5e1" }}>{activeQ.chapter}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: "#fef08a",
                    fontWeight: 700,
                  }}
                >
                  ⏱ Time Remaining: {activeQ.timer}
                </div>
                <div
                  style={{
                    background: "#22c55e",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                  }}
                >
                  Q {activeQ.qNumber} / {activeQ.totalQuestions}
                </div>
              </div>
            </div>

            {/* Split Screen: Question vs Palette */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px" }}>
              {/* Question Body */}
              <div style={{ padding: "32px", borderRight: "1px solid #f1f5f9" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "18px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#b45309",
                      background: "#fef3c7",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    Question Type: Single Correct (+4, -1)
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Click an option to test interactive response recording:
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "16px",
                    lineHeight: "1.7",
                    color: "#0f172a",
                    marginBottom: "28px",
                    fontWeight: 500,
                  }}
                >
                  {activeQ.question}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  {activeQ.options.map((option) => {
                    const isSelected = selectedOption === option.id;
                    return (
                      <div
                        key={option.id}
                        onClick={() => handleSelectOption(option.id)}
                        className={`cbt-option ${isSelected ? "selected" : ""}`}
                        style={{
                          padding: "16px 20px",
                          borderRadius: "14px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          border: isSelected ? "2px solid #eab308" : "1px solid #e2e8f0",
                          background: isSelected ? "#fffbeb" : "#f8fafc",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          className="cbt-option-marker"
                          style={{
                            width: "30px",
                            height: "30px",
                            background: isSelected ? "#facc15" : "#ffffff",
                            borderColor: isSelected ? "#ca8a04" : "#cbd5e1",
                            color: isSelected ? "#0f172a" : "#475569",
                            fontWeight: 800,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {option.id}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: isSelected ? 600 : 450, color: "#1e293b" }}>
                          {option.text}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Explanation accordion */}
                {showExplanation && (
                  <div
                    style={{
                      marginTop: "24px",
                      padding: "18px 24px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "12px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "#166534",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "6px", color: "#15803d" }}>
                      ✓ Verified Faculty Solution & Derivation:
                    </strong>
                    {activeQ.explanation}
                  </div>
                )}

                {/* Question Control Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "32px",
                    paddingTop: "20px",
                    borderTop: "1px solid #f1f5f9",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="pz-button pz-button-outline"
                      style={{ fontSize: "12px", padding: "8px 16px" }}
                    >
                      {showExplanation ? "Hide Solution" : "💡 Show Solution Derivation"}
                    </button>
                    <button
                      onClick={() => {
                        setQuestionStatusMap((prev) => ({
                          ...prev,
                          [activeQ.qNumber]: "marked",
                        }));
                      }}
                      className="pz-button pz-button-outline"
                      style={{ fontSize: "12px", padding: "8px 16px", color: "#7c3aed", borderColor: "#ddd6fe" }}
                    >
                      🔖 Mark for Review
                    </button>
                  </div>

                  <button
                    onClick={handleNextQuestion}
                    className="pz-button pz-button-primary"
                    style={{ padding: "8px 20px", fontSize: "13px", fontWeight: 700 }}
                  >
                    Save & Next Question →
                  </button>
                </div>
              </div>

              {/* Real NTA Question Palette */}
              <div
                style={{
                  background: "#f8fafc",
                  padding: "24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f172a", marginBottom: "12px" }}>
                    QUESTION PALETTE
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "20px" }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((num) => {
                      const status = questionStatusMap[num] || (num === activeQ.qNumber ? "answered" : "unvisited");
                      let bg = "#ffffff";
                      let color = "#475569";
                      let border = "1px solid #cbd5e1";

                      if (num === activeQ.qNumber) {
                        border = "2px solid #2563eb";
                      }

                      if (status === "answered") {
                        bg = "#15803d";
                        color = "#ffffff";
                        border = "none";
                      } else if (status === "marked") {
                        bg = "#6d28d9";
                        color = "#ffffff";
                        border = "none";
                      }

                      return (
                        <div
                          key={num}
                          onClick={() => {
                            if (num === 12) setCurrentQuestionIndex(0);
                            else if (num === 2) setCurrentQuestionIndex(1);
                            else if (num === 3) setCurrentQuestionIndex(2);
                          }}
                          style={{
                            height: "36px",
                            borderRadius: "8px",
                            background: bg,
                            color: color,
                            border: border,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div style={{ display: "grid", gap: "8px", fontSize: "11px", color: "#64748b" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#22c55e" }} />
                      <span>Answered ({Object.values(questionStatusMap).filter((s) => s === "answered").length})</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#8b5cf6" }} />
                      <span>Marked for Review</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#ffffff", border: "1px solid #cbd5e1" }} />
                      <span>Not Visited</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#ffffff",
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ color: "#15803d", fontWeight: 700, marginBottom: "4px" }}>
                    ✓ Auto-Sync Active
                  </div>
                  <div style={{ color: "#64748b", fontSize: "11px" }}>
                    Responses encrypted with student roll token.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Weak Chapter AI Radar */}
        {activeTab === "analytics" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "36px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "20px", color: "#0f172a" }}>
                  Diagnostic Accuracy Radar: Batch JEE 2026 Titans
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  AI analysis across 42 students from Test #08 (Electrostatics, Optics & Thermodynamics)
                </p>
              </div>
              <span
                style={{
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "6px 14px",
                  borderRadius: "999px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Auto-Generated Study Plan Ready
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "32px" }}>
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#991b1b" }}>HIGH NEGATIVE MARKS</span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "8px 0 4px" }}>
                  Wave Optics & Interference
                </div>
                <div style={{ fontSize: "13px", color: "#7f1d1d" }}>
                  Students averaged <strong>-1.8 marks</strong> on double-slit path difference numericals.
                </div>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#92400e" }}>TIME BOTTLENECK</span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "8px 0 4px" }}>
                  Rotational Dynamics
                </div>
                <div style={{ fontSize: "13px", color: "#78350f" }}>
                  Average solving time was <strong>4.2 mins/question</strong> (Target: &lt;2.5 mins).
                </div>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "20px", borderRadius: "14px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534" }}>HIGH MASTERY COHORT</span>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: "8px 0 4px" }}>
                  Modern Physics & Photoelectric
                </div>
                <div style={{ fontSize: "13px", color: "#14532d" }}>
                  Accuracy touched <strong>92.4%</strong> across all batches. Ready for advanced drills.
                </div>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "#334155" }}>
                💡 <strong>PrepZii Faculty Recommendation:</strong> Schedule a 45-minute doubt-clearing session for Wave Optics before Test #09.
              </div>
              <Link href="/dashboard" className="pz-button pz-button-primary" style={{ fontSize: "12px", padding: "8px 18px" }}>
                View Full Batch Analytics →
              </Link>
            </div>
          </div>
        )}

        {/* Tab 3: Admissions CRM Pipeline */}
        {activeTab === "admissions" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "36px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "20px", color: "#0f172a" }}>
                  Admissions Funnel: 2026-27 Academic Intake
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  Track walk-in inquiries, demo class attendees, and enrollment conversions in real-time.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <span style={{ background: "#fef3c7", color: "#b45309", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700 }}>
                  Active Leads: 68
                </span>
                <span style={{ background: "#ecfdf5", color: "#065f46", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700 }}>
                  Converted: ₹4.8 Lakhs
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
              {[
                { stage: "New Inquiries", count: 24, badge: "Phone / Walk-in", color: "#3b82f6" },
                { stage: "Counselling Scheduled", count: 18, badge: "Meeting Fixed", color: "#8b5cf6" },
                { stage: "Attended Demo Class", count: 14, badge: "Scholarship Test", color: "#f59e0b" },
                { stage: "Enrolled & Paid", count: 12, badge: "Fee Collected", color: "#10b981" },
              ].map((col, idx) => (
                <div key={idx} style={{ background: "#f8fafc", borderRadius: "14px", padding: "18px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{col.stage}</span>
                    <span style={{ background: col.color, color: "#ffffff", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800 }}>
                      {col.count}
                    </span>
                  </div>
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "8px", fontSize: "12px" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Aarav Sharma</div>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>NEET Dropper · Allen Kota Transfer</div>
                    <div style={{ marginTop: "6px", color: "#b45309", fontWeight: 600 }}>Demo with Er. Verma</div>
                  </div>
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "12px" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Priya Sundaram</div>
                    <div style={{ color: "#64748b", fontSize: "11px" }}>JEE 2-Year Target · DPS RK Puram</div>
                    <div style={{ marginTop: "6px", color: "#15803d", fontWeight: 600 }}>Token Paid ₹10,000</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Fee Instalments & Invoicing */}
        {activeTab === "fees" && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "36px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 25px 60px -15px rgba(15, 23, 42, 0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "20px", color: "#0f172a" }}>
                  Automated Fee Ledger & GST Invoicing
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                  Multi-instalment schedules with Razorpay UPI links, cash receipts, and automated WhatsApp balance alerts.
                </p>
              </div>
              <span style={{ background: "#fefce8", color: "#854d0e", border: "1px solid #fde047", padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700 }}>
                100% Audit Compliant
              </span>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "14px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
                    <th style={{ padding: "12px 18px" }}>Receipt #</th>
                    <th style={{ padding: "12px 18px" }}>Student Name</th>
                    <th style={{ padding: "12px 18px" }}>Batch</th>
                    <th style={{ padding: "12px 18px" }}>Instalment</th>
                    <th style={{ padding: "12px 18px" }}>Amount Paid</th>
                    <th style={{ padding: "12px 18px" }}>Mode</th>
                    <th style={{ padding: "12px 18px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>REC-2026-0842</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600 }}>Rohan Joshi</td>
                    <td style={{ padding: "14px 18px", color: "#64748b" }}>JEE 12-A Super 30</td>
                    <td style={{ padding: "14px 18px" }}>Instalment 2 of 3</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>₹35,000</td>
                    <td style={{ padding: "14px 18px" }}>UPI / QR</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                        ✓ Paid & Dispatched
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 18px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>REC-2026-0843</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600 }}>Ananya Mukherjee</td>
                    <td style={{ padding: "14px 18px", color: "#64748b" }}>NEET Achievers</td>
                    <td style={{ padding: "14px 18px" }}>Instalment 1 of 4</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>₹25,000</td>
                    <td style={{ padding: "14px 18px" }}>Bank NEFT</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                        ✓ Paid & Dispatched
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "14px 18px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>REC-2026-0844</td>
                    <td style={{ padding: "14px 18px", fontWeight: 600 }}>Kavita Singh</td>
                    <td style={{ padding: "14px 18px", color: "#64748b" }}>Class 11 Foundation</td>
                    <td style={{ padding: "14px 18px" }}>Instalment 3 of 3</td>
                    <td style={{ padding: "14px 18px", fontWeight: 700 }}>₹18,500</td>
                    <td style={{ padding: "14px 18px" }}>Due in 3 Days</td>
                    <td style={{ padding: "14px 18px" }}>
                      <span style={{ background: "#fef3c7", color: "#b45309", padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                        ⏳ WhatsApp Sent
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Bento Grid: Core Architectural Modules */}
      <section id="features" style={{ maxWidth: "1180px", margin: "64px auto", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <Badge variant="brand" size="md">
            ENGINEERED FOR EXCELLENCE
          </Badge>
          <h2 style={{ fontSize: "36px", margin: "14px 0 8px", fontFamily: "var(--font-display)", color: "#0f172a" }}>
            The Complete Coaching Academic OS
          </h2>
          <p style={{ color: "#64748b", fontSize: "16px", maxWidth: "680px", margin: "0 auto" }}>
            Each component is tightly coupled with multi-tenant Postgres security, sub-100ms response times, and purpose-built for Indian competitive entrance syllabi.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
          {/* Card 1 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>🎯</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              01 · NTA CBT ENGINE
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>Authentic CBT Mock Tests</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              Replicate JEE & NEET test hall environments. Includes section switching, bilingual English/Hindi questions,
              numerical value ranges, and JEE Advanced partial marking algorithms.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>⚡</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              02 · BATCH & ROSTER
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>High-Volume Cohort Roster</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              Import thousands of students seamlessly via smart CSV mapper. Handle multi-stream enrollments, roll
              allotments, student photo cards, and batch transfers in 1-click.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>📊</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              03 · ACADEMIC RADAR
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>Weak Chapter Diagnostics</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              AI pinpointing the exact concepts where students bleed marks due to negative scoring or time drag. Export
              comprehensive student rank cards for parent-teacher conferences.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>💳</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              04 · FINANCIAL LEDGER
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>Instalment & GST Invoicing</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              Automate multi-part fee collection schedules. Generate GST-compliant tax receipts, track scholarship
              concessions, and dispatch automated payment links via SMS & WhatsApp.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>📲</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              05 · BROADCAST ENGINE
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>Instant WhatsApp Dispatch</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              Keep parents informed without manual typing. Automatically dispatch test scores, attendance alerts, emergency
              holiday notices, and homework assignments directly to parents&apos; phones.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bento-card">
            <div style={{ fontSize: "28px", marginBottom: "16px" }}>🔒</div>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#b45309", letterSpacing: "0.06em" }}>
              06 · MULTI-TENANT ISOLATION
            </span>
            <h3 style={{ fontSize: "20px", margin: "10px 0 12px", color: "#0f172a" }}>Kernel Row-Level Security</h3>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", margin: 0 }}>
              Enterprise data sovereignty. Every database table enforces tenant isolation via PostgreSQL RLS policies.
              Zero risk of competitor coaching institutes peering into your proprietary test papers.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Matrix with Monthly / Annual Switcher */}
      <section id="pricing" style={{ background: "#f8fafc", padding: "80px 24px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <Badge variant="neutral" size="md">
              TRANSPARENT INSTITUTIONAL PLANS
            </Badge>
            <h2 style={{ fontSize: "36px", margin: "12px 0 8px", fontFamily: "var(--font-display)", color: "#0f172a" }}>
              Predictable Pricing. Zero Hidden Fees.
            </h2>
            <p style={{ color: "#64748b", fontSize: "16px", maxWidth: "600px", margin: "0 auto 24px" }}>
              Choose the tier that matches your student enrollment. Upgrade or scale anytime as your intake expands.
            </p>

            {/* Monthly vs Annual Toggle */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#e2e8f0",
                padding: "4px",
                borderRadius: "999px",
                gap: "4px",
              }}
            >
              <button
                onClick={() => setBillingCycle("monthly")}
                style={{
                  padding: "8px 20px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: billingCycle === "monthly" ? "#ffffff" : "transparent",
                  color: billingCycle === "monthly" ? "#0f172a" : "#475569",
                  boxShadow: billingCycle === "monthly" ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                style={{
                  padding: "8px 20px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: billingCycle === "annual" ? "#0f172a" : "transparent",
                  color: billingCycle === "annual" ? "#ffffff" : "#475569",
                  boxShadow: billingCycle === "annual" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
              >
                <span>Annual Billing</span>
                <span
                  style={{
                    background: "#facc15",
                    color: "#0f172a",
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "999px",
                  }}
                >
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px" }}>
            {/* Basic Plan */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "36px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.05)",
              }}
            >
              <h3 style={{ fontSize: "20px", margin: "0 0 6px", color: "#0f172a" }}>Starter Institute</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>
                Ideal for single-branch tuition and coaching academies
              </p>
              <div style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 20px", color: "#0f172a" }}>
                {billingCycle === "annual" ? "₹1,199" : "₹1,499"}{" "}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>/ month</span>
              </div>
              <ul
                style={{
                  margin: "0 0 28px",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: "12px",
                  fontSize: "13px",
                  color: "#334155",
                  flex: 1,
                }}
              >
                <li>✓ Up to <strong>100 Active Students</strong></li>
                <li>✓ 1 Campus Branch</li>
                <li>✓ Student Directory & Batch Assignment</li>
                <li>✓ NTA CBT Mock Test Simulator</li>
                <li>✓ Daily Attendance Tracking</li>
                <li>✓ Fee Ledger & Manual Receipts</li>
                <li>✓ Standard Email Support</li>
              </ul>
              <a
                href="#demo-request"
                className="pz-button pz-button-outline"
                style={{ textAlign: "center", textDecoration: "none", padding: "12px", borderRadius: "12px" }}
              >
                Get Started
              </a>
            </div>

            {/* Growth Plan (Most Popular) */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "36px",
                border: "2px solid #EAB308",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: "0 15px 45px -10px rgba(234, 179, 8, 0.25)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-14px",
                  right: "24px",
                  background: "#EAB308",
                  color: "#0f172a",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "5px 14px",
                  borderRadius: "999px",
                  letterSpacing: "0.05em",
                }}
              >
                ★ MOST POPULAR
              </div>
              <h3 style={{ fontSize: "20px", margin: "0 0 6px", color: "#0f172a" }}>Growth Academy</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>
                For mid-sized JEE, NEET & State Exam coaching centers
              </p>
              <div style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 20px", color: "#0f172a" }}>
                {billingCycle === "annual" ? "₹2,799" : "₹3,499"}{" "}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>/ month</span>
              </div>
              <ul
                style={{
                  margin: "0 0 28px",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: "12px",
                  fontSize: "13px",
                  color: "#334155",
                  flex: 1,
                }}
              >
                <li>✓ Up to <strong>500 Active Students</strong></li>
                <li>✓ Up to 3 Campus Branches</li>
                <li>✓ <strong>All Features in Starter</strong></li>
                <li>✓ Admissions CRM & Walk-in Pipeline</li>
                <li>✓ AI Weak Chapter Accuracy Diagnostics</li>
                <li>✓ WhatsApp & SMS Dispatcher</li>
                <li>✓ CSV Bulk Roster Import & Migration</li>
                <li>✓ Priority Dedicated Support</li>
              </ul>
              <a
                href="#demo-request"
                className="pz-button pz-button-primary"
                style={{
                  textAlign: "center",
                  textDecoration: "none",
                  padding: "12px",
                  borderRadius: "12px",
                  fontWeight: 700,
                }}
              >
                Start 14-Day Free Trial
              </a>
            </div>

            {/* Scale Plan */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "36px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 4px 20px -4px rgba(15, 23, 42, 0.05)",
              }}
            >
              <h3 style={{ fontSize: "20px", margin: "0 0 6px", color: "#0f172a" }}>Institutional Scale</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px" }}>
                For large multi-branch coaching chains & institutes
              </p>
              <div style={{ fontSize: "36px", fontWeight: 800, margin: "0 0 20px", color: "#0f172a" }}>
                {billingCycle === "annual" ? "₹6,399" : "₹7,999"}{" "}
                <span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b" }}>/ month</span>
              </div>
              <ul
                style={{
                  margin: "0 0 28px",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: "12px",
                  fontSize: "13px",
                  color: "#334155",
                  flex: 1,
                }}
              >
                <li>✓ Up to <strong>1,500 Active Students</strong></li>
                <li>✓ Up to 10 Campus Branches</li>
                <li>✓ <strong>Everything in Growth</strong></li>
                <li>✓ High-Concurrency CBT Test Servers</li>
                <li>✓ Custom Institute White-Label Branding</li>
                <li>✓ Automated Razorpay UPI Gateways</li>
                <li>✓ Dedicated Technical Account Manager</li>
                <li>✓ 99.9% Uptime Guarantee & SLA</li>
              </ul>
              <a
                href="#demo-request"
                className="pz-button pz-button-outline"
                style={{ textAlign: "center", textDecoration: "none", padding: "12px", borderRadius: "12px" }}
              >
                Contact Enterprise Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Book a Live Demo Section (Interactive Form) */}
      <section id="demo-request" style={{ maxWidth: "1120px", margin: "80px auto", padding: "0 24px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: "24px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 50px -10px rgba(15, 23, 42, 0.08)",
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            overflow: "hidden",
          }}
        >
          {/* Left Column: Value Proposition */}
          <div
            style={{
              background: "linear-gradient(135deg, #090e1a 0%, #1e293b 100%)",
              color: "#ffffff",
              padding: "48px 40px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "inline-block", marginBottom: "16px" }}>
                <span
                  style={{
                    background: "rgba(250, 204, 21, 0.2)",
                    color: "#facc15",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "4px 12px",
                    borderRadius: "999px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  PERSONALIZED ONBOARDING
                </span>
              </div>
              <h2 style={{ fontSize: "30px", margin: "0 0 16px", color: "#ffffff", fontFamily: "var(--font-display)" }}>
                Experience PrepZii With Your Actual Syllabus
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.6", margin: "0 0 32px" }}>
                Schedule a 25-minute consultation with our academic engineering team. We will demonstrate how to migrate
                your coaching center with zero downtime.
              </p>

              <div style={{ display: "grid", gap: "20px" }}>
                <div style={{ display: "flex", gap: "14px" }}>
                  <span style={{ fontSize: "20px" }}>⚡</span>
                  <div>
                    <strong style={{ color: "#ffffff", fontSize: "14px", display: "block" }}>
                      Same-Day Roster Migration
                    </strong>
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                      Send us your Excel sheets, and our team will configure your batches and subjects within hours.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "14px" }}>
                  <span style={{ fontSize: "20px" }}>🎯</span>
                  <div>
                    <strong style={{ color: "#ffffff", fontSize: "14px", display: "block" }}>
                      Custom Test Question Bank
                    </strong>
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                      Experience the CBT test engine with your coaching academy&apos;s actual question papers.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "14px" }}>
                  <span style={{ fontSize: "20px" }}>🔒</span>
                  <div>
                    <strong style={{ color: "#ffffff", fontSize: "14px", display: "block" }}>
                      Dedicated Technical Support
                    </strong>
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                      Direct WhatsApp group access to our senior engineering staff for your administrative staff.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "13px", color: "#64748b" }}>
              ⚡ 120+ Coaching academies onboarded across Rajasthan, Telangana, Delhi NCR & Bihar.
            </div>
          </div>

          {/* Right Column: Form */}
          <div style={{ padding: "48px 40px" }}>
            <h3 style={{ fontSize: "24px", margin: "0 0 8px", color: "#0f172a", fontFamily: "var(--font-display)" }}>
              Request a 1-on-1 Walkthrough
            </h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 28px" }}>
              Fill in your academy details and we will coordinate a live screen-share demonstration.
            </p>

            {submitResult ? (
              <div
                style={{
                  padding: "24px",
                  borderRadius: "14px",
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
                  <div style={{ marginTop: "18px" }}>
                    <Link
                      href="/dashboard"
                      className="pz-button pz-button-primary"
                      style={{ padding: "10px 24px", fontSize: "13px" }}
                    >
                      Explore Interactive Workspace Now →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitDemo} style={{ display: "grid", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Rajesh Agrawal"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      Coaching Institute Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex IIT Academy"
                      value={instituteName}
                      onChange={(e) => setInstituteName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="director@institute.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      WhatsApp Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      City / Location *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kota / Hyderabad / Delhi"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                      Current Enrolled Students
                    </label>
                    <select
                      aria-label="Current enrolled students"
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="under-100">Under 100 Students</option>
                      <option value="100-500">100 - 500 Students</option>
                      <option value="500-1500">500 - 1,500 Students</option>
                      <option value="1500+">1,500+ Students (Enterprise)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "6px", color: "#334155" }}>
                    Target Examinations or Specific Needs (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. JEE Main/Adv & NEET, 2 branch locations, need automated WhatsApp fee notifications..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="pz-button pz-button-primary"
                  style={{
                    padding: "14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    borderRadius: "12px",
                    marginTop: "8px",
                  }}
                >
                  {isSubmitting ? "Submitting Walkthrough Request..." : "Schedule My 1-on-1 Walkthrough →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (Expandable Accordion) */}
      <section id="faqs" style={{ maxWidth: "860px", margin: "64px auto 96px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={{ fontSize: "30px", margin: "0 0 10px", fontFamily: "var(--font-display)", color: "#0f172a" }}>
            Frequently Asked Questions
          </h2>
          <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
            Everything you need to know about switching your coaching academy to PrepZii
          </p>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: isExpanded ? "1px solid #EAB308" : "1px solid #e2e8f0",
                  padding: "20px 24px",
                  cursor: "pointer",
                  boxShadow: isExpanded ? "0 8px 24px -5px rgba(234, 179, 8, 0.12)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>{faq.q}</h4>
                  <span
                    style={{
                      fontSize: "18px",
                      color: isExpanded ? "#EAB308" : "#94a3b8",
                      fontWeight: 800,
                      transform: isExpanded ? "rotate(45deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    +
                  </span>
                </div>

                {isExpanded && (
                  <p style={{ margin: "14px 0 0", fontSize: "14px", color: "#475569", lineHeight: "1.65" }}>
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Institutional Dark Footer */}
      <footer
        style={{
          background: "linear-gradient(180deg, #090e1a 0%, #050811 100%)",
          color: "#94a3b8",
          padding: "64px 32px 36px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: "1160px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "40px",
            marginBottom: "48px",
          }}
        >
          <div>
            <PrepziiMark theme="dark" />
            <p style={{ fontSize: "14px", color: "#64748b", maxWidth: "380px", marginTop: "16px", lineHeight: "1.6" }}>
              PrepZii for Institutes — The enterprise academic ERP, authentic CBT test simulator, and multi-tenant coaching management software.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <span style={{ background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", color: "#cbd5e1" }}>
                🔒 ISO 27001 Ready
              </span>
              <span style={{ background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", color: "#cbd5e1" }}>
                🇮🇳 Hosted in AWS Mumbai
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "56px", flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "#ffffff", fontSize: "13px", display: "block", marginBottom: "14px", letterSpacing: "0.05em" }}>
                PLATFORM MODULES
              </strong>
              <div style={{ display: "grid", gap: "10px", fontSize: "13px" }}>
                <a href="#interactive-suite" style={{ color: "inherit", textDecoration: "none" }}>
                  CBT Mock Simulator
                </a>
                <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>
                  Admissions CRM
                </a>
                <a href="#features" style={{ color: "inherit", textDecoration: "none" }}>
                  Academic Accuracy Radar
                </a>
                <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>
                  Fee Instalments & Ledgers
                </a>
              </div>
            </div>

            <div>
              <strong style={{ color: "#ffffff", fontSize: "13px", display: "block", marginBottom: "14px", letterSpacing: "0.05em" }}>
                DIRECT ACCESS
              </strong>
              <div style={{ display: "grid", gap: "10px", fontSize: "13px" }}>
                <Link href="/dashboard" style={{ color: "#facc15", textDecoration: "none", fontWeight: 600 }}>
                  Institutional Workspace →
                </Link>
                <Link href="/admin" style={{ color: "inherit", textDecoration: "none" }}>
                  Platform Admin
                </Link>
                <a href="#demo-request" style={{ color: "inherit", textDecoration: "none" }}>
                  Schedule Technical Demo
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: "1160px",
            margin: "0 auto",
            paddingTop: "28px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            color: "#64748b",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <span>© 2026 PrepZii Technologies Private Limited. All rights reserved.</span>
          <span>Designed with high mathematical precision for Indian coaching institutes.</span>
        </div>
      </footer>
    </main>
  );
}
