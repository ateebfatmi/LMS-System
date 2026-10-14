# DATABASE RECOVERY AND BACKUP RUNBOOK

**Target:** PrepZii for Institutes (PostgreSQL on Supabase & SQLite/Postgres Python Engine)  
**Classification:** Operational Runbook (P1 Production Readiness)

---

## 1. Objectives & Metrics

- **Recovery Point Objective (RPO):** Maximum 1 hour (via Supabase automated point-in-time continuous WAL archiving).
- **Recovery Time Objective (RTO):** Under 30 minutes for automated failover / point-in-time restore.

---

## 2. Automated Daily & Continuous Backup Policies

### 2.1 Managed PostgreSQL Backups
1. **Daily Physical Backups:** Executed automatically at 02:00 AM UTC with 30-day encrypted retention in multi-region cold storage.
2. **Point-In-Time Recovery (PITR):** Write-Ahead Logging (WAL) streaming allows point-in-time rollbacks to any second within the retention window.

### 2.2 Manual On-Demand Logical Snapshot (Before Risky Migrations)
Always dump the database schema and data before running manual DDL updates:
```bash
# Export full compressed SQL dump
pg_dump -h $PGHOST -U postgres -d prepzii_institutes -F c -b -v -f "prepzii_pre_migration_$(date +%Y%m%d_%H%M%S).dump"
```

---

## 3. Disaster Recovery Restoration Procedure

### Step 1: Declare Incident & Lock Ingress
Put the application in maintenance mode or scale web instances down to avoid concurrent writes during restore:
```bash
# E.g. update status in health check or pause routing at CDN / Cloudflare
```

### Step 2: Restore from Dump or Point-in-Time
For on-demand logical restores to a staging/recovery instance:
```bash
pg_restore -h $RECOVERY_PGHOST -U postgres -d prepzii_institutes -v "prepzii_pre_migration_YYYYMMDD_HHMMSS.dump"
```

### Step 3: Run Integrity & Tenant Isolation Verification
Execute automated test verification script against restored instance:
```bash
python3 -m pytest backend/tests/test_tenant_isolation.py
```

### Step 4: Re-point `DATABASE_URL` & Verify Health Checks
Update `DATABASE_URL` secrets in production orchestration and trigger health check:
```bash
curl -I https://api.prepzii.com/api/v1/health
# Expected: HTTP 200 {"status": "healthy", "database": "connected"}
```
