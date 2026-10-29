import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOMRSubmission, type ScannedBubbleAnswer } from "./index.js";

test("OMR Evaluation: Grades standard single-choice test correctly", () => {
  const answerKey: Record<number, "A" | "B" | "C" | "D"> = {
    1: "A",
    2: "B",
    3: "C",
    4: "D",
    5: "A",
  };

  const scanned: ScannedBubbleAnswer[] = [
    { questionNumber: 1, selectedOption: "A", confidence: 0.95 }, // Correct (+4)
    { questionNumber: 2, selectedOption: "C", confidence: 0.92 }, // Incorrect (-1)
    { questionNumber: 3, selectedOption: "BLANK", confidence: 1.0 }, // Unattempted (0)
    { questionNumber: 4, selectedOption: "MULTIPLE", confidence: 0.8 }, // Multiple filled (-1)
    { questionNumber: 5, selectedOption: "A", confidence: 0.99 }, // Correct (+4)
  ];

  const result = evaluateOMRSubmission(scanned, answerKey, 4, 1);

  assert.equal(result.correctCount, 2);
  assert.equal(result.incorrectCount, 2);
  assert.equal(result.unattemptedCount, 1);
  assert.equal(result.score, 6); // 4 + 4 - 1 - 1 = 6
  assert.equal(result.maxScore, 20); // 5 * 4 = 20
  assert.equal(result.percentage, 30); // 6 / 20 = 30%
});
