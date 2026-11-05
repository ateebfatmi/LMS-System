"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bookmark } from "lucide-react";
import "./demo.css";

// Mock CBT Question Data
const CBT_QUESTIONS = [
  {
    subject: "Physics",
    question:
      "A particle of mass m moves in a planar circular orbit of radius r under an attractive central potential V(r) = k·r². Applying the Bohr-Sommerfeld quantization condition to the angular momentum, the orbital angular frequency ω and time period T are respectively:",
    options: [
      { id: "A", text: "ω ∝ r, T ∝ r⁻¹/²" },
      { id: "B", text: "ω = √(2k/m) (Independent of r), T = Constant" },
      { id: "C", text: "ω ∝ r⁻², T ∝ r²" },
      { id: "D", text: "ω ∝ r¹/², T ∝ r³/²" },
    ],
    explanation:
      "For a harmonic potential V(r) = kr², the central restoring force is F = -∂V/∂r = -2kr. Equating with centripetal force m·r·ω² = 2kr yields ω = √(2k/m), which is completely independent of the orbit radius r.",
  },
  {
    subject: "Chemistry",
    question:
      "Which of the following octahedral complexes exhibits optical isomerism and is diamagnetic according to Crystal Field Theory (CFT)?",
    options: [
      { id: "A", text: "[Co(NH₃)₆]³⁺" },
      { id: "B", text: "cis-[Co(en)₂Cl₂]⁺" },
      { id: "C", text: "trans-[Co(en)₂Cl₂]⁺" },
      { id: "D", text: "[Ni(H₂O)₆]²⁺" },
    ],
    explanation:
      "cis-[Co(en)₂Cl₂]⁺ lacks a plane or center of symmetry, rendering it non-superimposable on its mirror image (optically active). Cobalt is in +3 state (d⁶ low spin with strong-field ethylenediamine chelates), making it diamagnetic (t₂g⁶ eg⁰).",
  },
  {
    subject: "Mathematics",
    question:
      "Evaluate the definite integral: I = ∫[0 to π] (x · sin x) / (1 + cos² x) dx. Using symmetry King's Rule:",
    options: [
      { id: "A", text: "π² / 8" },
      { id: "B", text: "π² / 4" },
      { id: "C", text: "π / 2" },
      { id: "D", text: "2π²" },
    ],
    explanation:
      "Applying King's Rule: 2I = π ∫[0 to π] (sin x)/(1 + cos² x) dx. Substituting u = cos x gives 2I = π [tan⁻¹(-u)] from -1 to 1 = π (π/2) = π²/2 => I = π²/4.",
  },
];

type QuestionResponse = { option?: string; marked?: boolean };

export default function CbtDemo() {
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, QuestionResponse>>({});
  const [showSolution, setShowSolution] = useState(false);
  const question = CBT_QUESTIONS[index];
  const response = responses[index];

  function goTo(next: number) {
    setIndex(next);
    setShowSolution(false);
  }

  function updateResponse(change: QuestionResponse) {
    setResponses((previous) => ({ ...previous, [index]: { ...previous[index], ...change } }));
  }

  return (
    <main className="lp lp-cbt">
      <div className="lp-wrap lp-section">
        <Link href="/#modules" className="lp-text-link"><ArrowLeft /> Back to Prepzii</Link>
        <div className="lp-cbt-title">
          <h1>Try the CBT Demo</h1>
          <p>Choose an answer, mark a question for review, or reveal the solution in this sample test.</p>
        </div>
        <div className="lp-cbt-frame">
          <div className="lp-dashboard-bar">
            <strong>Practice assessment</strong>
            <span className="lp-preview-label">Demo · Sample questions</span>
          </div>
          <div className="lp-cbt-grid">
            <div className="lp-cbt-question">
              <p className="lp-dashboard-kicker">{question.subject} · Question {index + 1} of {CBT_QUESTIONS.length}</p>
              <fieldset className="lp-cbt-options">
                <legend>{question.question}</legend>
                {question.options.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio" name="answer" value={option.id} checked={response?.option === option.id}
                      onChange={() => updateResponse({ option: option.id })}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </fieldset>
              {showSolution && <p className="lp-cbt-solution">{question.explanation}</p>}
              <div className="lp-cbt-actions">
                <button type="button" className="lp-button lp-secondary" aria-expanded={showSolution} onClick={() => setShowSolution(!showSolution)}>
                  {showSolution ? "Hide Solution" : "Show Solution"}
                </button>
                <button type="button" className="lp-button lp-secondary" aria-pressed={Boolean(response?.marked)} onClick={() => updateResponse({ marked: !response?.marked })}>
                  <Bookmark /> {response?.marked ? "Marked for Review" : "Mark for Review"}
                </button>
                <button type="button" className="lp-button lp-primary" onClick={() => goTo((index + 1) % CBT_QUESTIONS.length)}>
                  Save &amp; Next <ArrowRight />
                </button>
              </div>
            </div>
            <nav className="lp-cbt-palette" aria-label="Question palette">
              <h2>Question Palette</h2>
              {CBT_QUESTIONS.map((item, itemIndex) => (
                <button type="button" key={item.subject} onClick={() => goTo(itemIndex)} aria-current={index === itemIndex ? "step" : undefined}>
                  <strong>{itemIndex + 1}. {item.subject}</strong>
                  <span>{responses[itemIndex]?.marked ? "Marked for review" : responses[itemIndex]?.option ? "Answered" : "Unanswered"}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </main>
  );
}
