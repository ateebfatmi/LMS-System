# INCIDENT RESPONSE PROCEDURE

**Target:** PrepZii for Institutes  
**Classification:** Operational Security & Reliability

---

## 1. Severity Classifications

- **SEV-0 (Critical Blocker):**
  - Cross-tenant data leakage or isolation breach.
  - Full system downtime (cannot submit exams or authenticate).
  - Data corruption or credential compromise.
  - *Response Time:* Immediate (< 15 mins).
- **SEV-1 (High Impact):**
  - Major feature failure (e.g. payment webhook processing delayed, marks export failing).
  - Performance degradation affecting > 25% of coaching institutes.
  - *Response Time:* < 1 hour.
- **SEV-2 (Medium/Low):**
  - Non-critical bug with available workaround.
  - Minor UI styling or non-blocking export defect.
  - *Response Time:* Next business day.

---

## 2. Response Workflow

1. **Triage & Containment:**
   - Acknowledge alert, declare incident commander (IC).
   - If security vulnerability, immediately revoke affected API keys or isolate tenant.
2. **Investigation & Hotfix:**
   - Inspect structured logs using correlation trace IDs.
   - Develop minimal targeted patch on a hotfix branch.
   - Run automated adversarial tests (`npm test` and `python3 -m pytest backend/tests`).
3. **Deployment & Verification:**
   - Deploy hotfix through CI pipeline.
   - Verify health check endpoints (`/api/v1/health`).
4. **Post-Mortem & Remediation:**
   - Document root cause within 48 hours.
   - Implement regression tests to prevent recurrence.
