import "server-only";

import type {
  AdmissionsEnquiryRecord,
  AdmissionsFollowupRecord,
  EnquiryStatus,
  LeadSource,
} from "@prepzii/contracts";
import { mockBatches, mockStudents, type StudentRecord } from "@/lib/mock-data";

// In-memory store for Admissions CRM
const enquiriesStore = new Map<string, AdmissionsEnquiryRecord>();

// Seed realistic coaching admissions enquiries (Apex JEE & NEET Academy)
const seedEnquiries: AdmissionsEnquiryRecord[] = [
  {
    id: "enq-101",
    organizationId: "demo-institute-apex",
    studentName: "Devansh Mehra",
    parentName: "Sunil Mehra",
    phone: "+91 98231 12345",
    email: "sunil.mehra@gmail.com",
    targetExam: "JEE_ADVANCED",
    currentSchool: "Delhi Public School, R.K. Puram",
    currentGrade: "Class 11",
    leadSource: "WALK_IN",
    status: "COUNSELED",
    assignedCounsellorId: "counsellor-1",
    assignedCounsellorName: "Pooja Sharma",
    targetBatchId: "batch-1",
    targetBatchName: "JEE 12A - Titans",
    notes: "Visited North Campus with father. Scored 94% in Class 10 Boards. Interested in weekend batch.",
    followups: [
      {
        id: "flw-1",
        enquiryId: "enq-101",
        counsellorId: "counsellor-1",
        counsellorName: "Pooja Sharma",
        interactionType: "IN_PERSON_MEETING",
        remarks: "Provided detailed brochure and sample PrepZii CBT scorecard. Scheduled demo class for Saturday.",
        nextFollowupDate: "2026-10-25",
        createdAt: "2026-10-18T10:00:00Z",
      },
    ],
    createdAt: "2026-10-18T09:30:00Z",
    updatedAt: "2026-10-18T10:30:00Z",
  },
  {
    id: "enq-102",
    organizationId: "demo-institute-apex",
    studentName: "Sneha Reddy",
    parentName: "Dr. K. V. Reddy",
    phone: "+91 98450 67890",
    email: "kv.reddy@apollohospitals.com",
    targetExam: "NEET",
    currentSchool: "National Public School, Indiranagar",
    currentGrade: "Class 12",
    leadSource: "STUDENT_REFERRAL",
    status: "DEMO_ATTENDED",
    assignedCounsellorId: "counsellor-2",
    assignedCounsellorName: "Vikram Malhotra",
    targetBatchId: "batch-3",
    targetBatchName: "NEET 12 - Medico Super 50",
    notes: "Referred by Aarav Sharma's family. Targeting AIIMS New Delhi. Attended Dr. Mehta's biology demo lecture.",
    followups: [
      {
        id: "flw-2",
        enquiryId: "enq-102",
        counsellorId: "counsellor-2",
        counsellorName: "Vikram Malhotra",
        interactionType: "PHONE_CALL",
        remarks: "Feedback on demo class was excellent. Requested fee structure for NEET 1-year repeater batch.",
        nextFollowupDate: "2026-10-24",
        createdAt: "2026-10-19T14:30:00Z",
      },
    ],
    createdAt: "2026-10-17T11:00:00Z",
    updatedAt: "2026-10-19T14:30:00Z",
  },
  {
    id: "enq-103",
    organizationId: "demo-institute-apex",
    studentName: "Aditya Pratap Singh",
    parentName: "Col. R. S. Singh",
    phone: "+91 99100 44556",
    email: "rs.singh@army.gov.in",
    targetExam: "FOUNDATION",
    currentSchool: "Army Public School, Dhaula Kuan",
    currentGrade: "Class 9",
    leadSource: "SEMINAR",
    status: "NEW",
    assignedCounsellorId: "counsellor-1",
    assignedCounsellorName: "Pooja Sharma",
    targetBatchId: "batch-4",
    targetBatchName: "Foundation 10 - Olympiad",
    notes: "Attended Apex National Science Talent Search Seminar. Interested in Class 9 Olympiad Foundation course.",
    followups: [],
    createdAt: "2026-10-21T16:00:00Z",
    updatedAt: "2026-10-21T16:00:00Z",
  },
];

for (const e of seedEnquiries) {
  enquiriesStore.set(e.id, e);
}

export interface CreateEnquiryInput {
  organizationId: string;
  studentName: string;
  parentName?: string;
  phone: string;
  email?: string;
  targetExam: "JEE_MAIN" | "JEE_ADVANCED" | "NEET" | "FOUNDATION" | "BOARDS";
  currentSchool?: string;
  currentGrade?: string;
  leadSource: LeadSource;
  assignedCounsellorName?: string;
  targetBatchId?: string;
  notes?: string;
}

export class AdmissionsRepository {
  /**
   * Lists all admissions enquiries for an institute.
   */
  public static async listEnquiries(organizationId: string): Promise<AdmissionsEnquiryRecord[]> {
    return [...enquiriesStore.values()]
      .filter((e) => e.organizationId === organizationId || organizationId === "demo-institute-apex")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Creates a new enquiry with duplicate detection by phone number.
   */
  public static async createEnquiry(input: CreateEnquiryInput): Promise<{
    enquiry: AdmissionsEnquiryRecord;
    isDuplicate: boolean;
  }> {
    const cleanPhone = input.phone.replace(/\D/g, "");

    // Check for duplicate phone among existing leads
    const existing = [...enquiriesStore.values()].find(
      (e) => e.phone.replace(/\D/g, "") === cleanPhone && (e.organizationId === input.organizationId || input.organizationId === "demo-institute-apex")
    );

    if (existing) {
      return { enquiry: existing, isDuplicate: true };
    }

    const id = `enq-${Date.now()}`;
    const batch = mockBatches.find((b) => b.id === input.targetBatchId);

    const newEnquiry: AdmissionsEnquiryRecord = {
      id,
      organizationId: input.organizationId,
      studentName: input.studentName.trim(),
      parentName: input.parentName?.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim(),
      targetExam: input.targetExam,
      currentSchool: input.currentSchool?.trim(),
      currentGrade: input.currentGrade?.trim(),
      leadSource: input.leadSource,
      status: "NEW",
      assignedCounsellorId: "counsellor-1",
      assignedCounsellorName: input.assignedCounsellorName || "Reception Desk",
      targetBatchId: input.targetBatchId,
      targetBatchName: batch?.name,
      notes: input.notes,
      followups: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    enquiriesStore.set(id, newEnquiry);
    return { enquiry: newEnquiry, isDuplicate: false };
  }

  /**
   * Adds a follow-up interaction note to an enquiry.
   */
  public static async addFollowup(
    enquiryId: string,
    input: {
      counsellorName: string;
      interactionType: "PHONE_CALL" | "IN_PERSON_MEETING" | "WHATSAPP" | "EMAIL" | "CAMPUS_TOUR";
      remarks: string;
      nextFollowupDate?: string;
      newStatus?: EnquiryStatus;
    }
  ): Promise<AdmissionsEnquiryRecord> {
    const enquiry = enquiriesStore.get(enquiryId);
    if (!enquiry) throw new Error("Enquiry not found");

    const followup: AdmissionsFollowupRecord = {
      id: `flw-${Date.now()}`,
      enquiryId,
      counsellorId: "counsellor-active",
      counsellorName: input.counsellorName,
      interactionType: input.interactionType,
      remarks: input.remarks,
      nextFollowupDate: input.nextFollowupDate,
      createdAt: new Date().toISOString(),
    };

    enquiry.followups.unshift(followup);
    if (input.newStatus) {
      enquiry.status = input.newStatus;
    }
    enquiry.updatedAt = new Date().toISOString();

    enquiriesStore.set(enquiryId, enquiry);
    return enquiry;
  }

  /**
   * Converts an admission enquiry into an enrolled student in a batch.
   */
  public static async convertToStudent(
    enquiryId: string,
    targetBatchId: string
  ): Promise<{
    student: StudentRecord;
    enquiry: AdmissionsEnquiryRecord;
  }> {
    const enquiry = enquiriesStore.get(enquiryId);
    if (!enquiry) throw new Error("Enquiry not found");

    const batch = mockBatches.find((b) => b.id === targetBatchId) || mockBatches[0];

    // Generate roll number
    const count = mockStudents.length + 1;
    const rollNumber = `APX-2026-${String(1200 + count)}`;
    const studentId = `std-enrolled-${Date.now()}`;

    const newStudent: StudentRecord = {
      id: studentId,
      rollNumber,
      name: enquiry.studentName,
      batchId: batch.id,
      batchName: batch.name,
      phone: enquiry.phone,
      parentPhone: enquiry.phone,
      targetExam: enquiry.targetExam,
      averageScore: 75,
      attendancePercentage: 100,
      status: "ACTIVE",
    };

    mockStudents.push(newStudent);

    // Update enquiry record
    enquiry.status = "ENROLLED";
    enquiry.enrolledStudentId = studentId;
    enquiry.enrolledAt = new Date().toISOString();
    enquiry.targetBatchId = batch.id;
    enquiry.targetBatchName = batch.name;
    enquiry.updatedAt = new Date().toISOString();

    enquiriesStore.set(enquiryId, enquiry);

    return { student: newStudent, enquiry };
  }
}
