export const organizationRoles = [
  "owner",
  "admin",
  "teacher",
  "student",
  "parent",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export type OrganizationId = string;
export type UserId = string;

export interface TenantContext {
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationRole;
}

export type QuestionKind = "single_choice" | "multiple_choice" | "numerical";

export interface QuestionDefinition {
  id: string;
  kind: QuestionKind;
  correctOptionIds?: readonly string[];
  correctNumber?: number;
  numericalTolerance?: number;
  marks: number;
  negativeMarks?: number;
}

export interface AnswerSubmission {
  questionId: string;
  selectedOptionIds?: readonly string[];
  number?: number;
}

export interface GradedAnswer {
  questionId: string;
  status: "correct" | "incorrect" | "unanswered";
  score: number;
}

