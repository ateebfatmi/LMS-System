export const organizationRoles = [
  "OWNER",
  "COACHING_ADMIN",
  "TEACHER",
  "STUDENT",
  "PARENT",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export type OrganizationId = string;
export type UserId = string;

export interface TenantContext {
  /** Existing Prepzii institutes.id value. */
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationRole;
}

// ==========================================
// Academic & Batch Contracts
// ==========================================

export type TargetExam = "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "BOARDS" | "OTHER";

export interface Campus {
  id: string;
  organizationId: OrganizationId;
  name: string;
  address?: Record<string, unknown>;
  createdAt: string;
}

export interface AcademicYear {
  id: string;
  organizationId: OrganizationId;
  name: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  organizationId: OrganizationId;
  name: string;
  code?: string;
  createdAt: string;
}

export interface Batch {
  id: string;
  organizationId: OrganizationId;
  campusId?: string;
  academicYearId?: string;
  name: string;
  targetExam: TargetExam;
  gradeLevel?: string;
  roomNumber?: string;
  studentCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface BatchMember {
  id: string;
  batchId: string;
  userId: UserId;
  name: string;
  email: string;
  phone?: string;
  role: "STUDENT" | "TEACHER";
  rollNumber?: string;
  enrolledAt: string;
}

// ==========================================
// Course & Learning Contracts
// ==========================================

export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Course {
  id: string;
  organizationId: OrganizationId;
  subjectId?: string;
  subjectName?: string;
  title: string;
  description?: string;
  status: ContentStatus;
  moduleCount: number;
  lessonCount: number;
  createdBy: UserId;
  createdAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  description?: string;
}

export type LessonKind = "VIDEO" | "DOCUMENT" | "DPP" | "LIVE_CLASS";

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  kind: LessonKind;
  contentUrl?: string;
  durationMinutes?: number;
  orderIndex: number;
  isPublished: boolean;
}

// ==========================================
// Assessment & Question Contracts
// ==========================================

export type QuestionKind = "single_choice" | "multiple_choice" | "numerical";

export interface QuestionDefinition {
  id: string;
  kind: QuestionKind;
  subject?: string;
  topic?: string;
  text?: string;
  options?: { id: string; text: string }[];
  correctOptionIds?: readonly string[];
  correctNumber?: number;
  numericalTolerance?: number;
  marks: number;
  negativeMarks?: number;
  partialMarking?: boolean;
}

export interface AnswerSubmission {
  questionId: string;
  selectedOptionIds?: readonly string[];
  number?: number;
  timeSpentSeconds?: number;
}

export interface GradedAnswer {
  questionId: string;
  status: "correct" | "incorrect" | "unanswered" | "partially_correct";
  score: number;
  timeSpentSeconds?: number;
}

export type TestPattern = "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "CUSTOM";

export interface InstituteTest {
  id: string;
  organizationId: OrganizationId;
  title: string;
  description?: string;
  pattern: TestPattern;
  totalMarks: number;
  durationMinutes: number;
  subject?: string;
  status: ContentStatus;
  questionCount: number;
  createdAt: string;
}

export interface TestSchedule {
  id: string;
  testId: string;
  testTitle?: string;
  batchId: string;
  batchName?: string;
  startsAt: string;
  endsAt: string;
  isStrictTiming: boolean;
  createdAt: string;
}

export interface TestResultSummary {
  attemptId: string;
  testId: string;
  studentId: UserId;
  studentName: string;
  batchName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  rank: number;
  percentile: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  submittedAt: string;
}

// ==========================================
// Attendance Contracts
// ==========================================

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceSession {
  id: string;
  organizationId: OrganizationId;
  batchId: string;
  batchName?: string;
  date: string;
  markedBy: UserId;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: UserId;
  studentName: string;
  rollNumber?: string;
  status: AttendanceStatus;
  remarks?: string;
}

// ==========================================
// Announcement Contracts
// ==========================================

export interface Announcement {
  id: string;
  organizationId: OrganizationId;
  title: string;
  content: string;
  targetAudience: "ALL" | "BATCH" | "FACULTY" | "PARENTS";
  batchId?: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  createdAt: string;
}

