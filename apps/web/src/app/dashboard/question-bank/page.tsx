"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, MetricCard, Select } from "@prepzii/ui";
import { DashboardLayout } from "@/components/dashboard-layout";

export interface BankQuestion {
  id: string;
  subject: "Physics" | "Chemistry" | "Mathematics" | "Biology";
  chapter: string;
  topic: string;
  examTag: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION";
  kind: "single_choice" | "multiple_choice" | "numerical" | "assertion_reason";
  difficulty: "EASY" | "MEDIUM" | "HARD" | "ADVANCED";
  text: string;
  formula?: string;
  options?: { id: string; text: string; isCorrect: boolean }[];
  correctNumber?: number;
  numericalTolerance?: number;
  marks: number;
  negativeMarks: number;
  partialMarking?: boolean;
  explanation: string;
  status: "PUBLISHED" | "IN_REVIEW" | "DRAFT";
  contributor: string;
  year?: string;
}

const mockBankQuestions: BankQuestion[] = [
  {
    id: "QB-PHY-2024-01",
    subject: "Physics",
    chapter: "Rotational Dynamics & Inertia",
    topic: "Conservation of Angular Momentum & Rolling",
    examTag: "JEE_ADVANCED",
    kind: "multiple_choice",
    difficulty: "ADVANCED",
    year: "2024 Paper 1",
    text: "A uniform solid cylinder of mass M and radius R rolls without slipping down an inclined plane of inclination θ. A small particle of mass m is attached to the rim of the cylinder. Which of the following statements are correct?",
    formula: "I_{cm} = \\frac{1}{2} M R^2",
    options: [
      { id: "A", text: "The acceleration of the cylinder is independent of mass m when m << M.", isCorrect: true },
      { id: "B", text: "The friction force on the contact point is purely static and performs zero net work.", isCorrect: true },
      { id: "C", text: "Total mechanical energy is strictly conserved throughout the pure rolling motion.", isCorrect: true },
      { id: "D", text: "The coefficient of friction required for pure rolling is μ >= (1/3) tan θ.", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 2,
    partialMarking: true,
    explanation: "For a uniform cylinder, I_cm = (1/2)MR^2. When rolling without slipping on a stationary surface, the instantaneous point of contact is at rest, hence static friction does no net work (Option B). Mechanical energy is conserved because non-conservative forces do zero work (Option C). For m << M, acceleration a = (g sin θ) / (1 + I/MR^2) = (2/3)g sin θ (Option A). The required minimum friction is (1/3) tan θ, so μ >= (1/3) tan θ only if pure cylinder.",
    status: "PUBLISHED",
    contributor: "Er. Vivek Gupta (Senior Faculty)",
  },
  {
    id: "QB-CHEM-2023-14",
    subject: "Chemistry",
    chapter: "Aldehydes, Ketones & Carboxylic Acids",
    topic: "Aldol Condensation & Cannizzaro Reaction",
    examTag: "JEE_MAIN",
    kind: "single_choice",
    difficulty: "MEDIUM",
    year: "2023 Shift 2",
    text: "Benzaldehyde on treatment with 50% concentrated aqueous KOH solution at room temperature undergoes disproportionation to yield:",
    options: [
      { id: "A", text: "Benzyl alcohol and Potassium benzoate", isCorrect: true },
      { id: "B", text: "Benzoic acid and Benzophenone", isCorrect: false },
      { id: "C", text: "Hydrobenzamide and Water", isCorrect: false },
      { id: "D", text: "Benzoin and Potassium hydroxide", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 1,
    explanation: "Benzaldehyde lacks α-hydrogens. Therefore, in the presence of 50% concentrated alkaline KOH, it undergoes the classic Cannizzaro reaction. One molecule of benzaldehyde is reduced to benzyl alcohol (C6H5CH2OH), while the other molecule is oxidized to potassium benzoate (C6H5COOK).",
    status: "PUBLISHED",
    contributor: "Dr. K. S. Verma (Head of Chemistry)",
  },
  {
    id: "QB-MATH-2024-88",
    subject: "Mathematics",
    chapter: "Definite Integrals & Differential Calculus",
    topic: "Leibnitz Rule and Area under Curves",
    examTag: "JEE_ADVANCED",
    kind: "numerical",
    difficulty: "HARD",
    year: "2024 Paper 2",
    text: "Let f: [0, ∞) -> R be a continuous function such that f(x) = 1 - 2x + \\int_{0}^{x} e^{x - t} f(t) dt. Then the absolute value of the area bounded by the curve y = f(x) and the axes from x = 0 to x = 1 is equal to:",
    correctNumber: 0.63,
    numericalTolerance: 0.05,
    marks: 4,
    negativeMarks: 0,
    explanation: "Differentiating both sides using Leibnitz integral rule: f'(x) = -2 + e^x f(x) + e^x \\int_0^x e^{-t} f(t) dt. Subtracting f(x) yields a standard linear differential equation: f'(x) - f(x) = -2 + 2x. Solving with integrating factor e^{-x} gives f(x) = e^{-x} - 2x. The integral from 0 to 1 calculates to approximately 0.632.",
    status: "PUBLISHED",
    contributor: "Ateeb Fatmi (Director)",
  },
  {
    id: "QB-BIO-2023-42",
    subject: "Biology",
    chapter: "Principles of Inheritance and Variation",
    topic: "Mendelian Dihybrid Cross and Gene Linkage",
    examTag: "NEET",
    kind: "single_choice",
    difficulty: "EASY",
    year: "NEET 2023",
    text: "In Morgan's experiments on Drosophila melanogaster, what was the percentage of recombinant types observed for body color (yellow) and eye color (white)?",
    options: [
      { id: "A", text: "1.3%", isCorrect: true },
      { id: "B", text: "37.2%", isCorrect: false },
      { id: "C", text: "98.7%", isCorrect: false },
      { id: "D", text: "50.0%", isCorrect: false },
    ],
    marks: 4,
    negativeMarks: 1,
    explanation: "According to NCERT Biology Class 12, T.H. Morgan observed that yellow body and white eye genes were very tightly linked on the X chromosome and showed only 1.3% recombination, while white eye and miniature wing showed 37.2% recombination.",
    status: "PUBLISHED",
    contributor: "Dr. Ananya Ray (Senior Zoology Faculty)",
  },
];

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<BankQuestion[]>(mockBankQuestions);
  const [searchTerm, setSearchTerm] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [expandedExplanation, setExpandedExplanation] = useState<string | null>(null);

  // New Question Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubject, setNewSubject] = useState<"Physics" | "Chemistry" | "Mathematics" | "Biology">("Physics");
  const [newChapter, setNewChapter] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newExamTag, setNewExamTag] = useState<"JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION">("JEE_ADVANCED");
  const [newKind, setNewKind] = useState<"single_choice" | "multiple_choice" | "numerical" | "assertion_reason">("single_choice");
  const [newDifficulty, setNewDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "ADVANCED">("MEDIUM");
  const [newText, setNewText] = useState("");
  const [newOptA, setNewOptA] = useState("");
  const [newOptB, setNewOptB] = useState("");
  const [newOptC, setNewOptC] = useState("");
  const [newOptD, setNewOptD] = useState("");
  const [newCorrectOpt, setNewCorrectOpt] = useState("A");
  const [newCorrectNumber, setNewCorrectNumber] = useState("");
  const [newExplanation, setNewExplanation] = useState("");

  // Load real database questions on mount
  useEffect(() => {
    async function fetchLiveQuestions() {
      try {
        const orgRes = await fetch("/api/organizations/active");
        if (!orgRes.ok) return;
        const orgData = await orgRes.json();
        const slug = orgData.organization?.slug;
        if (!slug) return;

        const res = await fetch(`/api/organizations/${encodeURIComponent(slug)}/question-bank?limit=50`);
        if (res.ok) {
          const data = await res.json();
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions);
          }
        }
      } catch (err) {
        console.error("Failed to fetch live questions", err);
      }
    }
    void fetchLiveQuestions();
  }, []);

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.chapter.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = subjectFilter === "ALL" || q.subject === subjectFilter;
    const matchesDifficulty = difficultyFilter === "ALL" || q.difficulty === difficultyFilter;
    const matchesKind = kindFilter === "ALL" || q.kind === kindFilter;
    return matchesSearch && matchesSubject && matchesDifficulty && matchesKind;
  });

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !newChapter.trim()) return;

    const created: BankQuestion = {
      id: `QB-${newSubject.substring(0, 3).toUpperCase()}-2026-${Math.floor(100 + Math.random() * 900)}`,
      subject: newSubject,
      chapter: newChapter.trim(),
      topic: newTopic.trim() || "General Concept",
      examTag: newExamTag,
      kind: newKind,
      difficulty: newDifficulty,
      text: newText.trim(),
      options:
        newKind !== "numerical"
          ? [
              { id: "A", text: newOptA || "Option A", isCorrect: newCorrectOpt === "A" },
              { id: "B", text: newOptB || "Option B", isCorrect: newCorrectOpt === "B" },
              { id: "C", text: newOptC || "Option C", isCorrect: newCorrectOpt === "C" },
              { id: "D", text: newOptD || "Option D", isCorrect: newCorrectOpt === "D" },
            ]
          : undefined,
      correctNumber: newKind === "numerical" ? parseFloat(newCorrectNumber) || 0 : undefined,
      numericalTolerance: newKind === "numerical" ? 0.05 : undefined,
      marks: 4,
      negativeMarks: newKind === "numerical" ? 0 : 1,
      partialMarking: newKind === "multiple_choice",
      explanation: newExplanation.trim() || "Stepwise solution verified by faculty.",
      status: "PUBLISHED",
      contributor: "Faculty Contributor",
      year: "2026 Institute Mock",
    };

    setQuestions([created, ...questions]);
    setShowAddModal(false);
    // Reset form
    setNewChapter("");
    setNewTopic("");
    setNewText("");
    setNewOptA("");
    setNewOptB("");
    setNewOptC("");
    setNewOptD("");
    setNewCorrectNumber("");
    setNewExplanation("");
  };

  const handleDuplicate = (q: BankQuestion) => {
    const dup: BankQuestion = {
      ...q,
      id: `${q.id}-COPY`,
      text: `[Variant] ${q.text}`,
      status: "DRAFT",
    };
    setQuestions([dup, ...questions]);
  };

  return (
    <DashboardLayout
      title="Question Bank & PYQ Repository"
      subtitle="Curated library of 25,000+ JEE, NEET & Foundation questions with step-by-step LaTeX solutions and partial marking"
      action={
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/dashboard/assessments/workspace" className="pz-button pz-button-outline" style={{ textDecoration: "none" }}>
            ← Back to Assessments
          </Link>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            ＋ Create New Question
          </Button>
        </div>
      }
    >
      {/* Metrics Row */}
      <div className="metrics-grid">
        <MetricCard label="Total Questions" value="25,480" detail="Shared PrepZii Library" accent="yellow" />
        <MetricCard label="Verified PYQs" value="18,240" detail="2017–2026 NTA & JEE Papers" accent="green" />
        <MetricCard label="Multi-Correct & Numerical" value="7,120" detail="JEE Advanced Standard" accent="navy" />
        <MetricCard label="Institute Custom Tests" value={String(questions.length)} detail="Custom Faculty Drafts" accent="orange" />
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "16px 20px",
          background: "white",
          borderRadius: "18px",
          border: "1px solid var(--line)",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
        }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <input
            type="text"
            placeholder="🔍 Search question text, formula, chapter, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>Subject:</label>
          <Select
            value={subjectFilter}
            onChange={(val) => setSubjectFilter(val)}
            size="sm"
            style={{ width: "160px" }}
          >
            <option value="ALL">All Subjects</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Biology">Biology</option>
          </Select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>Difficulty:</label>
          <Select
            value={difficultyFilter}
            onChange={(val) => setDifficultyFilter(val)}
            size="sm"
            style={{ width: "170px" }}
          >
            <option value="ALL">All Levels</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
            <option value="ADVANCED">Advanced (JEE Adv)</option>
          </Select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)" }}>Type:</label>
          <Select
            value={kindFilter}
            onChange={(val) => setKindFilter(val)}
            size="sm"
            style={{ width: "190px" }}
          >
            <option value="ALL">All Question Types</option>
            <option value="single_choice">Single Choice (SCQ)</option>
            <option value="multiple_choice">Multiple Correct (MCQ)</option>
            <option value="numerical">Numerical Value (NVQ)</option>
          </Select>
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: "grid", gap: "18px" }}>
        {filteredQuestions.map((q, idx) => {
          const isExpanded = expandedExplanation === q.id;

          return (
            <div
              key={q.id}
              style={{
                background: "white",
                border: "1px solid var(--line)",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
                transition: "all 0.2s ease",
              }}
            >
              {/* Question Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      fontWeight: 800,
                      color: "#0f172a",
                      background: "#f1f5f9",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Q{idx + 1} · {q.id}
                  </span>
                  <Badge variant={q.subject === "Physics" ? "brand" : q.subject === "Chemistry" ? "warning" : q.subject === "Mathematics" ? "info" : "success"} size="sm">
                    {q.subject}
                  </Badge>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                    {q.chapter} · {q.topic}
                  </span>
                  {q.year && (
                    <span style={{ background: "#fef3c7", color: "#854d0e", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px" }}>
                      ★ {q.year}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#047857" }}>
                    +{q.marks} / -{q.negativeMarks} Marks
                  </span>
                  {q.partialMarking && (
                    <span style={{ background: "#ecfdf5", color: "#065f46", fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", border: "1px solid #a7f3d0" }}>
                      Partial Scheme
                    </span>
                  )}
                  <Badge variant={q.difficulty === "ADVANCED" ? "danger" : q.difficulty === "HARD" ? "warning" : "neutral"} size="sm">
                    {q.difficulty}
                  </Badge>
                </div>
              </div>

              {/* Question Text */}
              <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#1e293b", marginBottom: "16px", fontWeight: 500 }}>
                {q.text}
              </div>

              {/* Formula Callout */}
              {q.formula && (
                <div
                  style={{
                    background: "#f8fafc",
                    borderLeft: "3px solid var(--brand)",
                    padding: "8px 14px",
                    borderRadius: "0 8px 8px 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    color: "#0f172a",
                    marginBottom: "16px",
                  }}
                >
                  Formula: {q.formula}
                </div>
              )}

              {/* Options Palette */}
              {q.options && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "10px", marginBottom: "16px" }}>
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: opt.isCorrect ? "1.5px solid #10b981" : "1px solid var(--line)",
                        background: opt.isCorrect ? "#f0fdf4" : "#f8fafc",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: opt.isCorrect ? "#10b981" : "#e2e8f0",
                          color: opt.isCorrect ? "white" : "#475569",
                          fontSize: "11px",
                          fontWeight: 800,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {opt.id}
                      </span>
                      <span style={{ color: opt.isCorrect ? "#065f46" : "#334155", fontWeight: opt.isCorrect ? 600 : 400 }}>
                        {opt.text}
                      </span>
                      {opt.isCorrect && (
                        <span style={{ marginLeft: "auto", fontSize: "11px", color: "#10b981", fontWeight: 800 }}>
                          ✓ Correct
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Numerical Answer Badge */}
              {q.kind === "numerical" && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    color: "#1e40af",
                  }}
                >
                  🎯 <strong>Correct Numerical Value:</strong> {q.correctNumber} (Allowed Tolerance: ±{q.numericalTolerance})
                </div>
              )}

              {/* Expandable Step-by-Step Explanation */}
              {isExpanded && (
                <div
                  style={{
                    background: "#fffdf5",
                    border: "1px solid #fef08a",
                    padding: "16px",
                    borderRadius: "12px",
                    marginBottom: "16px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    color: "#854d0e",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "6px" }}>📖 Official Faculty Step-by-Step Solution:</strong>
                  {q.explanation}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Verified by: <strong>{q.contributor}</strong>
                </span>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedExplanation(isExpanded ? null : q.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--blue)",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    {isExpanded ? "▲ Hide Solution" : "▼ View Stepwise Solution"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicate(q)}
                    style={{
                      border: "1px solid var(--line)",
                      background: "white",
                      borderRadius: "8px",
                      fontSize: "12px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      color: "#475569",
                    }}
                  >
                    Duplicate Variant
                  </button>

                  <Link
                    href="/dashboard/assessments/workspace"
                    style={{
                      border: "1px solid #facc15",
                      background: "#fefce8",
                      borderRadius: "8px",
                      fontSize: "12px",
                      padding: "4px 12px",
                      cursor: "pointer",
                      color: "#854d0e",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    ＋ Add to Test Series
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE NEW QUESTION MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: "620px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-display)" }}>
                Add New Question to Repository
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ border: "none", background: "none", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} style={{ display: "grid", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Subject *
                  </label>
                  <Select
                    value={newSubject}
                    onChange={(val) => setNewSubject(val as BankQuestion["subject"])}
                    style={{ width: "100%" }}
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                  </Select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Question Type *
                  </label>
                  <Select
                    value={newKind}
                    onChange={(val) => setNewKind(val as BankQuestion["kind"])}
                    style={{ width: "100%" }}
                  >
                    <option value="single_choice">Single Choice (1 Correct)</option>
                    <option value="multiple_choice">Multiple Correct (Partial Marking)</option>
                    <option value="numerical">Numerical Value</option>
                  </Select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Exam Target *
                  </label>
                  <Select
                    value={newExamTag}
                    onChange={(val) => setNewExamTag(val as BankQuestion["examTag"])}
                    style={{ width: "100%" }}
                  >
                    <option value="JEE_ADVANCED">JEE Advanced</option>
                    <option value="JEE_MAIN">JEE Main</option>
                    <option value="NEET">NEET</option>
                    <option value="FOUNDATION">Foundation</option>
                  </Select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Difficulty Level *
                  </label>
                  <Select
                    value={newDifficulty}
                    onChange={(val) => setNewDifficulty(val as BankQuestion["difficulty"])}
                    style={{ width: "100%" }}
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                    <option value="ADVANCED">Advanced</option>
                  </Select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Chapter Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Thermodynamics / Electrostatics"
                    value={newChapter}
                    onChange={(e) => setNewChapter(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Sub-Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Carnot Cycle & Efficiency"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Question Text (Supports Unicode & Formula notation) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the complete question statement..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              {newKind !== "numerical" ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700 }}>Options & Correct Answer</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="Option A text"
                      value={newOptA}
                      onChange={(e) => setNewOptA(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                    />
                    <input
                      type="text"
                      placeholder="Option B text"
                      value={newOptB}
                      onChange={(e) => setNewOptB(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                    />
                    <input
                      type="text"
                      placeholder="Option C text"
                      value={newOptC}
                      onChange={(e) => setNewOptC(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                    />
                    <input
                      type="text"
                      placeholder="Option D text"
                      value={newOptD}
                      onChange={(e) => setNewOptD(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Correct Option:</span>
                    {["A", "B", "C", "D"].map((opt) => (
                      <label key={opt} style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="correctOption"
                          checked={newCorrectOpt === opt}
                          onChange={() => setNewCorrectOpt(opt)}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                    Correct Numerical Answer *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 9.8 or 24.5"
                    value={newCorrectNumber}
                    onChange={(e) => setNewCorrectNumber(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>
                  Step-by-Step Solution & Faculty Explanation
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain stepwise derivation, formula applied, and common student misconceptions..."
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Publish to Question Bank
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
