import "server-only";

import { createHash, createHmac } from "node:crypto";

export function deriveInvitationToken(input: {
  secret: string;
  organizationId: string;
  email: string;
  role: string;
  idempotencyKey: string;
}): string {
  return createHmac("sha256", input.secret)
    .update([input.organizationId, input.email, input.role, input.idempotencyKey].join("\n"))
    .digest("base64url");
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
