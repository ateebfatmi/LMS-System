import assert from "node:assert/strict";
import test from "node:test";
import { assignmentSubmissionState, isReleased, parseApprovedExternalUrl, safeLearningFilename, validateLearningUpload, validateSubmissionUpload } from "./index.ts";

test("accepts bounded learning documents and rejects executable or oversized files", () => {
  assert.deepEqual(validateLearningUpload({ name: "notes.pdf", type: "application/pdf", size: 4096 }), []);
  assert.match(validateLearningUpload({ name: "payload.html", type: "text/html", size: 100 })[0], /not supported/);
  assert.match(validateLearningUpload({ name: "notes.pdf", type: "application/pdf", size: 30 * 1024 * 1024 })[0], /25 MB/);
});

test("uses a smaller boundary for student submission files", () => {
  assert.deepEqual(validateSubmissionUpload({ name: "answer.pdf", type: "application/pdf", size: 8 * 1024 * 1024 }), []);
  assert.match(validateSubmissionUpload({ name: "answer.pdf", type: "application/pdf", size: 12 * 1024 * 1024 })[0], /10 MB/);
});

test("normalizes object names without retaining path traversal", () => {
  assert.equal(safeLearningFilename("../../Kinematics Notes (Final).PDF"), "Kinematics-Notes-Final.pdf");
  assert.equal(safeLearningFilename("💥"), "resource");
});

test("accepts only credential-free HTTPS resource links", () => {
  assert.equal(parseApprovedExternalUrl("http://example.com/video"), null);
  assert.equal(parseApprovedExternalUrl("https://user:pass@example.com/video"), null);
  assert.equal(parseApprovedExternalUrl("https://www.youtube.com/watch?v=abc")?.hostname, "www.youtube.com");
});

test("applies publication and scheduled release rules", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");
  assert.equal(isReleased(false, null, now), false);
  assert.equal(isReleased(true, "2026-10-17T11:00:00.000Z", now), true);
  assert.equal(isReleased(true, "2026-10-17T13:00:00.000Z", now), false);
});

test("derives assignment availability and late-submission state from server time", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");
  assert.equal(assignmentSubmissionState({ status: "PUBLISHED", availableFrom: null, dueAt: "2026-10-17T13:00:00.000Z", allowLate: false }, now), "OPEN");
  assert.equal(assignmentSubmissionState({ status: "PUBLISHED", availableFrom: null, dueAt: "2026-10-17T11:00:00.000Z", allowLate: true }, now), "LATE");
  assert.equal(assignmentSubmissionState({ status: "PUBLISHED", availableFrom: null, dueAt: "2026-10-17T11:00:00.000Z", allowLate: false }, now), "CLOSED");
  assert.equal(assignmentSubmissionState({ status: "DRAFT", availableFrom: null, dueAt: "2026-10-17T13:00:00.000Z", allowLate: true }, now), "UNAVAILABLE");
});
