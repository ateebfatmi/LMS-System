import "server-only";

import { BatchRepository } from "./batch-repository";

import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  NotificationDispatchLog,
} from "@prepzii/contracts";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { mockStudents } from "@/lib/mock-data";

export interface SaveAttendanceInput {
  organizationId: string;
  batchId: string;
  sessionDate: string; // YYYY-MM-DD
  markedByUserId: string;
  records: Array<{
    studentId: string;
    studentName: string;
    parentPhone: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendancePercentage: number;
}

// In-memory persistent stores for local/demo runs
const attendanceSessions = new Map<string, AttendanceSession>();
const attendanceRecords = new Map<string, AttendanceRecord[]>(); // sessionId -> records
const notificationLogs = new Map<string, NotificationDispatchLog>(); // logId -> log

// Seed initial attendance session for demo batch
const initialSessionId = "att-sess-2026-10-10-batch-1";
attendanceSessions.set(initialSessionId, {
  id: initialSessionId,
  organizationId: "demo-institute-apex",
  batchId: "batch-1",
  batchName: "JEE 12A - Titans",
  date: "2026-10-10",
  markedBy: "dev_user_faculty",
  totalStudents: mockStudents.filter((s) => s.batchId === "batch-1").length,
  presentCount: 2,
  absentCount: 0,
  createdAt: "2026-10-10T09:00:00Z",
});

attendanceRecords.set(
  initialSessionId,
  mockStudents
    .filter((s) => s.batchId === "batch-1")
    .map((s) => ({
      id: `rec-${initialSessionId}-${s.id}`,
      sessionId: initialSessionId,
      studentId: s.id,
      studentName: s.name,
      rollNumber: s.rollNumber,
      status: "PRESENT",
    }))
);

export class AttendanceRepository {
  /**
   * Retrieves attendance register for a specific batch and date.
   * If not yet marked, initializes with batch students and default status.
   */
  public static async getRegister(
    organizationId: string,
    batchId: string,
    sessionDate: string
  ): Promise<{
    session: AttendanceSession | null;
    records: Array<{
      studentId: string;
      studentName: string;
      rollNumber: string;
      parentPhone: string;
      status: AttendanceStatus;
      remarks?: string;
    }>;
    isMarked: boolean;
  }> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();
      const { data: dbSession, error: sessErr } = await supabase
        .from("organization_attendance_sessions")
        .select("id, organization_id, batch_id, session_date, marked_by, created_at")
        .eq("organization_id", organizationId)
        .eq("batch_id", batchId)
        .eq("session_date", sessionDate)
        .maybeSingle();

      if (sessErr) {
        throw new Error(`Failed to query attendance session: ${sessErr.message}`);
      }

      if (dbSession) {
        const { data: dbRecords, error: recErr } = await supabase
          .from("organization_attendance_records")
          .select("id, session_id, student_id, status, remarks")
          .eq("session_id", dbSession.id);

        if (recErr) {
          throw new Error(`Failed to query attendance records: ${recErr.message}`);
        }

        const recordsMap = new Map((dbRecords || []).map((r: any) => [r.student_id, r]));
        const batchStudents = await BatchRepository.listStudents(organizationId, batchId);

        return {
          session: {
            id: dbSession.id,
            organizationId: dbSession.organization_id,
            batchId: dbSession.batch_id,
            date: dbSession.session_date,
            markedBy: dbSession.marked_by,
            totalStudents: batchStudents.length,
            presentCount: (dbRecords || []).filter((r: any) => r.status === "PRESENT").length,
            absentCount: (dbRecords || []).filter((r: any) => r.status === "ABSENT").length,
            createdAt: dbSession.created_at,
          },
          records: batchStudents.map((s) => {
            const saved = recordsMap.get(s.id);
            return {
              studentId: s.id,
              studentName: s.name,
              rollNumber: s.rollNumber,
              parentPhone: s.parentPhone,
              status: (saved?.status as AttendanceStatus) || "PRESENT",
              remarks: saved?.remarks,
            };
          }),
          isMarked: true,
        };
      }
      const students = await BatchRepository.listStudents(organizationId, batchId);
      return {
        session: null,
        records: students.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          parentPhone: student.parentPhone,
          status: "PRESENT" as AttendanceStatus,
        })),
        isMarked: false,
      };
    }

    // In-Memory store
    const sessionKey = `att-sess-${sessionDate}-${batchId}`;
    const session = attendanceSessions.get(sessionKey);
    const existingRecords = session ? attendanceRecords.get(session.id) : undefined;
    const recordsMap = new Map((existingRecords || []).map((r) => [r.studentId, r]));

    const batchStudents = mockStudents.filter((s) => s.batchId === batchId || batchId === "ALL");

    const records = batchStudents.map((s) => {
      const existing = recordsMap.get(s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        rollNumber: s.rollNumber,
        parentPhone: s.parentPhone,
        status: existing?.status || "PRESENT",
        remarks: existing?.remarks,
      };
    });

    return {
      session: session || null,
      records,
      isMarked: Boolean(session),
    };
  }

  /**
   * Submits or corrects an attendance session with bulk records.
   * Prevents duplicate notifications for students already queued.
   */
  public static async saveRegister(input: SaveAttendanceInput): Promise<{
    session: AttendanceSession;
    dispatchedAlerts: number;
    isCorrection: boolean;
  }> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const sessionKey = `att-sess-${input.sessionDate}-${input.batchId}`;
    const isCorrection = attendanceSessions.has(sessionKey);

    const presentCount = input.records.filter((r) => r.status === "PRESENT").length;
    const absentCount = input.records.filter((r) => r.status === "ABSENT").length;
    const lateCount = input.records.filter((r) => r.status === "LATE").length;

    let sessionId = sessionKey;

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();
      // 1. Upsert session
      const { data: sessionData, error: sessErr } = await supabase
        .from("organization_attendance_sessions")
        .upsert(
          {
            organization_id: input.organizationId,
            batch_id: input.batchId,
            session_date: input.sessionDate,
            marked_by: input.markedByUserId,
          },
          { onConflict: "batch_id, session_date" }
        )
        .select()
        .single();

      if (sessErr) {
        throw new Error(`Failed to save attendance session: ${sessErr.message}`);
      }

      sessionId = sessionData.id;

      // 2. Upsert records
      const recordPayloads = input.records.map((r) => ({
        session_id: sessionId,
        student_id: r.studentId,
        status: r.status,
        remarks: r.remarks || null,
      }));

      const { error: recErr } = await supabase
        .from("organization_attendance_records")
        .upsert(recordPayloads, { onConflict: "session_id, student_id" });

      if (recErr) {
        throw new Error(`Failed to save attendance records: ${recErr.message}`);
      }

      // 3. Log audit event if correction
      if (isCorrection) {
        await supabase.from("organization_audit_logs").insert({
          organization_id: input.organizationId,
          actor_user_id: input.markedByUserId,
          actor_role: "TEACHER",
          event_type: "ATTENDANCE_CORRECTED",
          resource_type: "attendance_session",
          resource_id: sessionId,
          details: { sessionDate: input.sessionDate, batchId: input.batchId, absentCount, lateCount },
        });
      }
    }

    const sessionObj: AttendanceSession = {
      id: sessionId,
      organizationId: input.organizationId,
      batchId: input.batchId,
      date: input.sessionDate,
      markedBy: input.markedByUserId,
      totalStudents: input.records.length,
      presentCount,
      absentCount,
      createdAt: new Date().toISOString(),
    };

    attendanceSessions.set(sessionKey, sessionObj);

    attendanceRecords.set(
      sessionId,
      input.records.map((r) => ({
        id: `rec-${sessionId}-${r.studentId}`,
        sessionId,
        studentId: r.studentId,
        studentName: r.studentName,
        status: r.status,
        remarks: r.remarks,
      }))
    );

    // Notification Queue: Auto-dispatch alerts to parents of Absent or Late students
    // Deduplication check: Do not re-queue if an alert was already sent for (date + studentId)
    let dispatchedAlerts = 0;
    const attentionStudents = input.records.filter((r) => r.status === "ABSENT" || r.status === "LATE");

    for (const s of attentionStudents) {
      const dedupeKey = `notif-${input.sessionDate}-${s.studentId}`;
      if (!notificationLogs.has(dedupeKey)) {
        const logEntry: NotificationDispatchLog = {
          id: dedupeKey,
          organizationId: input.organizationId,
          batchId: input.batchId,
          recipientPhone: s.parentPhone,
          recipientName: `Parent of ${s.studentName}`,
          recipientRole: "PARENT",
          channel: "WHATSAPP",
          templateKey: s.status === "ABSENT" ? "ABSENT_ALERT" : "LATE_WARNING",
          renderedContent:
            s.status === "ABSENT"
              ? `Dear Parent, ${s.studentName} was marked ABSENT for lectures on ${input.sessionDate}. Please contact institute.`
              : `Dear Parent, ${s.studentName} arrived LATE for lectures on ${input.sessionDate}.`,
          status: "DELIVERED",
          provider: "INTERNAL_MOCK",
          providerMessageId: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          sentAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        notificationLogs.set(dedupeKey, logEntry);
        dispatchedAlerts++;
      }
    }

    return {
      session: sessionObj,
      dispatchedAlerts,
      isCorrection,
    };
  }

  /**
   * Computes student-specific attendance summary across all sessions.
   * Standard Formula: (Present + (Late * 0.5) + Excused) / Total * 100
   */
  public static async getStudentSummary(
    organizationId: string,
    studentId: string
  ): Promise<StudentAttendanceSummary> {
    const student = mockStudents.find((s) => s.id === studentId);
    const studentName = student?.name || "Student";

    // Gather all records for this student across all sessions
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    for (const records of attendanceRecords.values()) {
      const rec = records.find((r) => r.studentId === studentId);
      if (rec) {
        if (rec.status === "PRESENT") presentCount++;
        else if (rec.status === "ABSENT") absentCount++;
        else if (rec.status === "LATE") lateCount++;
        else if (rec.status === "EXCUSED") excusedCount++;
      }
    }

    // Include historical baseline if student has high baseline
    const totalSessions = Math.max(1, presentCount + absentCount + lateCount + excusedCount);
    const attendancePercentage =
      Math.round(((presentCount + lateCount * 0.5 + excusedCount) / totalSessions) * 1000) / 10;

    return {
      studentId,
      studentName,
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendancePercentage: student ? student.attendancePercentage : attendancePercentage,
    };
  }

  /**
   * Retrieves notification logs.
   */
  public static async listNotificationLogs(organizationId: string): Promise<NotificationDispatchLog[]> {
    return [...notificationLogs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
