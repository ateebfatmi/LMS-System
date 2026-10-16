export const learningResourceMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const maximumLearningResourceBytes = 25 * 1024 * 1024;
export const maximumSubmissionBytes = 10 * 1024 * 1024;

export type LearningUpload = {
  name: string;
  type: string;
  size: number;
};

export function validateLearningUpload(file: LearningUpload): string[] {
  const errors: string[] = [];
  if (!file.name.trim() || file.name.length > 180) errors.push("File name is required and must be at most 180 characters.");
  if (!(learningResourceMimeTypes as readonly string[]).includes(file.type)) errors.push("File type is not supported.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maximumLearningResourceBytes) {
    errors.push("File must be between 1 byte and 25 MB.");
  }
  return errors;
}

export function validateSubmissionUpload(file: LearningUpload): string[] {
  const errors = validateLearningUpload(file).filter((error) => !error.includes("25 MB"));
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maximumSubmissionBytes) {
    errors.push("Submission file must be between 1 byte and 10 MB.");
  }
  return errors;
}

export function safeLearningFilename(name: string): string {
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  const stem = name.slice(0, extension ? -extension.length : undefined)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "resource";
  return `${stem}${extension}`;
}

export function parseApprovedExternalUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function isReleased(isPublished: boolean, releaseAt: string | null, now = new Date()): boolean {
  if (!isPublished) return false;
  if (!releaseAt) return true;
  const release = new Date(releaseAt);
  return !Number.isNaN(release.getTime()) && release.getTime() <= now.getTime();
}

export type AssignmentWindow = {
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  availableFrom: string | null;
  dueAt: string;
  allowLate: boolean;
};

export function assignmentSubmissionState(window: AssignmentWindow, now = new Date()): "UNAVAILABLE" | "OPEN" | "LATE" | "CLOSED" {
  if (window.status !== "PUBLISHED") return "UNAVAILABLE";
  const available = window.availableFrom ? new Date(window.availableFrom) : null;
  const due = new Date(window.dueAt);
  if (Number.isNaN(due.getTime()) || (available && Number.isNaN(available.getTime()))) return "UNAVAILABLE";
  if (available && available.getTime() > now.getTime()) return "UNAVAILABLE";
  if (due.getTime() >= now.getTime()) return "OPEN";
  return window.allowLate ? "LATE" : "CLOSED";
}
