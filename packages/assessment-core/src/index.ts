import type {
  AnswerSubmission,
  GradedAnswer,
  QuestionDefinition,
} from "@prepzii/contracts";

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function gradeAnswer(
  question: QuestionDefinition,
  answer?: AnswerSubmission,
): GradedAnswer {
  const unanswered =
    !answer ||
    (answer.number === undefined && (!answer.selectedOptionIds || answer.selectedOptionIds.length === 0));

  if (unanswered) {
    return {
      questionId: question.id,
      status: "unanswered",
      score: 0,
      timeSpentSeconds: answer?.timeSpentSeconds ?? 0,
    };
  }

  const timeSpent = answer.timeSpentSeconds ?? 0;

  if (question.kind === "numerical") {
    const tolerance = question.numericalTolerance ?? 0;
    const isCorrect =
      question.correctNumber !== undefined &&
      answer.number !== undefined &&
      Math.abs(answer.number - question.correctNumber) <= tolerance;

    return {
      questionId: question.id,
      status: isCorrect ? "correct" : "incorrect",
      score: isCorrect ? question.marks : -(question.negativeMarks ?? 0),
      timeSpentSeconds: timeSpent,
    };
  }

  const selected = answer.selectedOptionIds ?? [];
  const correct = question.correctOptionIds ?? [];

  if (question.kind === "single_choice") {
    const isCorrect = sameSet(selected, correct);
    return {
      questionId: question.id,
      status: isCorrect ? "correct" : "incorrect",
      score: isCorrect ? question.marks : -(question.negativeMarks ?? 0),
      timeSpentSeconds: timeSpent,
    };
  }

  // Multiple Choice (with optional JEE Advanced partial marking rule)
  if (question.kind === "multiple_choice") {
    if (sameSet(selected, correct)) {
      return {
        questionId: question.id,
        status: "correct",
        score: question.marks,
        timeSpentSeconds: timeSpent,
      };
    }

    // Check if any selected option is WRONG
    const hasIncorrectSelection = selected.some((opt) => !correct.includes(opt));
    if (hasIncorrectSelection) {
      return {
        questionId: question.id,
        status: "incorrect",
        score: -(question.negativeMarks ?? 0),
        timeSpentSeconds: timeSpent,
      };
    }

    // If partial marking is enabled and all selected options are correct (subset of correct options)
    if (question.partialMarking && selected.length > 0) {
      // JEE Advanced partial marking scheme proportional to chosen correct options
      const partialScore = Math.max(1, Math.floor((question.marks / correct.length) * selected.length));
      return {
        questionId: question.id,
        status: "partially_correct",
        score: partialScore,
        timeSpentSeconds: timeSpent,
      };
    }

    return {
      questionId: question.id,
      status: "incorrect",
      score: -(question.negativeMarks ?? 0),
      timeSpentSeconds: timeSpent,
    };
  }

  return {
    questionId: question.id,
    status: "incorrect",
    score: -(question.negativeMarks ?? 0),
    timeSpentSeconds: timeSpent,
  };
}

export interface AssessmentSummary {
  results: GradedAnswer[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  partiallyCorrectCount: number;
  totalTimeSpentSeconds: number;
  subjectWise: Record<
    string,
    {
      score: number;
      maxScore: number;
      correct: number;
      incorrect: number;
      unanswered: number;
    }
  >;
}

export function gradeAssessment(
  questions: readonly QuestionDefinition[],
  answers: readonly AnswerSubmission[],
): AssessmentSummary {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const results = questions.map((question) => gradeAnswer(question, answerByQuestion.get(question.id)));

  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const totalTimeSpentSeconds = results.reduce((sum, r) => sum + (r.timeSpentSeconds ?? 0), 0);

  const subjectWise: AssessmentSummary["subjectWise"] = {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const r = results[i];
    const subj = q.subject || "General";

    if (!subjectWise[subj]) {
      subjectWise[subj] = { score: 0, maxScore: 0, correct: 0, incorrect: 0, unanswered: 0 };
    }

    subjectWise[subj].score += r.score;
    subjectWise[subj].maxScore += q.marks;
    if (r.status === "correct" || r.status === "partially_correct") {
      subjectWise[subj].correct += 1;
    } else if (r.status === "incorrect") {
      subjectWise[subj].incorrect += 1;
    } else {
      subjectWise[subj].unanswered += 1;
    }
  }

  return {
    results,
    totalScore,
    maxScore,
    percentage: maxScore > 0 ? Math.round((Math.max(0, totalScore) / maxScore) * 1000) / 10 : 0,
    correctCount: results.filter((r) => r.status === "correct").length,
    incorrectCount: results.filter((r) => r.status === "incorrect").length,
    unansweredCount: results.filter((r) => r.status === "unanswered").length,
    partiallyCorrectCount: results.filter((r) => r.status === "partially_correct").length,
    totalTimeSpentSeconds,
    subjectWise,
  };
}

export interface StudentSubmissionData {
  studentId: string;
  studentName: string;
  batchName: string;
  answers: AnswerSubmission[];
}

export interface RankedStudentResult extends AssessmentSummary {
  studentId: string;
  studentName: string;
  batchName: string;
  rank: number;
  percentile: number;
}

export function computeLeaderboard(
  questions: readonly QuestionDefinition[],
  submissions: readonly StudentSubmissionData[],
): RankedStudentResult[] {
  if (submissions.length === 0) return [];

  const gradedList = submissions.map((sub) => {
    const summary = gradeAssessment(questions, sub.answers);
    return {
      ...summary,
      studentId: sub.studentId,
      studentName: sub.studentName,
      batchName: sub.batchName,
      rank: 0,
      percentile: 0,
    };
  });

  // Sort descending by totalScore, then ascending by totalTimeSpentSeconds
  gradedList.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.totalTimeSpentSeconds - b.totalTimeSpentSeconds;
  });

  const totalCandidates = gradedList.length;

  return gradedList.map((item, index) => {
    const rank = index + 1;
    // Standard percentile formula: (number of candidates scored less than candidate / total) * 100
    const candidatesBelow = totalCandidates - rank;
    const percentile = totalCandidates > 1
      ? Math.round((candidatesBelow / (totalCandidates - 1)) * 1000) / 10
      : 100;

    return {
      ...item,
      rank,
      percentile,
    };
  });
}


