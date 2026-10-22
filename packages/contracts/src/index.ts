export const organizationRoles = [
  "PLATFORM_SUPER_ADMIN",
  "OWNER",
  "COACHING_ADMIN",
  "ACADEMIC_COORDINATOR",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export type OrganizationId = string;
export type UserId = string;

export interface TenantContext {
  /** Existing Prepzii institutes.id value. */
  organizationId: OrganizationId;
  userId: UserId;
  role: OrganizationRole;

  organizationName?: string;
  /** Existing Prepzii institute_members.id primary key (UUID). */
  memberId?: string;
}

export interface OrganizationMemberDirectoryRecord {
  id: string;
  userId: string | null;
  email: string;
  role: OrganizationRole;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED";
  displayName: string;
  phone: string | null;
  alternatePhone: string | null;
  rollNumber: string | null;
  employeeCode: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  qualification: string | null;
  subjectSpecialization: string | null;
  joinedOn: string | null;
  batches: { id: string; name: string; targetExam: string }[];
  createdAt: string;
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
  options?: QuestionOption[];
  correctOptionIds?: readonly string[];
  correctNumber?: number;
  numericalTolerance?: number;
  marks: number;
  negativeMarks?: number;
  partialMarking?: boolean;

  imageUrl?: string;
  numericalMin?: number;
  numericalMax?: number;
  questionContent?: unknown;
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

export type FeePaymentMethod = "UPI" | "NET_BANKING" | "CARD" | "CHEQUE" | "CASH" | "DD" | "NEFT_RTGS" | "ONLINE";

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

export type LeadSource =  | "WALK_IN" | "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "NEWSPAPER" | "CAMPAIGN" | "OTHER" | "PHONE_ENQUIRY" | "STUDENT_REFERRAL" | "SEMINAR" | "NEWSPAPER_AD";

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



export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}


// ==========================================
// Shared Prepzii Content & Question Bank Contracts
// ==========================================

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD" | "ADVANCED";


export interface QuestionFilterCriteria {
  targetExam?: TargetExam;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  isPyq?: boolean;
  pyqYear?: number;
  kind?: QuestionKind;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}


export interface QuestionBankItem {
  id: string;
  kind: QuestionKind;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: QuestionDifficulty;
  targetExam: TargetExam;
  isPyq: boolean;
  pyqYear?: number;
  text: string;
  imageUrl?: string;
  options?: QuestionOption[];
  marks: number;
  negativeMarks: number;
  partialMarking?: boolean;
  numericalMin?: number;
  numericalMax?: number;
  numericalAnswer?: number;
  solutionExplanation?: string;
  explanationImageUrl?: string;
  questionContent?: unknown;
  explanationContent?: unknown;
  isInstituteOwned?: boolean;
  organizationId?: OrganizationId;
  paperCode?: string;
  questionNumber?: number;
  sourceType?: string;
  status?: string;
}


export interface ChapterClassification {
  subject: string;
  chapter: string;
  topics: string[];
  totalQuestions: number;
  pyqCount: number;
}


// ==========================================
// CBT Real-Time Session & Attempt Contracts
// ==========================================

export type CbtSessionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "SUBMITTED"
  | "AUTO_SUBMITTED"
  | "EVALUATED";


export interface CbtSessionState {
  attemptId: string;
  scheduleId: string;
  testId: string;
  studentId: UserId;
  status: CbtSessionStatus;
  startedAt: string;
  expiresAt: string;
  durationMinutes: number;
  remainingSeconds: number;
  answers: Record<string, AnswerSubmission>;
  markedForReview: readonly string[];
  visitedQuestionIds: readonly string[];
  lastAutosavedAt?: string;
}


export interface CbtAutosavePayload {
  attemptId: string;
  questionId: string;
  answer?: AnswerSubmission;
  timeSpentSeconds: number;
  markedForReview?: boolean;
}


export interface CbtSubmissionReceipt {
  attemptId: string;
  testId: string;
  studentId: UserId;
  status: "SUBMITTED" | "AUTO_SUBMITTED";
  submittedAt: string;
  totalAnswered: number;
  totalUnanswered: number;
}


export interface QuestionReviewDetail {
  question: QuestionDefinition & {
    text?: string;
    options?: QuestionOption[];
    solutionExplanation?: string;
  };
  submittedAnswer?: AnswerSubmission;
  graded: GradedAnswer;
}


export interface ComprehensiveTestReview {
  summary: TestResultSummary;
  subjectBreakdown: Record<
    string,
    { score: number; maxScore: number; accuracy: number; timeSpentSeconds: number }
  >;
  questionReviews: QuestionReviewDetail[];
  authorizedForReview: boolean;
  reviewAvailableAt?: string;
}


// ==========================================
// Parent-to-Student Link Contracts
// ==========================================

export interface ParentStudentRelation {
  id: string;
  organizationId: OrganizationId;
  parentUserId: UserId;
  studentUserId: UserId;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  studentName: string;
  rollNumber: string;
  batchId: string;
  batchName: string;
  isVerified: boolean;
  linkedAt: string;
}


// ==========================================
// Notification & Delivery Verification Contracts
// ==========================================

export type NotificationChannel = "WHATSAPP" | "SMS";

export type NotificationDeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";


export interface NotificationDispatchLog {
  id: string;
  organizationId: OrganizationId;
  batchId?: string;
  recipientPhone: string;
  recipientName: string;
  recipientRole: "PARENT" | "STUDENT" | "FACULTY";
  channel: NotificationChannel;
  templateKey: "ABSENT_ALERT" | "LATE_WARNING" | "TEST_SCORE_CARD" | "INSTITUTE_NOTICE";
  renderedContent: string;
  status: NotificationDeliveryStatus;
  provider: "GUPSHUP" | "FAST2SMS" | "TWILIO" | "INTERNAL_MOCK";
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  createdAt: string;
}


// ==========================================
// Administrative Audit Log Contracts
// ==========================================

export type AuditEventType =
  | "BATCH_CREATED"
  | "BATCH_UPDATED"
  | "STUDENT_ENROLLED"
  | "STUDENT_ALLOCATED"
  | "TEST_SCHEDULED"
  | "ATTENDANCE_SUBMITTED"
  | "PARENT_ALERT_DISPATCHED"
  | "RESULT_PUBLISHED"
  | "ROLE_INVITATION_SENT";


export interface OrganizationAuditLog {
  id: string;
  organizationId: OrganizationId;
  actorUserId: UserId;
  actorRole: OrganizationRole;
  eventType: AuditEventType;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}


// ==========================================
// Academic Progress & Mastery Contracts
// ==========================================

export interface ChapterMasteryProgress {
  subject: string;
  chapter: string;
  accuracyPercentage: number;
  status: "STRONG" | "MODERATE" | "NEEDS_FOCUS";
}


export interface StudentAcademicProgressReport {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  instituteName: string;
  attendancePercentage: number;
  totalPresent: number;
  totalAbsent: number;
  overallAverageScore: number;
  overallPercentile: number;
  projectedRankAIR: number;
  subjectPerformance: Record<string, { averageScore: number; testsCount: number }>;
  chapterMasteries: ChapterMasteryProgress[];
  publishedTestResults: TestResultSummary[];
  generatedAt: string;
}


// ==========================================
// Institute Onboarding & Setup Contracts
// ==========================================

export interface InstituteSetupChecklist {
  profileConfigured: boolean;
  campusAdded: boolean;
  academicYearSet: boolean;
  programsConfigured: boolean;
  firstBatchCreated: boolean;
  teacherInvited: boolean;
  studentsEnrolled: boolean;
  overallCompletedPercentage: number;
}


export interface BulkStudentImportRow {
  name: string;
  phone: string;
  email?: string;
  rollNumber: string;
  batchName: string;
  targetExam: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "BOARDS";
  parentName?: string;
  parentPhone?: string;
}


export interface BulkImportResult {
  totalProcessed: number;
  successfulCount: number;
  duplicateCount: number;
  failedCount: number;
  duplicates: Array<{ rollNumber: string; phone: string; reason: string }>;
  enrolledStudents: Array<{ id: string; name: string; rollNumber: string; batchId: string }>;
}

export type StudentFeeStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WAIVED";

export type InstallmentStatus = "DUE" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "WAIVED";


export interface FeePlan {
  id: string;
  organizationId: OrganizationId;
  name: string;
  targetExam: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "BOARDS";
  totalAmountPaise: number; // e.g. 12000000 = Rs. 1,20,000.00
  defaultInstallments: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}


export interface FeeInstallmentItem {
  id: string;
  studentFeeId: string;
  installmentNumber: number;
  dueDate: string;
  amountPaise: number;
  paidAmountPaise: number;
  status: InstallmentStatus;
}


export interface StudentFeeLedger {
  id: string;
  organizationId: OrganizationId;
  studentId: UserId;
  studentName: string;
  rollNumber: string;
  batchName: string;
  feePlanId: string;
  feePlanName: string;
  baseAmountPaise: number;
  discountAmountPaise: number;
  discountReason?: string;
  finalAmountPaise: number;
  totalPaidPaise: number;
  outstandingBalancePaise: number;
  status: StudentFeeStatus;
  installments: FeeInstallmentItem[];
  payments: FeeReceiptSummary[];
  assignedAt: string;
}


export interface FeeReceiptSummary {
  id: string;
  receiptNumber: string;
  studentFeeId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  amountPaise: number;
  paymentMethod: FeePaymentMethod;
  referenceNumber?: string;
  collectedBy: string;
  notes?: string;
  paidAt: string;
}


export type EnquiryStatus =
  | "NEW"
  | "CONTACTED"
  | "COUNSELED"
  | "DEMO_ATTENDED"
  | "OFFER_EXTENDED"
  | "ENROLLED"
  | "LOST";


export interface AdmissionsFollowupRecord {
  id: string;
  enquiryId: string;
  counsellorId: string;
  counsellorName: string;
  interactionType: "PHONE_CALL" | "IN_PERSON_MEETING" | "WHATSAPP" | "EMAIL" | "CAMPUS_TOUR";
  remarks: string;
  nextFollowupDate?: string;
  createdAt: string;
}


export interface AdmissionsEnquiryRecord {
  id: string;
  organizationId: OrganizationId;
  studentName: string;
  parentName?: string;
  phone: string;
  email?: string;
  targetExam: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "BOARDS";
  currentSchool?: string;
  currentGrade?: string;
  leadSource: LeadSource;
  status: EnquiryStatus;
  assignedCounsellorId?: string;
  assignedCounsellorName?: string;
  targetBatchId?: string;
  targetBatchName?: string;
  enrolledStudentId?: string;
  enrolledAt?: string;
  notes?: string;
  followups: AdmissionsFollowupRecord[];
  createdAt: string;
  updatedAt: string;
}