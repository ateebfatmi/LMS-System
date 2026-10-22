import assert from "node:assert/strict";
import test from "node:test";
import { adaptPrepziiQuestion, gradeAssessment, gradeAnswer, computeLeaderboard } from "./index.js";

test("grades unordered multiple-choice selections", () => {
  const result = gradeAnswer(
    { id: "q1", kind: "multiple_choice", correctOptionIds: ["a", "c"], marks: 4, negativeMarks: 1 },
    { questionId: "q1", selectedOptionIds: ["c", "a"] },
  );
  assert.deepEqual(result, { questionId: "q1", status: "correct", score: 4, timeSpentSeconds: 0 });
});

test("supports JEE Advanced partial marking", () => {
  const question = {
    id: "q_adv",
    kind: "multiple_choice" as const,
    correctOptionIds: ["a", "b", "c"],
    marks: 6,
    negativeMarks: 2,
    partialMarking: true,
  };

  // 2 out of 3 correct selected (no incorrect) => (6/3)*2 = 4 marks
  const partial = gradeAnswer(question, { questionId: "q_adv", selectedOptionIds: ["a", "b"] });
  assert.equal(partial.status, "partially_correct");
  assert.equal(partial.score, 4);

  // 1 incorrect chosen along with correct => penalty -2 marks
  const incorrect = gradeAnswer(question, { questionId: "q_adv", selectedOptionIds: ["a", "d"] });
  assert.equal(incorrect.status, "incorrect");
  assert.equal(incorrect.score, -2);
});

test("applies numerical tolerance and leaves missing answers unpenalized", () => {
  const result = gradeAssessment(
    [
      { id: "q1", kind: "numerical", correctNumber: 9.8, numericalTolerance: 0.05, marks: 4, subject: "Physics" },
      { id: "q2", kind: "single_choice", correctOptionIds: ["b"], marks: 4, negativeMarks: 1, subject: "Physics" },
    ],
    [{ questionId: "q1", number: 9.82, timeSpentSeconds: 45 }],
  );
  assert.equal(result.totalScore, 4);
  assert.equal(result.correctCount, 1);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.subjectWise.Physics.score, 4);
});

test("computes ranked leaderboard with percentiles", () => {
  const questions = [
    { id: "q1", kind: "single_choice" as const, correctOptionIds: ["a"], marks: 4, negativeMarks: 1 },
    { id: "q2", kind: "single_choice" as const, correctOptionIds: ["b"], marks: 4, negativeMarks: 1 },
  ];

  const submissions = [
    {
      studentId: "s1",
      studentName: "Aarav Sharma",
      batchName: "JEE 12A",
      answers: [
        { questionId: "q1", selectedOptionIds: ["a"], timeSpentSeconds: 30 },
        { questionId: "q2", selectedOptionIds: ["b"], timeSpentSeconds: 40 },
      ],
    },
    {
      studentId: "s2",
      studentName: "Isha Patel",
      batchName: "JEE 12A",
      answers: [
        { questionId: "q1", selectedOptionIds: ["a"], timeSpentSeconds: 20 },
        { questionId: "q2", selectedOptionIds: ["c"], timeSpentSeconds: 30 },
      ],
    },
    {
      studentId: "s3",
      studentName: "Rohan Verma",
      batchName: "JEE 12B",
      answers: [
        { questionId: "q1", selectedOptionIds: ["b"], timeSpentSeconds: 50 },
        { questionId: "q2", selectedOptionIds: ["c"], timeSpentSeconds: 50 },
      ],
    },
  ];

  const leaderboard = computeLeaderboard(questions, submissions);
  assert.equal(leaderboard.length, 3);
  assert.equal(leaderboard[0].studentName, "Aarav Sharma");
  assert.equal(leaderboard[0].rank, 1);
  assert.equal(leaderboard[0].percentile, 100);
  assert.equal(leaderboard[1].studentName, "Isha Patel");
  assert.equal(leaderboard[1].rank, 2);
  assert.equal(leaderboard[1].totalScore, 3); // 4 - 1 = 3
  assert.equal(leaderboard[2].studentName, "Rohan Verma");
  assert.equal(leaderboard[2].rank, 3);
  assert.equal(leaderboard[2].totalScore, -2); // -1 - 1 = -2
});

test("adapts the existing PrepZii question schema without changing scoring signs", () => {
  const question = adaptPrepziiQuestion({
    id: "q1", exam: "JEE Advanced", subject: "Physics", question_type: "Multiple Correct",
    question_text: "Choose all", option_a: "A", option_b: "B", option_c: "C", option_d: "D",
    correct_option: "A,C", marks: 4, negative_marks: -2,
  });
  assert.equal(question.kind, "multiple_choice");
  assert.deepEqual(question.correctOptionIds, ["A", "C"]);
  assert.equal(question.negativeMarks, 2);
  assert.equal(question.partialMarking, true);
});



test("preserves legacy scoring when Supabase returns numeric marks as text", () => {
  const question = adaptPrepziiQuestion({ id: "legacy-q", correct_option: "A", marks: 4, negative_marks: "-1" });
  assert.equal(question.negativeMarks, 1);
  assert.equal(gradeAnswer(question, { questionId: "legacy-q", selectedOptionIds: ["B"] }).score, -1);
});
