# Security & Tenant Isolation Policy — PrepZii for Institutes

### 1. Fundamental Security Tenets

1. **Never Trust Client-Supplied Organization IDs**:
   - The browser cannot dictate tenant context. The backend resolves the user's verified identity and confirms an active membership row in PostgreSQL before executing any tenant-scoped operation.
2. **PostgreSQL Row-Level Security (RLS)**:
   - All tenant-owned tables enforce RLS policies linked to `auth.uid()`.
   - Direct database access from untrusted sources is rejected.
3. **Automated Cross-Tenant Isolation Tests**:
   - Continuous integration includes regression tests verifying that users from Institute B cannot read, mutate, or query records from Institute A.
4. **Authoritative Server-Side Exam Scoring**:
   - Students receive question prompts only.
   - Answer keys, negative marking schemes, and score calculations remain exclusively on the backend until results are formally published by the institute.
5. **Financial Ledger Integrity**:
   - Monetary amounts are strictly handled using exact decimal or integer currency units (paise/rupees) rather than floating point numbers.
   - Offline payment receipts and online Razorpay transactions maintain immutable reference identifiers.
   - Webhook signatures from Razorpay must be verified with cryptographic HMAC SHA256 before changing any subscription or installment status.
6. **No Hardcoded Secrets**:
   - Database credentials, Clerk secrets, and payment API keys reside strictly in environment variables.
   - `.env.example` provides sanitized template values only.
