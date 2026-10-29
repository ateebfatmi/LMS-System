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

/**
 * Calculates scores for scanned OMR answers compared to answer key
 */
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
      // Multiple marks on single choice is penalized as incorrect in OMR
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
