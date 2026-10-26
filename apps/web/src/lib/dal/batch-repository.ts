import "server-only";

import type { Batch, BatchMember, TargetExam } from "@prepzii/contracts";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { mockBatches, mockStudents, type StudentRecord } from "@/lib/mock-data";

// In-memory store for development/sandbox mode to allow dynamic additions without database reset
const persistentBatches = [...mockBatches];
const persistentStudents = [...mockStudents];

export interface CreateBatchInput {
  organizationId: string;
  name: string;
  targetExam: TargetExam;
  gradeLevel?: string;
  roomNumber?: string;
  facultyName?: string;
}

export interface EnrollStudentInput {
  organizationId: string;
  batchId: string;
  name: string;
  phone: string;
  parentPhone: string;
  rollNumber?: string;
}

export class BatchRepository {
  /**
   * Retrieves all batches for an organization.
   */
  public static async listBatches(organizationId: string): Promise<typeof mockBatches> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();

      // Canonical Prepzii table: public.institute_batches
      // Verified columns: id, institute_id, name, exam, target_year, created_at
      const { data: instBatches, error: instErr } = await supabase
        .from("institute_batches")
        .select("id, institute_id, name, exam, target_year, created_at")
        .eq("institute_id", organizationId);

      if (instErr) {
        throw new Error(`Failed to query canonical institute batches: ${instErr.message}`);
      }

      return (instBatches || []).map((b: any) => ({
        id: b.id,
        organizationId: b.institute_id,
        name: b.name,
        targetExam: (b.exam as TargetExam) || "JEE_MAIN",
        gradeLevel: b.target_year ? `Target ${b.target_year}` : "Class 12",
        roomNumber: "Hall 101",
        studentCount: 0,
        facultyName: "Assigned Faculty",
        attendanceRate: 92.5,
        syllabusProgress: 65,
        isActive: true,
        createdAt: b.created_at || new Date().toISOString(),
      }));
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Shared database environment is required in production.");
    }

    return persistentBatches;
  }

  /**
   * Creates a new batch with organization scope.
   */
  public static async createBatch(input: CreateBatchInput): Promise<Batch & { facultyName: string; attendanceRate: number; syllabusProgress: number }> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const newId = `batch-${Date.now()}`;

    if (hasSupabase) {
      const supabase = getPrepziiAdmin();

      // Canonical insert into public.institute_batches
      // Verified columns: institute_id, name, exam, target_year
      const { data: instData, error: instErr } = await supabase
        .from("institute_batches")
        .insert({
          institute_id: input.organizationId,
          name: input.name,
          exam: input.targetExam,
          target_year: new Date().getFullYear(),
        })
        .select("id, institute_id, name, exam, target_year, created_at")
        .single();

      if (instErr) {
        throw new Error(`Failed to create batch in canonical institute_batches: ${instErr.message}`);
      }

      const created = {
        id: instData.id,
        organizationId: instData.institute_id,
        name: instData.name,
        targetExam: (instData.exam as TargetExam) || input.targetExam,
        gradeLevel: instData.target_year ? `Target ${instData.target_year}` : (input.gradeLevel || "Class 12"),
        roomNumber: input.roomNumber || "Hall 101",
        studentCount: 0,
        facultyName: input.facultyName || "Senior Faculty",
        attendanceRate: 100,
        syllabusProgress: 0,
        isActive: true,
        createdAt: instData.created_at || new Date().toISOString(),
      };
      persistentBatches.unshift(created);
      return created;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Shared database environment is required in production.");
    }

    const created = {
      id: newId,
      organizationId: input.organizationId,
      name: input.name,
      targetExam: input.targetExam,
      gradeLevel: input.gradeLevel || "Class 12",
      roomNumber: input.roomNumber || "Hall 101",
      studentCount: 0,
      facultyName: input.facultyName || "Senior Faculty",
      attendanceRate: 100,
      syllabusProgress: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    persistentBatches.unshift(created);
    return created;
  }

  /**
   * Enrolls a student and allocates them to a batch.
   */
  public static async enrollStudent(input: EnrollStudentInput): Promise<StudentRecord> {
    const targetBatch = persistentBatches.find((b) => b.id === input.batchId) || persistentBatches[0];
    const generatedRoll = input.rollNumber || `APX-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newStudent: StudentRecord = {
      id: `std-${Date.now()}`,
      name: input.name,
      rollNumber: generatedRoll,
      batchId: targetBatch.id,
      batchName: targetBatch.name,
      targetExam: targetBatch.targetExam.replace("_", " "),
      phone: input.phone,
      parentPhone: input.parentPhone,
      attendancePercentage: 100,
      averageScore: 0,
      status: "ACTIVE",
    };

    persistentStudents.unshift(newStudent);
    targetBatch.studentCount += 1;

    return newStudent;
  }

  /**
   * Retrieves students with optional batch filter.
   */
  public static async listStudents(organizationId?: string, batchId?: string): Promise<StudentRecord[]> {
    const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (hasSupabase && organizationId) {
      const supabase = getPrepziiAdmin();
      let query = supabase
        .from("institute_batch_members")
        .select(`
          id,
          batch_id,
          member_id,
          created_at,
          institute_batches!inner (
            id,
            institute_id,
            name,
            exam,
            target_year
          ),
          institute_members!inner (
            id,
            user_id,
            email,
            role,
            status
          )
        `)
        .eq("institute_batches.institute_id", organizationId);

      if (batchId && batchId !== "ALL") {
        query = query.eq("batch_id", batchId);
      }

      const { data: rows, error } = await query;
      if (error) {
        throw new Error(`Failed to query institute students: ${error.message}`);
      }

      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.member_id,
          name: r.institute_members?.email ? r.institute_members.email.split("@")[0] : `Student ${r.member_id.slice(0, 6)}`,
          rollNumber: `STD-${r.member_id.slice(0, 8).toUpperCase()}`,
          batchId: r.batch_id,
          batchName: r.institute_batches?.name || "Assigned Batch",
          targetExam: r.institute_batches?.exam || "JEE Main",
          phone: "+91 98000 00000",
          parentPhone: "+91 98000 00000",
          attendancePercentage: 100,
          averageScore: 0,
          status: (r.institute_members?.status as any) || "ACTIVE",
        }));
      }
      return [];
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("Shared database environment is required in production.");
    }

    if (!batchId || batchId === "ALL") {
      return persistentStudents;
    }
    return persistentStudents.filter((s) => s.batchId === batchId);
  }
}
