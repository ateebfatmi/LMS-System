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
    return { questionId: question.id, status: "unanswered", score: 0 };
  }

  let correct = false;

  if (question.kind === "numerical") {
    const tolerance = question.numericalTolerance ?? 0;
    correct =
      question.correctNumber !== undefined &&
      answer.number !== undefined &&
      Math.abs(answer.number - question.correctNumber) <= tolerance;
  } else {
    correct = sameSet(answer.selectedOptionIds ?? [], question.correctOptionIds ?? []);
  }

  return {
    questionId: question.id,
    status: correct ? "correct" : "incorrect",
    score: correct ? question.marks : -(question.negativeMarks ?? 0),
  };
}

export function gradeAssessment(
  questions: readonly QuestionDefinition[],
  answers: readonly AnswerSubmission[],
) {
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  const results = questions.map((question) => gradeAnswer(question, answerByQuestion.get(question.id)));

  return {
    results,
    score: results.reduce((sum, result) => sum + result.score, 0),
    correct: results.filter((result) => result.status === "correct").length,
    incorrect: results.filter((result) => result.status === "incorrect").length,
    unanswered: results.filter((result) => result.status === "unanswered").length,
  };
}

