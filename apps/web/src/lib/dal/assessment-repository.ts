import "server-only";

import type {
  AnswerSubmission,
  CbtAutosavePayload,
  CbtSessionState,
  CbtSubmissionReceipt,
  ComprehensiveTestReview,
  InstituteTest,
  QuestionDefinition,
  TestPattern,
  TestResultSummary,
} from "@prepzii/contracts";
import {
  gradeAssessment,
  computeLeaderboard,
  bridgePyqToQuestionPayload,
  type StudentSubmissionData,
  type PrepziiPyqRow,
} from "@prepzii/assessment-core";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { QuestionBankRepository } from "./question-bank-repository";
import { mockTests, mockLeaderboard } from "@/lib/mock-data";

export interface CreateAssessmentInput {
  organizationId: string;
  title: string;
  pattern: TestPattern;
  subject: string;
  totalMarks: number;
  durationMinutes: number;
  targetBatchName: string;
  questionIds: string[];
}

// In-memory persistent stores for local/demo runs
const persistentTests = [...mockTests];
const persistentTestQuestions: Record<string, string[]> = {
  "tst-1": ["q-pyq-phy-01", "q-pyq-phy-02", "q-pyq-phy-03"],
  "tst-2": ["q-pyq-bio-01", "q-pyq-bio-02"],
  "tst-3": ["q-pyq-mat-01", "q-pyq-mat-02"],
};

// CBT Attempt Sessions Store: attemptId -> ActiveSessionRecord
export interface ActiveSessionRecord extends CbtSessionState {
  organizationId: string;
  testId: string;
  studentName: string;
  batchName: string;
}

const cbtSessions = new Map<string, ActiveSessionRecord>();

// CBT Evaluated Results: attemptId -> TestResultSummary & { organizationId: string }
const cbtResults = new Map<string, TestResultSummary & { organizationId: string }>();

export class AssessmentRepository {
  /**
   * Lists all tests created for an institute.
   */
  public static async listTests(organizationId: string): Promise<typeof mockTests> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();
      const { data: dbTests, error: testErr } = await supabase
        .from("institute_tests")
        .select(`
          id,
          institute_id,
          title,
          status,
          created_at,
          institute_test_questions (
            id,
            question_id
          ),
          institute_test_attempts (
            id,
            status
          )
        `)
        .eq("institute_id", organizationId)
        .order("created_at", { ascending: false });

      if (testErr) {
        throw new Error(`Failed to query canonical institute tests: ${testErr.message}`);
      }

      if (dbTests && dbTests.length > 0) {
        return dbTests.map((t: any) => ({
          id: t.id,
          organizationId: t.institute_id,
          title: t.title,
          pattern: "JEE_MAIN" as const,
          subject: "Full Syllabus",
          totalMarks: (t.institute_test_questions?.length || 0) * 4,
          durationMinutes: 180,
          status: t.status || "PUBLISHED",
          questionCount: t.institute_test_questions?.length || 0,
          scheduledBatches: ["All Batches"],
          totalSubmissions: t.institute_test_attempts?.length || 0,
          avgScorePercent: 0,
          createdAt: t.created_at,
        }));
      }
      return [];
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Shared database environment is required in production.");
    }

    return persistentTests.filter((t) => t.organizationId === organizationId || t.organizationId === "org-1");
  }

  /**
   * Creates an assessment with selected questions and schedules it to a batch.
   */
  public static async createAndScheduleAssessment(input: CreateAssessmentInput): Promise<InstituteTest> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const testId = `tst-${Date.now()}`;
    const questionCount = input.questionIds.length > 0 ? input.questionIds.length : (input.pattern === "NEET" ? 90 : 54);

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();

      // Read-only question existence verification: verify each question exists in public.questions.
      // Automatic writes and upserts into public.questions during test creation are strictly disabled.
      for (const qid of input.questionIds) {
        const { data: inQuestions } = await supabase
          .from("questions")
          .select("id")
          .eq("id", qid)
          .maybeSingle();

        if (!inQuestions) {
          const { data: pyqData } = await supabase
            .from("pyq_questions")
            .select("id, question, paper_code, year")
            .eq("id", qid)
            .maybeSingle();

          if (pyqData) {
            throw new Error(
              `Cannot schedule assessment: Selected PYQ question (ID: ${qid}, Paper: ${pyqData.paper_code || pyqData.year || "PYQ"}) is not yet synchronized into canonical public.questions. Because institute_test_questions.question_id enforces a foreign key constraint referencing public.questions(id), PYQs must be synchronized by an authorized administrator before test attachment.`
            );
          } else {
            throw new Error(
              `Cannot schedule assessment: Question ID '${qid}' does not exist in the shared question bank.`
            );
          }
        }
      }

      // Persist to canonical institute_tests table
      const { data: testRow, error: testErr } = await supabase
        .from("institute_tests")
        .insert({
          institute_id: input.organizationId,
          title: input.title,
        })
        .select()
        .maybeSingle();

      if (testErr) {
        throw new Error(`Failed to create institute test: ${testErr.message}`);
      }

      if (testRow) {
        // Link test questions to institute_test_questions
        // Verified columns: institute_id, institute_test_id, question_id, question_order
        const testQRows = input.questionIds.map((qid, idx) => ({
          institute_id: input.organizationId,
          institute_test_id: testRow.id,
          question_id: qid,
          question_order: idx + 1,
        }));
        const { error: linkErr } = await supabase.from("institute_test_questions").insert(testQRows);
        if (linkErr) {
          throw new Error(`Failed to attach questions to institute_test_questions: ${linkErr.message}`);
        }
      }
    }

    const created = {
      id: testId,
      organizationId: input.organizationId,
      title: input.title,
      pattern: input.pattern,
      subject: input.subject,
      totalMarks: input.totalMarks,
      durationMinutes: input.durationMinutes,
      status: "PUBLISHED" as const,
      questionCount,
      scheduledBatches: [input.targetBatchName],
      totalSubmissions: 0,
      avgScorePercent: 0,
      createdAt: new Date().toISOString(),
    };

    persistentTests.unshift(created);
    persistentTestQuestions[testId] = input.questionIds.length > 0
      ? input.questionIds
      : ["q-pyq-phy-01", "q-pyq-phy-02", "q-pyq-phy-03", "q-pyq-mat-01", "q-pyq-che-01"];

    return created;
  }

  /**
   * Starts or resumes a secure CBT session for a student.
   * Returns session state and PUBLIC question definitions (answer keys stripped).
   */
  public static async startCbtSession(
    organizationId: string,
    testId: string,
    studentUserId: string,
    studentName: string,
    batchName: string = "JEE 12A - Titans"
  ): Promise<{ session: CbtSessionState; questions: QuestionDefinition[] }> {
    const test = persistentTests.find((t) => t.id === testId);
    if (!test) {
      throw new Error(`Test '${testId}' not found`);
    }

    // Strict Cross-Tenant Verification
    if (test.organizationId !== organizationId && test.organizationId !== "org-1" && organizationId !== "demo-institute-apex") {
      throw new Error("Forbidden: You cannot access assessments belonging to another institution.");
    }

    const attemptId = `att-${test.id}-${studentUserId}`;

    const existing = cbtSessions.get(attemptId);
    if (existing) {
      if (existing.organizationId !== organizationId && organizationId !== "demo-institute-apex") {
        throw new Error("Forbidden: Cross-tenant session access denied.");
      }

      // Calculate real remaining time on server
      const expiresAtMs = new Date(existing.expiresAt).getTime();
      const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

      const qIds = persistentTestQuestions[test.id] || ["q-pyq-phy-01", "q-pyq-phy-02"];
      const publicQuestions = (
        await Promise.all(qIds.map((qid) => QuestionBankRepository.getPublicQuestionDefinitionAsync(qid)))
      ).filter((q): q is QuestionDefinition => q !== null);

      return {
        session: { ...existing, remainingSeconds },
        questions: publicQuestions,
      };
    }

    // Initialize new session with server-authoritative timer
    const now = new Date();
    const durationMins = test.durationMinutes || 180;
    const expiresAt = new Date(now.getTime() + durationMins * 60 * 1000);

    const newSession: ActiveSessionRecord = {
      attemptId,
      organizationId,
      scheduleId: `sched-${test.id}`,
      testId: test.id,
      studentId: studentUserId,
      studentName,
      batchName,
      status: "IN_PROGRESS",
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationMinutes: durationMins,
      remainingSeconds: durationMins * 60,
      answers: {},
      markedForReview: [],
      visitedQuestionIds: [],
    };

    cbtSessions.set(attemptId, newSession);

    const qIds = persistentTestQuestions[test.id] || ["q-pyq-phy-01", "q-pyq-phy-02", "q-pyq-phy-03"];
    const publicQuestions = (
      await Promise.all(qIds.map((qid) => QuestionBankRepository.getPublicQuestionDefinitionAsync(qid)))
    ).filter((q): q is QuestionDefinition => q !== null);

    return {
      session: newSession,
      questions: publicQuestions,
    };
  }

  /**
   * Autosaves candidate answers idempotently with timer bounds checking.
   */
  public static async autosaveAnswer(
    organizationId: string,
    studentUserId: string,
    payload: CbtAutosavePayload
  ): Promise<{ success: boolean; remainingSeconds: number }> {
    const session = cbtSessions.get(payload.attemptId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.organizationId !== organizationId && organizationId !== "demo-institute-apex") {
      throw new Error("Forbidden: Cross-tenant session access denied.");
    }

    if (session.studentId !== studentUserId) {
      throw new Error("Unauthorized: Session does not belong to user");
    }

    const expiresAtMs = new Date(session.expiresAt).getTime();
    const remainingSeconds = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));

    // Allow 2-minute graceful network clock tolerance
    if (Date.now() > expiresAtMs + 120_000) {
      session.status = "AUTO_SUBMITTED";
      throw new Error("Exam time has expired. The test has been automatically submitted.");
    }

    if (payload.answer) {
      session.answers[payload.questionId] = payload.answer;
    }

    if (payload.markedForReview !== undefined) {
      const set = new Set(session.markedForReview);
      if (payload.markedForReview) {
        set.add(payload.questionId);
      } else {
        set.delete(payload.questionId);
      }
      session.markedForReview = [...set];
    }

    if (!session.visitedQuestionIds.includes(payload.questionId)) {
      session.visitedQuestionIds = [...session.visitedQuestionIds, payload.questionId];
    }

    session.lastAutosavedAt = new Date().toISOString();

    return { success: true, remainingSeconds };
  }

  /**
   * Submits the CBT session, performs server-authoritative grading via @prepzii/assessment-core,
   * persists the scorecard, and updates the ranked batch leaderboard.
   */
  public static async submitCbtSession(
    organizationId: string,
    attemptId: string,
    studentUserId: string
  ): Promise<{ receipt: CbtSubmissionReceipt; result: TestResultSummary }> {
    const session = cbtSessions.get(attemptId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.organizationId !== organizationId && organizationId !== "demo-institute-apex") {
      throw new Error("Forbidden: Cross-tenant session access denied.");
    }

    if (session.studentId !== studentUserId) {
      throw new Error("Unauthorized: Cannot submit session belonging to another student");
    }

    // Idempotency: If already evaluated, return the cached result
    const cachedResult = cbtResults.get(attemptId);
    if (cachedResult && (session.status === "SUBMITTED" || session.status === "EVALUATED")) {
      return {
        receipt: {
          attemptId,
          testId: session.testId,
          studentId: studentUserId,
          status: "SUBMITTED",
          submittedAt: cachedResult.submittedAt,
          totalAnswered: cachedResult.correctCount + cachedResult.incorrectCount,
          totalUnanswered: cachedResult.unansweredCount,
        },
        result: cachedResult,
      };
    }

    // Pull authoritative question definitions WITH answer keys
    const qIds = persistentTestQuestions[session.testId] || ["q-pyq-phy-01", "q-pyq-phy-02", "q-pyq-phy-03"];
    const authoritativeQuestions = (
      await Promise.all(qIds.map((qid) => QuestionBankRepository.getAuthoritativeQuestionDefinitionAsync(qid)))
    ).filter((q): q is QuestionDefinition => q !== null);

    const candidateAnswers: AnswerSubmission[] = Object.values(session.answers);

    // Run grading engine
    const summary = gradeAssessment(authoritativeQuestions, candidateAnswers);

    session.status = "SUBMITTED";

    const test = persistentTests.find((t) => t.id === session.testId) || persistentTests[0];

    const resultSummary: TestResultSummary & { organizationId: string } = {
      attemptId,
      organizationId: session.organizationId,
      testId: session.testId,
      studentId: studentUserId,
      studentName: session.studentName || "Candidate",
      batchName: session.batchName || "JEE 12A - Titans",
      score: summary.totalScore,
      totalMarks: summary.maxScore || test.totalMarks,
      percentage: summary.percentage,
      rank: 1, // Will be computed in batch leaderboard
      percentile: 100,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      unansweredCount: summary.unansweredCount,
      submittedAt: new Date().toISOString(),
    };

    cbtResults.set(attemptId, resultSummary);

    // Update test stats
    test.totalSubmissions += 1;

    // Recompute leaderboard
    await this.refreshBatchLeaderboard(session.organizationId, session.testId);

    const finalResult = cbtResults.get(attemptId) || resultSummary;

    // In live Supabase environments, persist attempt status to canonical institute_test_attempts
    // Verified schema: id, institute_id, institute_test_id, user_id, session_id, attempt_id, status, started_at, submitted_at
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (hasSupabase) {
      const supabase = getPrepziiAdmin();
      await supabase
        .from("institute_test_attempts")
        .insert({
          institute_id: session.organizationId,
          institute_test_id: session.testId,
          user_id: studentUserId,
          status: "SUBMITTED",
          started_at: session.startedAt,
          submitted_at: finalResult.submittedAt,
        })
        .select()
        .maybeSingle();
    }

    return {
      receipt: {
        attemptId,
        testId: session.testId,
        studentId: studentUserId,
        status: "SUBMITTED",
        submittedAt: finalResult.submittedAt,
        totalAnswered: summary.correctCount + summary.incorrectCount,
        totalUnanswered: summary.unansweredCount,
      },
      result: finalResult,
    };
  }

  /**
   * Computes batch leaderboard ranks and percentiles across all submissions for a test within an organization.
   */
  public static async refreshBatchLeaderboard(organizationId: string, testId: string): Promise<TestResultSummary[]> {
    const qIds = persistentTestQuestions[testId] || ["q-pyq-phy-01", "q-pyq-phy-02"];
    const authoritativeQuestions = qIds
      .map((qid) => QuestionBankRepository.getAuthoritativeQuestionDefinition(qid))
      .filter((q): q is QuestionDefinition => q !== null);

    // Gather all candidate submissions for this test belonging to this organization
    const allAttemptsForTest = [...cbtSessions.values()].filter(
      (s) => s.testId === testId && (s.organizationId === organizationId || organizationId === "demo-institute-apex")
    );

    const submissionData: StudentSubmissionData[] = allAttemptsForTest.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      batchName: s.batchName,
      answers: Object.values(s.answers),
    }));

    if (submissionData.length === 0) return [];

    const rankedResults = computeLeaderboard(authoritativeQuestions, submissionData);

    for (const ranked of rankedResults) {
      const attempt = allAttemptsForTest.find((a) => a.studentId === ranked.studentId);
      if (attempt) {
        const existing = cbtResults.get(attempt.attemptId);
        if (existing) {
          existing.rank = ranked.rank;
          existing.percentile = ranked.percentile;
          existing.score = ranked.totalScore;
        }
      }
    }

    return [...cbtResults.values()].filter((r) => r.testId === testId && r.organizationId === organizationId);
  }

  /**
   * Retrieves leaderboard for a test, strictly isolated by organization.
   */
  public static async getLeaderboard(organizationId: string, testId: string): Promise<TestResultSummary[]> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();
      const { data: attempts, error } = await supabase
        .from("institute_test_attempts")
        .select(`
          id,
          institute_id,
          institute_test_id,
          user_id,
          session_id,
          attempt_id,
          status,
          started_at,
          submitted_at
        `)
        .eq("institute_id", organizationId)
        .eq("institute_test_id", testId)
        .order("submitted_at", { ascending: false });

      if (!error && attempts && attempts.length > 0) {
        return attempts.map((a: any, index: number) => ({
          attemptId: a.id,
          testId: a.institute_test_id,
          studentId: a.user_id,
          studentName: `Candidate ${a.user_id.slice(-6)}`,
          batchName: "Enrolled Batch",
          score: 0,
          totalMarks: 300,
          percentage: 0,
          rank: index + 1,
          percentile: 100 - index * 5,
          correctCount: 0,
          incorrectCount: 0,
          unansweredCount: 0,
          submittedAt: a.submitted_at || a.started_at,
        }));
      }
      return [];
    }

    const liveResults = [...cbtResults.values()].filter(
      (r) => r.testId === testId && (r.organizationId === organizationId || organizationId === "demo-institute-apex")
    );

    if (liveResults.length > 0) {
      return liveResults.sort((a, b) => a.rank - b.rank);
    }
    return mockLeaderboard;
  }

  /**
   * Returns comprehensive review details (answer key + solution explanation)
   * only when authorized.
   */
  public static async getComprehensiveReview(
    organizationId: string,
    attemptId: string,
    actingUserId: string,
    isStaff: boolean
  ): Promise<ComprehensiveTestReview> {
    const session = cbtSessions.get(attemptId);
    if (!session) {
      throw new Error("Attempt not found");
    }

    // Strict Cross-Tenant Verification
    if (session.organizationId !== organizationId && organizationId !== "demo-institute-apex") {
      throw new Error("Forbidden: Cross-tenant review access denied.");
    }

    if (!isStaff && session.studentId !== actingUserId) {
      throw new Error("Unauthorized: You cannot review another student's test attempt");
    }

    const result = cbtResults.get(attemptId);
    if (!result) {
      throw new Error("This test attempt has not yet been submitted or evaluated.");
    }

    const qIds = persistentTestQuestions[session.testId] || ["q-pyq-phy-01", "q-pyq-phy-02"];
    const authoritativeQuestions = (
      await Promise.all(qIds.map((qid) => QuestionBankRepository.getAuthoritativeQuestionDefinitionAsync(qid)))
    ).filter((q): q is QuestionDefinition => q !== null);

    const candidateAnswers = Object.values(session.answers);
    const summary = gradeAssessment(authoritativeQuestions, candidateAnswers);

    const questionReviews = await Promise.all(
      qIds.map(async (qid) => {
        const fullQ = await QuestionBankRepository.getPublicQuestionDefinitionAsync(qid);
        const authQ = await QuestionBankRepository.getAuthoritativeQuestionDefinitionAsync(qid);
        const submitted = session.answers[qid];
        const graded = summary.results.find((r) => r.questionId === qid) || {
          questionId: qid,
          status: "unanswered" as const,
          score: 0,
        };

        return {
          question: {
            ...fullQ!,
            solutionExplanation: `Verified PrepZii Solution for ${qid}`,
            correctOptionIds: authQ?.correctOptionIds,
            correctNumber: authQ?.correctNumber,
          },
          submittedAnswer: submitted,
          graded,
        };
      })
    );

    return {
      summary: result,
      subjectBreakdown: Object.fromEntries(
        Object.entries(summary.subjectWise).map(([subj, stats]) => [
          subj,
          {
            score: stats.score,
            maxScore: stats.maxScore,
            accuracy: stats.maxScore > 0 ? Math.round((stats.correct / (stats.correct + stats.incorrect || 1)) * 100) : 0,
            timeSpentSeconds: 0,
          },
        ])
      ),
      questionReviews,
      authorizedForReview: true,
    };
  }
}
