import assert from "node:assert/strict";
import test from "node:test";
import { calculateStudentRisk, recommendedActions } from "./index.ts";

test("does not penalize missing evidence", () => {
  assert.deepEqual(calculateStudentRisk({
    attendancePercentage: null,
    assessmentAverage: null,
    assignmentCompletion: null,
    daysSinceLastActivity: null,
  }), { score: 0, level: "LOW", reasons: [] });
});

test("flags a student with multiple material signals", () => {
  const result = calculateStudentRisk({
    attendancePercentage: 40,
    assessmentAverage: 30,
    assignmentCompletion: 25,
    daysSinceLastActivity: 18,
  });
  assert.equal(result.level, "HIGH");
  assert.ok(result.score >= 45);
  assert.deepEqual(result.reasons.map((reason) => reason.code), [
    "MISSED_ASSIGNMENTS",
    "LOW_ATTENDANCE",
    "LOW_ASSESSMENT",
    "INACTIVE",
  ]);
  assert.ok(recommendedActions(result).length >= 4);
});

test("clamps malformed percentages and caps the score", () => {
  const result = calculateStudentRisk({
    attendancePercentage: -20,
    assessmentAverage: -5,
    assignmentCompletion: -1,
    daysSinceLastActivity: 500,
  });
  assert.equal(result.score, 100);
  assert.equal(result.level, "CRITICAL");
});
