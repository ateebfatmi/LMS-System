import type { OrganizationRole } from "@prepzii/contracts";

export const invitationRoles = [
  "COACHING_ADMIN",
  "ACADEMIC_COORDINATOR",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
] as const satisfies readonly OrganizationRole[];

export type InvitationRole = (typeof invitationRoles)[number];
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

const transitions: Record<InvitationStatus, ReadonlySet<InvitationStatus>> = {
  PENDING: new Set(["ACCEPTED", "REVOKED", "EXPIRED"]),
  ACCEPTED: new Set(),
  REVOKED: new Set(),
  EXPIRED: new Set(),
};

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return transitions[from].has(to);
}

export function isInvitationExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

export type ImportableMemberRole = "STUDENT" | "TEACHER";
export type MemberImportData = {
  displayName: string;
  email: string;
  phone: string | null;
  alternatePhone: string | null;
  rollNumber: string | null;
  employeeCode: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  qualification: string | null;
  subjectSpecialization: string | null;
  joinedOn: string | null;
};
export type MemberImportRow = {
  rowNumber: number;
  rawData: Record<string, string>;
  normalizedData: MemberImportData | null;
  errors: string[];
};

const importHeaders = [
  "name", "email", "phone", "alternatePhone", "rollNumber", "employeeCode",
  "guardianName", "guardianPhone", "qualification", "subjectSpecialization", "joinedOn",
] as const;

function parseCsvCells(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function validateMemberCsv(
  csvText: string,
  role: ImportableMemberRole,
  maxRows = 1000,
): { rows: MemberImportRow[]; fileErrors: string[] } {
  let parsed: string[][];
  try {
    parsed = parseCsvCells(csvText.replace(/^\uFEFF/, ""));
  } catch (error) {
    return { rows: [], fileErrors: [error instanceof Error ? error.message : "CSV could not be parsed."] };
  }
  if (parsed.length < 2) return { rows: [], fileErrors: ["CSV must include a header and at least one data row."] };
  if (parsed.length - 1 > maxRows) return { rows: [], fileErrors: [`CSV cannot contain more than ${maxRows} data rows.`] };

  const headers = parsed[0].map((header) => header.trim());
  const unknown = headers.filter((header) => !(importHeaders as readonly string[]).includes(header));
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  const fileErrors = [
    ...(!headers.includes("name") ? ['Missing required "name" column.'] : []),
    ...(!headers.includes("email") ? ['Missing required "email" column.'] : []),
    ...(unknown.length ? [`Unknown columns: ${[...new Set(unknown)].join(", ")}.`] : []),
    ...(duplicates.length ? [`Duplicate columns: ${[...new Set(duplicates)].join(", ")}.`] : []),
  ];
  if (fileErrors.length) return { rows: [], fileErrors };

  const seenEmails = new Set<string>();
  const rows = parsed.slice(1).map((values, index): MemberImportRow => {
    const rawData = Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""]));
    const email = normalizeInvitationEmail(rawData.email);
    const errors: string[] = [];
    if (!rawData.name || rawData.name.length > 160) errors.push("Name is required and must be at most 160 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) errors.push("Email address is invalid.");
    if (seenEmails.has(email)) errors.push("Email is duplicated in this file.");
    if (email) seenEmails.add(email);
    if (rawData.phone?.length > 30 || rawData.alternatePhone?.length > 30 || rawData.guardianPhone?.length > 30) errors.push("Phone values must be at most 30 characters.");
    if (rawData.joinedOn) {
      const joinedDate = new Date(`${rawData.joinedOn}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawData.joinedOn) || Number.isNaN(joinedDate.getTime()) || joinedDate.toISOString().slice(0, 10) !== rawData.joinedOn) {
        errors.push("Joined date must be a valid YYYY-MM-DD date.");
      }
    }
    if (values.length > headers.length) errors.push("Row contains more values than the header.");
    if (role === "STUDENT" && rawData.employeeCode) errors.push("Student rows cannot include employeeCode.");
    if (role === "TEACHER" && rawData.rollNumber) errors.push("Teacher rows cannot include rollNumber.");

    const nullable = (value: string | undefined) => value?.trim() || null;
    return {
      rowNumber: index + 2,
      rawData,
      normalizedData: errors.length ? null : {
        displayName: rawData.name.trim(),
        email,
        phone: nullable(rawData.phone),
        alternatePhone: nullable(rawData.alternatePhone),
        rollNumber: nullable(rawData.rollNumber),
        employeeCode: nullable(rawData.employeeCode),
        guardianName: nullable(rawData.guardianName),
        guardianPhone: nullable(rawData.guardianPhone),
        qualification: nullable(rawData.qualification),
        subjectSpecialization: nullable(rawData.subjectSpecialization),
        joinedOn: nullable(rawData.joinedOn),
      },
      errors,
    };
  });
  return { rows, fileErrors: [] };
}
