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
  batchName?: string;
  priority: "NORMAL" | "HIGH" | "URGENT";
  category?: "ACADEMIC" | "EXAM" | "HOLIDAY" | "FEE" | "GENERAL";
  broadcastChannels?: ("PORTAL" | "WHATSAPP" | "SMS")[];
  createdAt: string;
}

// ==========================================
// Fee & Financial Contracts
// ==========================================

export type FeeInstallmentStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL";

export interface FeeInstallment {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  status: FeeInstallmentStatus;
  paidAmount: number;
  paidAt?: string;
  receiptNumber?: string;
}

export type FeePaymentMethod = "UPI" | "NET_BANKING" | "CARD" | "CHEQUE" | "CASH" | "DD";

export interface StudentFeeRecord {
  id: string;
  organizationId: OrganizationId;
  studentId: UserId;
  studentName: string;
  rollNumber: string;
  batchId: string;
  batchName: string;
  targetExam: TargetExam;
  totalCourseFee: number;
  concessionAmount: number;
  concessionReason?: string;
  netPayable: number;
  totalPaid: number;
  totalDue: number;
  status: "PAID" | "PARTIAL" | "OVERDUE" | "UNPAID";
  installments: FeeInstallment[];
  updatedAt: string;
}

export interface FeeTransaction {
  id: string;
  organizationId: OrganizationId;
  studentId: UserId;
  studentName: string;
  rollNumber: string;
  batchName: string;
  amount: number;
  method: FeePaymentMethod;
  referenceNumber: string;
  installmentTitle: string;
  receiptNumber: string;
  recordedBy: string;
  createdAt: string;
}

// ==========================================
// Campus & Smart Room Contracts
// ==========================================

export type RoomFacility = "SMART_BOARD" | "PROJECTOR" | "AC" | "LAB_BENCHES" | "CCTV" | "AUDIO_MIC";

export interface CampusRoom {
  id: string;
  organizationId: OrganizationId;
  campusId: string;
  campusName: string;
  name: string;
  capacity: number;
  currentBatch?: string;
  facilities: RoomFacility[];
  status: "IN_USE" | "AVAILABLE" | "MAINTENANCE";
}

export interface RoomSchedule {
  id: string;
  roomId: string;
  roomName: string;
  timeSlot: string;
  batchName: string;
  facultyName: string;
  subject: string;
}

// ==========================================
// Admissions CRM Contracts
// ==========================================

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "COUNSELLING_SCHEDULED"
  | "TRIAL_ATTENDED"
  | "CONVERTED"
  | "LOST";

export type LeadSource =
  | "WALK_IN"
  | "WEBSITE"
  | "REFERRAL"
  | "SOCIAL_MEDIA"
  | "NEWSPAPER"
  | "CAMPAIGN"
  | "OTHER";

export interface Lead {
  id: string;
  organizationId: OrganizationId;
  name: string;
  email?: string;
  phone: string;
  guardianName?: string;
  guardianPhone?: string;
  targetExam: TargetExam;
  targetBatchId?: string;
  targetBatchName?: string;
  source: LeadSource;
  assignedCounsellorId?: string;
  assignedCounsellorName?: string;
  stage: LeadStage;
  followUpDate?: string;
  estimatedFee?: number;
  notes?: string;
  convertedStudentId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Subscriptions & Platform Billing Contracts
// ==========================================

export type SubscriptionTier = "basic" | "growth" | "scale";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "SUSPENDED";

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  priceInr: number;
  billingInterval: "monthly" | "yearly";
  studentLimit: number;
  branchLimit: number;
  storageGb: number;
  aiCreditsPerMonth: number;
  features: string[];
  isActive: boolean;
}

export interface OrganizationSubscription {
  id: string;
  organizationId: OrganizationId;
  planId: SubscriptionTier;
  planName: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  studentLimit: number;
  activeStudentCount: number;
  cancelAtPeriodEnd: boolean;
}

// ==========================================
// Platform Super-Admin & Public Lead Contracts
// ==========================================

export interface PlatformInstituteSummary {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  planId: SubscriptionTier;
  activeStudents: number;
  activeBatches: number;
  createdAt: string;
}

export interface DemoRequest {
  id?: string;
  fullName: string;
  instituteName: string;
  email: string;
  phone: string;
  city: string;
  studentCount: string;
  interestedPlan?: string;
  notes?: string;
  status?: "PENDING" | "CONTACTED" | "DEMO_GIVEN" | "ONBOARDED" | "REJECTED";
  createdAt?: string;
}
