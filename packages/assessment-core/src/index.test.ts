import assert from "node:assert/strict";
import test from "node:test";
import { gradeAssessment, gradeAnswer } from "./index.ts";

test("grades unordered multiple-choice selections", () => {
  const result = gradeAnswer(
    { id: "q1", kind: "multiple_choice", correctOptionIds: ["a", "c"], marks: 4, negativeMarks: 1 },
    { questionId: "q1", selectedOptionIds: ["c", "a"] },
  );
  assert.deepEqual(result, { questionId: "q1", status: "correct", score: 4 });
});

test("applies numerical tolerance and leaves missing answers unpenalized", () => {
  const result = gradeAssessment(
    [
      { id: "q1", kind: "numerical", correctNumber: 9.8, numericalTolerance: 0.05, marks: 4 },
      { id: "q2", kind: "single_choice", correctOptionIds: ["b"], marks: 4, negativeMarks: 1 },
    ],
    [{ questionId: "q1", number: 9.82 }],
  );
  assert.equal(result.score, 4);
  assert.equal(result.correct, 1);
  assert.equal(result.unanswered, 1);
});

