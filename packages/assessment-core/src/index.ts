import type {
  AnswerSubmission,
  GradedAnswer,
  OrganizationRole,
  QuestionBankItem,
  QuestionDefinition,
  QuestionDifficulty,
  QuestionKind,
  QuestionOption,
  TargetExam,
} from "@prepzii/contracts";

export type LegacyPrepziiQuestionRow = {
  id: string;
  exam?: string | null;
  subject?: string | null;
  topic?: string | null;
  question_type?: string | null;
  question_text?: string | null;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  correct_option?: string | null;
  marks?: number | null;
  negative_marks?: number | string | null;
};

export function adaptPrepziiQuestion(row: LegacyPrepziiQuestionRow): QuestionDefinition {
  const rawType = String(row.question_type ?? "MCQ").trim().toLowerCase();
  const kind: QuestionDefinition["kind"] = rawType.includes("numerical")
    ? "numerical"
    : rawType.includes("multiple")
      ? "multiple_choice"
      : "single_choice";
  const optionIds = String(row.correct_option ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => ["A", "B", "C", "D"].includes(value));
  const correctNumber = Number(row.correct_option);
  const optionValue = (id: "A" | "B" | "C" | "D") => row[`option_${id.toLowerCase()}` as "option_a" | "option_b" | "option_c" | "option_d"];
  return {
    id: row.id,
    kind,
    subject: row.subject ?? undefined,
    topic: row.topic ?? undefined,
    text: row.question_text ?? undefined,
    options: kind === "numerical" ? undefined : (["A", "B", "C", "D"] as const)
      .map((id) => ({ id, text: String(optionValue(id) ?? "") }))
      .filter((option) => option.text),
    correctOptionIds: kind === "numerical" ? undefined : optionIds,
    correctNumber: kind === "numerical" && Number.isFinite(correctNumber) ? correctNumber : undefined,
    numericalTolerance: kind === "numerical" ? 1e-9 : undefined,
    marks: Number(row.marks) > 0 ? Number(row.marks) : 4,
    negativeMarks: Math.abs(Number(row.negative_marks) || 0),
    partialMarking: kind === "multiple_choice" && String(row.exam ?? "").toUpperCase().includes("ADVANCED"),
  };
}

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
    let isCorrect = false;
    if (answer.number !== undefined) {
      if (question.numericalMin !== undefined && question.numericalMax !== undefined) {
        // Explicit minimum and maximum range check: preserves actual bounds without midpoint approximation
        isCorrect = answer.number >= question.numericalMin && answer.number <= question.numericalMax;
      } else if (question.correctNumber !== undefined) {
        const tolerance = question.numericalTolerance ?? 0;
        isCorrect = Math.abs(answer.number - question.correctNumber) <= tolerance;
      }
    }

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

  throw new Error(
    `Unsupported question kind '${(question as any).kind}' for question '${question.id}'. Supported question kinds are single_choice, multiple_choice, numerical.`
  );
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

/**
 * Exact representation of consumer Prepzii `public.questions` row.
 */
export interface PrepziiQuestionRow {
  id: string; // uuid NOT NULL
  exam: string; // text NOT NULL
  subject: string; // text NOT NULL
  chapter: string; // text NOT NULL
  topic?: string | null;
  difficulty: string; // text NOT NULL
  question_type?: string | null; // text
  question_text: string; // text NOT NULL
  question_image?: string | null; // text
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  option_a_image?: string | null;
  option_b_image?: string | null;
  option_c_image?: string | null;
  option_d_image?: string | null;
  correct_option: string; // text NOT NULL
  explanation?: string | null; // text
  explanation_image?: string | null; // text
  marks?: number | null; // integer
  negative_marks?: number | string | null; // numeric
  is_active?: boolean | null;
  question_order?: number | null;
  source_type: string; // text NOT NULL
  status: string; // text NOT NULL
  question_content?: Record<string, unknown> | null; // jsonb
  explanation_content?: Record<string, unknown> | null; // jsonb
}

/**
 * Exact representation of consumer Prepzii `public.pyq_questions` row.
 */
export interface PrepziiPyqRow {
  id: string; // uuid NOT NULL
  question?: string | null;
  question_text?: string | null;
  question_image?: string | null;
  option_a?: string | null;
  option_b?: string | null;
  option_c?: string | null;
  option_d?: string | null;
  option_a_image?: string | null;
  option_b_image?: string | null;
  option_c_image?: string | null;
  option_d_image?: string | null;
  correct_option?: string | null;
  correct_options?: string[] | string | null;
  numerical_answer?: number | string | null;
  numerical_min?: number | string | null;
  numerical_max?: number | string | null;
  marks_positive?: number | string | null;
  marks_negative?: number | string | null;
  question_content?: Record<string, unknown> | null;
  explanation_content?: Record<string, unknown> | null;
  exam: string;
  exam_type?: string | null;
  subject: string;
  chapter: string;
  topic?: string | null;
  year?: number | string | null;
  difficulty?: string | null;
  status?: string | null;
  exam_id?: string | null;
  paper_code?: string | null;
  question_number?: number | string | null;
  display_order?: number | null;
}

/**
 * Normalizes user/member role string to standard B2B OrganizationRole.
 */
export function normalizeOrganizationRole(role?: string | null): OrganizationRole {
  if (!role) return "STUDENT";
  const r = role.trim().toUpperCase();
  if (r === "ACADEMIC_COORDINATOR" || r === "ACCOUNTANT" || r === "PLATFORM_SUPER_ADMIN") return r;

  if (r === "OWNER" || r === "DIRECTOR" || r === "INSTITUTE_OWNER") {
    return "OWNER";
  }
  if (r === "ADMIN" || r === "COACHING_ADMIN" || r === "PRINCIPAL" || r === "MANAGER") {
    return "COACHING_ADMIN";
  }
  if (r === "TEACHER" || r === "FACULTY" || r === "INSTRUCTOR" || r === "EDUCATOR") {
    return "TEACHER";
  }
  if (r === "PARENT" || r === "GUARDIAN") {
    return "PARENT";
  }
  if (r === "STUDENT" || r === "LEARNER" || r === "CANDIDATE") {
    return "STUDENT";
  }

  // Safe fallback
  return "STUDENT";
}

/**
 * Normalizes exam string to TargetExam union.
 */
export function normalizeTargetExam(examStr?: string | null): TargetExam {
  if (!examStr) return "OTHER";
  const normalized = examStr.trim().toUpperCase();

  if (normalized.includes("ADVANCED") || normalized.includes("ADV")) {
    return "JEE_ADVANCED";
  }
  if (normalized.includes("JEE") || normalized.includes("MAINS") || normalized.includes("MAIN")) {
    return "JEE_MAIN";
  }
  if (normalized.includes("NEET")) {
    return "NEET";
  }
  if (normalized.includes("FOUNDATION") || normalized.includes("NTSE") || normalized.includes("OLYMPIAD")) {
    return "FOUNDATION";
  }
  if (normalized.includes("BOARD") || normalized.includes("CBSE") || normalized.includes("ICSE")) {
    return "BOARDS";
  }
  return "OTHER";
}

/**
 * Normalizes difficulty string to QuestionDifficulty union.
 */
export function normalizeQuestionDifficulty(diffStr?: string | null): QuestionDifficulty {
  if (!diffStr) return "MEDIUM";
  const d = diffStr.trim().toUpperCase();
  if (d === "EASY") return "EASY";
  if (d === "MEDIUM" || d === "MODERATE") return "MEDIUM";
  if (d === "HARD") return "HARD";
  if (d === "ADVANCED" || d === "EXPERT") return "ADVANCED";
  return "MEDIUM";
}

/**
 * Builds standard 4-option array from column-based database records.
 */
export function extractQuestionOptions(
  optionA?: string | null,
  optionB?: string | null,
  optionC?: string | null,
  optionD?: string | null,
  optionAImage?: string | null,
  optionBImage?: string | null,
  optionCImage?: string | null,
  optionDImage?: string | null,
): QuestionOption[] | undefined {
  const options: QuestionOption[] = [];

  if (optionA !== null && optionA !== undefined || optionAImage) {
    options.push({
      id: "a",
      text: optionA ?? "",
      imageUrl: optionAImage || undefined,
    });
  }
  if (optionB !== null && optionB !== undefined || optionBImage) {
    options.push({
      id: "b",
      text: optionB ?? "",
      imageUrl: optionBImage || undefined,
    });
  }
  if (optionC !== null && optionC !== undefined || optionCImage) {
    options.push({
      id: "c",
      text: optionC ?? "",
      imageUrl: optionCImage || undefined,
    });
  }
  if (optionD !== null && optionD !== undefined || optionDImage) {
    options.push({
      id: "d",
      text: optionD ?? "",
      imageUrl: optionDImage || undefined,
    });
  }

  return options.length > 0 ? options : undefined;
}

/**
 * Parses correct option identifiers case-insensitively.
 */
export function parseCorrectOptionIds(val?: string[] | string | null): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const str = String(val).trim();
  if (!str) return [];

  // Check if string is a JSON array e.g. '["a", "b"]'
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // ignore json error, proceed to delimiter parsing
    }
  }

  return str
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Infers QuestionKind for a standard questions row.
 */
export function inferQuestionKind(typeStr?: string | null, correctOptionStr?: string | null, hasOptions: boolean = true): QuestionKind {
  if (typeStr) {
    const t = typeStr.toLowerCase();
    if (t.includes("num") || t.includes("int") || t.includes("decimal")) {
      return "numerical";
    }
    if (t.includes("multi") || t.includes("msq") || t.includes("more_than_one")) {
      return "multiple_choice";
    }
    if (t.includes("single") || t.includes("scq") || t.includes("mcq")) {
      return "single_choice";
    }
  }

  if (!hasOptions) {
    return "numerical";
  }

  const ids = parseCorrectOptionIds(correctOptionStr);
  if (ids.length > 1) {
    return "multiple_choice";
  }

  return "single_choice";
}

/**
 * Adapts actual `public.questions` row into a contracts `QuestionBankItem`.
 */
export function adaptPrepziiQuestionToBankItem(row: PrepziiQuestionRow): QuestionBankItem {
  const options = extractQuestionOptions(
    row.option_a,
    row.option_b,
    row.option_c,
    row.option_d,
    row.option_a_image,
    row.option_b_image,
    row.option_c_image,
    row.option_d_image,
  );

  const kind = inferQuestionKind(row.question_type, row.correct_option, Boolean(options && options.length > 0));
  const targetExam = normalizeTargetExam(row.exam);
  const difficulty = normalizeQuestionDifficulty(row.difficulty);
  const marks = row.marks ? Number(row.marks) : 4;
  const negativeMarks = row.negative_marks !== null && row.negative_marks !== undefined ? Math.abs(Number(row.negative_marks)) : 1;
  const isPyq = row.source_type ? row.source_type.toUpperCase() === "PYQ" : false;

  return {
    id: row.id,
    kind,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic || row.chapter,
    difficulty,
    targetExam,
    isPyq,
    text: row.question_text,
    imageUrl: row.question_image || undefined,
    options,
    marks,
    negativeMarks,
    partialMarking: kind === "multiple_choice" && targetExam === "JEE_ADVANCED",
    solutionExplanation: row.explanation || undefined,
    explanationImageUrl: row.explanation_image || undefined,
    questionContent: row.question_content || undefined,
    explanationContent: row.explanation_content || undefined,
    sourceType: row.source_type,
    status: row.status,
  };
}

/**
 * Adapts actual `public.questions` row into a `QuestionDefinition`.
 * If `authoritative` is false (or default), answer keys and explanations are omitted.
 */
export function adaptPrepziiQuestionToDefinition(
  row: PrepziiQuestionRow,
  authoritative: boolean = false,
): QuestionDefinition {
  const options = extractQuestionOptions(
    row.option_a,
    row.option_b,
    row.option_c,
    row.option_d,
    row.option_a_image,
    row.option_b_image,
    row.option_c_image,
    row.option_d_image,
  );

  const kind = inferQuestionKind(row.question_type, row.correct_option, Boolean(options && options.length > 0));
  const targetExam = normalizeTargetExam(row.exam);
  const marks = row.marks ? Number(row.marks) : 4;
  const negativeMarks = row.negative_marks !== null && row.negative_marks !== undefined ? Math.abs(Number(row.negative_marks)) : 1;
  const partialMarking = kind === "multiple_choice" && targetExam === "JEE_ADVANCED";

  const def: QuestionDefinition = {
    id: row.id,
    kind,
    subject: row.subject,
    topic: row.topic || row.chapter,
    text: row.question_text,
    imageUrl: row.question_image || undefined,
    options,
    marks,
    negativeMarks,
    partialMarking,
    questionContent: sanitizeQuestionContentJson(row.question_content),
  };

  if (authoritative) {
    if (kind === "numerical") {
      const numVal = parseFloat(row.correct_option);
      if (!isNaN(numVal)) {
        def.correctNumber = numVal;
        def.numericalTolerance = 0.01;
      }
    } else {
      def.correctOptionIds = parseCorrectOptionIds(row.correct_option);
    }
  }

  return def;
}

/**
 * Adapts actual `public.pyq_questions` row into a contracts `QuestionBankItem`.
 */
export function adaptPrepziiPyqToBankItem(row: PrepziiPyqRow): QuestionBankItem {
  const options = extractQuestionOptions(
    row.option_a,
    row.option_b,
    row.option_c,
    row.option_d,
    row.option_a_image,
    row.option_b_image,
    row.option_c_image,
    row.option_d_image,
  );

  let kind: QuestionKind = "single_choice";
  if (
    row.numerical_answer !== null && row.numerical_answer !== undefined ||
    row.numerical_min !== null && row.numerical_min !== undefined ||
    row.numerical_max !== null && row.numerical_max !== undefined
  ) {
    kind = "numerical";
  } else {
    const multiIds = parseCorrectOptionIds(row.correct_options || row.correct_option);
    if (multiIds.length > 1) {
      kind = "multiple_choice";
    }
  }

  const targetExam = normalizeTargetExam(row.exam || row.exam_type);
  const difficulty = normalizeQuestionDifficulty(row.difficulty);
  const marks = row.marks_positive ? Number(row.marks_positive) : 4;
  const negativeMarks = row.marks_negative !== null && row.marks_negative !== undefined ? Math.abs(Number(row.marks_negative)) : 1;
  const pyqYear = row.year ? Number(row.year) : undefined;
  const qText = row.question || row.question_text || "";

  return {
    id: row.id,
    kind,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic || row.chapter,
    difficulty,
    targetExam,
    isPyq: true,
    pyqYear,
    text: qText,
    imageUrl: row.question_image || undefined,
    options,
    marks,
    negativeMarks,
    partialMarking: kind === "multiple_choice" && targetExam === "JEE_ADVANCED",
    numericalMin: row.numerical_min !== null && row.numerical_min !== undefined ? Number(row.numerical_min) : undefined,
    numericalMax: row.numerical_max !== null && row.numerical_max !== undefined ? Number(row.numerical_max) : undefined,
    numericalAnswer: row.numerical_answer !== null && row.numerical_answer !== undefined ? Number(row.numerical_answer) : undefined,
    solutionExplanation: undefined,
    questionContent: row.question_content || undefined,
    explanationContent: row.explanation_content || undefined,
    paperCode: row.paper_code || undefined,
    questionNumber: row.question_number ? Number(row.question_number) : undefined,
    sourceType: "PYQ",
    status: row.status || "ACTIVE",
  };
}

/**
 * Adapts actual `public.pyq_questions` row into a `QuestionDefinition`.
 * If `authoritative` is false (or default), answer keys and solutions are omitted.
 */
export function adaptPrepziiPyqToDefinition(
  row: PrepziiPyqRow,
  authoritative: boolean = false,
): QuestionDefinition {
  const options = extractQuestionOptions(
    row.option_a,
    row.option_b,
    row.option_c,
    row.option_d,
    row.option_a_image,
    row.option_b_image,
    row.option_c_image,
    row.option_d_image,
  );

  let kind: QuestionKind = "single_choice";
  if (
    row.numerical_answer !== null && row.numerical_answer !== undefined ||
    row.numerical_min !== null && row.numerical_min !== undefined ||
    row.numerical_max !== null && row.numerical_max !== undefined
  ) {
    kind = "numerical";
  } else {
    const multiIds = parseCorrectOptionIds(row.correct_options || row.correct_option);
    if (multiIds.length > 1) {
      kind = "multiple_choice";
    }
  }

  const targetExam = normalizeTargetExam(row.exam || row.exam_type);
  const marks = row.marks_positive ? Number(row.marks_positive) : 4;
  const negativeMarks = row.marks_negative !== null && row.marks_negative !== undefined ? Math.abs(Number(row.marks_negative)) : 1;
  const qText = row.question || row.question_text || "";

  const def: QuestionDefinition = {
    id: row.id,
    kind,
    subject: row.subject,
    topic: row.topic || row.chapter,
    text: qText,
    imageUrl: row.question_image || undefined,
    options,
    marks,
    negativeMarks,
    partialMarking: kind === "multiple_choice" && targetExam === "JEE_ADVANCED",
    questionContent: sanitizeQuestionContentJson(row.question_content),
  };

  if (authoritative) {
    if (kind === "numerical") {
      const min = row.numerical_min !== null && row.numerical_min !== undefined ? Number(row.numerical_min) : undefined;
      const max = row.numerical_max !== null && row.numerical_max !== undefined ? Number(row.numerical_max) : undefined;
      const rawAns = row.numerical_answer !== null && row.numerical_answer !== undefined ? Number(row.numerical_answer) : undefined;

      if (min !== undefined && max !== undefined && max >= min) {
        // Explicit minimum and maximum bounds preserved
        def.numericalMin = min;
        def.numericalMax = max;
        def.correctNumber = rawAns !== undefined && !isNaN(rawAns) ? rawAns : (min + max) / 2;
      } else if (rawAns !== undefined && !isNaN(rawAns)) {
        def.correctNumber = rawAns;
        def.numericalTolerance = 0.01;
      }
    } else {
      const correctList = parseCorrectOptionIds(row.correct_options || row.correct_option);
      def.correctOptionIds = correctList;
    }
  }

  return def;
}

/**
 * Sanitizes rich JSON content for students by removing any leaked answer or solution keys.
 */
function sanitizeQuestionContentJson(content?: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!content || typeof content !== "object") return undefined;
  const sanitized: Record<string, unknown> = {};

  const forbiddenKeys = new Set(["answer", "correct", "solution", "explanation", "key", "answer_key", "hints"]);

  for (const [key, value] of Object.entries(content)) {
    if (!forbiddenKeys.has(key.toLowerCase())) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Strips correct answers, explanations, solutions, and marking secrets
 * to produce candidate-safe question payloads for active CBT sessions.
 */
export function sanitizeQuestionForCandidate(q: QuestionDefinition | QuestionBankItem): QuestionDefinition {
  return {
    id: q.id,
    kind: q.kind,
    subject: q.subject,
    topic: q.topic,
    text: q.text,
    imageUrl: q.imageUrl,
    options: q.options?.map((opt) => ({
      id: opt.id,
      text: opt.text,
      imageUrl: opt.imageUrl,
    })),
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    partialMarking: q.partialMarking,
    questionContent: sanitizeQuestionContentJson(q.questionContent as Record<string, unknown>),
    correctOptionIds: undefined,
    correctNumber: undefined,
    numericalTolerance: undefined,
    numericalMin: undefined,
    numericalMax: undefined,
  };
}

/**
 * Bridges a `PrepziiPyqRow` into a schema-compatible `PrepziiQuestionRow`
 * for instances where an assessment requires referencing the PYQ in `public.questions`.
 */
export function bridgePyqToQuestionPayload(pyq: PrepziiPyqRow): PrepziiQuestionRow {
  let correctOption = "";
  if (pyq.numerical_answer !== null && pyq.numerical_answer !== undefined) {
    correctOption = String(pyq.numerical_answer);
  } else if (pyq.correct_options) {
    correctOption = parseCorrectOptionIds(pyq.correct_options).join(",");
  } else if (pyq.correct_option) {
    correctOption = pyq.correct_option.trim().toLowerCase();
  }

  return {
    id: pyq.id,
    exam: pyq.exam,
    subject: pyq.subject,
    chapter: pyq.chapter,
    topic: pyq.topic || pyq.chapter,
    difficulty: pyq.difficulty || "MEDIUM",
    question_type: pyq.numerical_answer !== null && pyq.numerical_answer !== undefined ? "numerical" : "single_choice",
    question_text: pyq.question || pyq.question_text || "",
    question_image: pyq.question_image || null,
    option_a: pyq.option_a || null,
    option_b: pyq.option_b || null,
    option_c: pyq.option_c || null,
    option_d: pyq.option_d || null,
    option_a_image: pyq.option_a_image || null,
    option_b_image: pyq.option_b_image || null,
    option_c_image: pyq.option_c_image || null,
    option_d_image: pyq.option_d_image || null,
    correct_option: correctOption,
    explanation: null,
    explanation_image: null,
    marks: pyq.marks_positive ? Number(pyq.marks_positive) : 4,
    negative_marks: pyq.marks_negative !== null && pyq.marks_negative !== undefined ? Number(pyq.marks_negative) : 1,
    is_active: pyq.status !== "INACTIVE",
    question_order: pyq.display_order ?? null,
    source_type: "PYQ",
    status: pyq.status || "ACTIVE",
    question_content: pyq.question_content || null,
    explanation_content: pyq.explanation_content || null,
  };
}

export interface OMRQuestionConfig {
  number: number;
  options: ("A" | "B" | "C" | "D")[];
}

export interface OMRSheetConfig {
  testId?: string;
  testTitle: string;
  instituteName: string;
  totalQuestions: number;
  examType: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "CUSTOM";
  rollNumberDigits: number;
  negativeMarking: number;
  marksPerQuestion: number;
  layoutColumns: 2 | 3 | 4;
}

export interface ScannedBubbleAnswer {
  questionNumber: number;
  selectedOption: "A" | "B" | "C" | "D" | "MULTIPLE" | "BLANK";
  confidence: number;
}

export interface OMRScanResult {
  testId?: string;
  testTitle?: string;
  rollNumber?: string;
  scannedAt: string;
  totalQuestions: number;
  answeredCount: number;
  blankCount: number;
  multipleCount: number;
  answers: ScannedBubbleAnswer[];
  evaluation?: {
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    score: number;
    maxScore: number;
    percentage: number;
  };
}

export function evaluateOMRSubmission(
  scannedAnswers: ScannedBubbleAnswer[],
  answerKey: Record<number, "A" | "B" | "C" | "D">,
  marksPerCorrect: number = 4,
  negativeMarks: number = 1
) {
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  for (const item of scannedAnswers) {
    const key = answerKey[item.questionNumber];
    if (!key) continue;

    if (item.selectedOption === "BLANK") {
      unattemptedCount++;
    } else if (item.selectedOption === "MULTIPLE") {
      incorrectCount++;
    } else if (item.selectedOption === key) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  const score = correctCount * marksPerCorrect - incorrectCount * negativeMarks;
  const maxScore = Object.keys(answerKey).length * marksPerCorrect;
  const percentage = maxScore > 0 ? Math.round((Math.max(0, score) / maxScore) * 100) : 0;

  return {
    correctCount,
    incorrectCount,
    unattemptedCount,
    score,
    maxScore,
    percentage,
  };
}

