export type RiskLevel = "LOW" | "WATCH" | "HIGH" | "CRITICAL";

export type StudentSuccessSignals = {
  attendancePercentage: number | null;
  assessmentAverage: number | null;
  assignmentCompletion: number | null;
  daysSinceLastActivity: number | null;
};

export type RiskReason = {
  code: "LOW_ATTENDANCE" | "LOW_ASSESSMENT" | "MISSED_ASSIGNMENTS" | "INACTIVE";
  label: string;
  contribution: number;
};

export type StudentRisk = {
  score: number;
  level: RiskLevel;
  reasons: RiskReason[];
};

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * A transparent, deterministic prioritisation score. It is deliberately not a
 * diagnosis or an automated decision: staff review the signals before creating
 * an intervention. Missing evidence never increases a student's score.
 */
export function calculateStudentRisk(signals: StudentSuccessSignals): StudentRisk {
  const reasons: RiskReason[] = [];

  if (signals.attendancePercentage !== null) {
    const attendance = clampPercentage(signals.attendancePercentage);
    const contribution = Math.round(Math.max(0, 75 - attendance) / 75 * 35);
    if (contribution > 0) reasons.push({ code: "LOW_ATTENDANCE", label: `${attendance}% attendance`, contribution });
  }

  if (signals.assessmentAverage !== null) {
    const average = clampPercentage(signals.assessmentAverage);
    const contribution = Math.round(Math.max(0, 60 - average) / 60 * 30);
    if (contribution > 0) reasons.push({ code: "LOW_ASSESSMENT", label: `${average}% assessment average`, contribution });
  }

  if (signals.assignmentCompletion !== null) {
    const completion = clampPercentage(signals.assignmentCompletion);
    const contribution = Math.round(Math.max(0, 80 - completion) / 80 * 25);
    if (contribution > 0) reasons.push({ code: "MISSED_ASSIGNMENTS", label: `${completion}% assignment completion`, contribution });
  }

  if (signals.daysSinceLastActivity !== null && Number.isFinite(signals.daysSinceLastActivity)) {
    const days = Math.max(0, Math.floor(signals.daysSinceLastActivity));
    const contribution = days <= 7 ? 0 : Math.min(10, Math.ceil((days - 7) / 3));
    if (contribution > 0) reasons.push({ code: "INACTIVE", label: `${days} days since recorded activity`, contribution });
  }

  const score = Math.min(100, reasons.reduce((sum, reason) => sum + reason.contribution, 0));
  const level: RiskLevel = score >= 70 ? "CRITICAL" : score >= 45 ? "HIGH" : score >= 20 ? "WATCH" : "LOW";
  return { score, level, reasons: reasons.sort((a, b) => b.contribution - a.contribution) };
}

export function recommendedActions(risk: StudentRisk): string[] {
  const actions = new Set<string>();
  for (const reason of risk.reasons) {
    if (reason.code === "LOW_ATTENDANCE") actions.add("Schedule an attendance check-in with the student and guardian.");
    if (reason.code === "LOW_ASSESSMENT") actions.add("Assign a topic-level diagnostic and focused revision plan.");
    if (reason.code === "MISSED_ASSIGNMENTS") actions.add("Review workload and agree the next two submission deadlines.");
    if (reason.code === "INACTIVE") actions.add("Confirm access, wellbeing, and the next live-class commitment.");
  }
  if (risk.level === "LOW") actions.add("Continue routine monitoring; no intervention is required.");
  return [...actions];
}
