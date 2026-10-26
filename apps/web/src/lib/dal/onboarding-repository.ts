import "server-only";

import type {
  BulkImportResult,
  BulkStudentImportRow,
  InstituteSetupChecklist,
} from "@prepzii/contracts";
import { mockStudents, type StudentRecord } from "@/lib/mock-data";
import { BatchRepository } from "./batch-repository";

// In-memory store for onboarding state
const onboardingState = new Map<string, {
  name: string;
  logoUrl?: string;
  campusName: string;
  academicYear: string;
  programs: string[];
  invitedTeachers: Array<{ id: string; name: string; email: string; subject: string; status: string }>;
}>();

// Initialize default state for demo institute
onboardingState.set("demo-institute-apex", {
  name: "Apex JEE & NEET Academy",
  logoUrl: "/brand/apex-logo.svg",
  campusName: "North Campus - Main Center",
  academicYear: "2026–2027",
  programs: ["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION"],
  invitedTeachers: [
    { id: "tch-1", name: "Er. Vivek Gupta", email: "vivek.gupta@apexjee.com", subject: "Physics", status: "ACTIVE" },
    { id: "tch-2", name: "Dr. Arvind Joshi", email: "arvind.joshi@apexjee.com", subject: "Chemistry", status: "ACTIVE" },
  ],
});

export class OnboardingRepository {
  /**
   * Retrieves the current onboarding checklist status for an institute.
   */
  public static async getChecklist(organizationId: string): Promise<InstituteSetupChecklist> {
    const batches = await BatchRepository.listBatches(organizationId);
    const students = mockStudents;
    const profile = onboardingState.get(organizationId);

    const profileConfigured = Boolean(profile?.name);
    const campusAdded = Boolean(profile?.campusName);
    const academicYearSet = Boolean(profile?.academicYear);
    const programsConfigured = Boolean(profile?.programs && profile.programs.length > 0);
    const firstBatchCreated = batches.length > 0;
    const teacherInvited = Boolean(profile?.invitedTeachers && profile.invitedTeachers.length > 0);
    const studentsEnrolled = students.length > 0;

    const checklistItems = [
      profileConfigured,
      campusAdded,
      academicYearSet,
      programsConfigured,
      firstBatchCreated,
      teacherInvited,
      studentsEnrolled,
    ];

    const completedCount = checklistItems.filter(Boolean).length;
    const overallCompletedPercentage = Math.round((completedCount / checklistItems.length) * 100);

    return {
      profileConfigured,
      campusAdded,
      academicYearSet,
      programsConfigured,
      firstBatchCreated,
      teacherInvited,
      studentsEnrolled,
      overallCompletedPercentage,
    };
  }

  /**
   * Updates institute branding, campus and academic year.
   */
  public static async updateProfile(
    organizationId: string,
    input: {
      name: string;
      campusName?: string;
      academicYear?: string;
      programs?: string[];
      logoUrl?: string;
    }
  ): Promise<{ success: boolean }> {
    const existing = onboardingState.get(organizationId) || {
      name: input.name,
      campusName: input.campusName || "Main Campus",
      academicYear: input.academicYear || "2026–2027",
      programs: input.programs || ["JEE_MAIN", "JEE_ADVANCED", "NEET"],
      invitedTeachers: [],
    };

    onboardingState.set(organizationId, {
      ...existing,
      name: input.name,
      campusName: input.campusName || existing.campusName,
      academicYear: input.academicYear || existing.academicYear,
      programs: input.programs || existing.programs,
      logoUrl: input.logoUrl || existing.logoUrl,
    });

    return { success: true };
  }

  /**
   * Bulk imports students from CSV/Excel formatted rows with duplicate detection.
   * Checks against existing roll numbers and phone numbers.
   */
  public static async bulkImportStudents(
    organizationId: string,
    rows: BulkStudentImportRow[]
  ): Promise<BulkImportResult> {
    const existingRolls = new Set(mockStudents.map((s) => s.rollNumber.toLowerCase().trim()));
    const existingPhones = new Set(mockStudents.map((s) => s.parentPhone.replace(/\D/g, "")));

    const duplicates: Array<{ rollNumber: string; phone: string; reason: string }> = [];
    const enrolledStudents: Array<{ id: string; name: string; rollNumber: string; batchId: string }> = [];

    const batches = await BatchRepository.listBatches(organizationId);
    const batchMap = new Map(batches.map((b) => [b.name.toLowerCase().trim(), b.id]));

    for (const row of rows) {
      const cleanRoll = row.rollNumber.trim();
      const cleanPhone = row.phone.replace(/\D/g, "");

      if (existingRolls.has(cleanRoll.toLowerCase())) {
        duplicates.push({ rollNumber: cleanRoll, phone: cleanPhone, reason: "Duplicate roll number already registered" });
        continue;
      }

      if (cleanPhone && existingPhones.has(cleanPhone)) {
        duplicates.push({ rollNumber: cleanRoll, phone: cleanPhone, reason: "Phone number already associated with existing student" });
        continue;
      }

      // Assign to existing batch or default to first batch
      const targetBatchId = batchMap.get(row.batchName.toLowerCase().trim()) || batches[0]?.id || "batch-1";
      const targetBatch = batches.find((b) => b.id === targetBatchId);

      const newStudentId = `std-bulk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newStudentRecord: StudentRecord = {
        id: newStudentId,
        rollNumber: cleanRoll,
        name: row.name.trim(),
        batchId: targetBatchId,
        batchName: targetBatch?.name || row.batchName,
        phone: row.phone,
        parentPhone: row.parentPhone || row.phone,
        targetExam: row.targetExam,
        averageScore: 75,
        attendancePercentage: 100,
        status: "ACTIVE",
      };

      mockStudents.push(newStudentRecord);
      existingRolls.add(cleanRoll.toLowerCase());
      if (cleanPhone) existingPhones.add(cleanPhone);

      enrolledStudents.push({
        id: newStudentId,
        name: row.name,
        rollNumber: cleanRoll,
        batchId: targetBatchId,
      });
    }

    return {
      totalProcessed: rows.length,
      successfulCount: enrolledStudents.length,
      duplicateCount: duplicates.length,
      failedCount: rows.length - (enrolledStudents.length + duplicates.length),
      duplicates,
      enrolledStudents,
    };
  }

  /**
   * Invites a new faculty member.
   */
  public static async inviteTeacher(
    organizationId: string,
    input: { name: string; email: string; subject: string }
  ): Promise<{ id: string; name: string; email: string; status: string }> {
    const profile = onboardingState.get(organizationId) || {
      name: "Institute",
      campusName: "Main",
      academicYear: "2026-27",
      programs: ["JEE_MAIN"],
      invitedTeachers: [],
    };

    const newTeacher = {
      id: `tch-inv-${Date.now()}`,
      name: input.name,
      email: input.email,
      subject: input.subject,
      status: "INVITED",
    };

    profile.invitedTeachers.push(newTeacher);
    onboardingState.set(organizationId, profile);

    return newTeacher;
  }
}
