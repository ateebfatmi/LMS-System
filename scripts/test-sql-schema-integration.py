#!/usr/bin/env python3
"""
Prepzii B2B LMS - Disposable SQL Schema Integration Test
Simulates Postgres relational schema integrity, foreign keys, constraints,
and transaction rollback boundaries in an isolated, disposable database.
"""

import sqlite3
import sys

def run_tests():
    print("=================================================================")
    print("🧪 DISPOSABLE SQL DATABASE INTEGRATION & CONSTRAINT TEST SUITE")
    print("=================================================================\n")

    # Connect to in-memory disposable database
    conn = sqlite3.connect(":memory:")
    conn.execute("PRAGMA foreign_keys = ON;")
    cursor = conn.cursor()

    passed = 0
    total = 0

    def assert_test(name, condition, error_msg=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  ✓ {name}")
        else:
            print(f"  ✗ {name}: {error_msg}")
            sys.exit(1)

    print("Step 1: Initializing Canonical Consumer Prepzii Tables...")
    cursor.executescript("""
        CREATE TABLE institutes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            logo_url TEXT,
            owner_user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE institute_members (
            id TEXT PRIMARY KEY,
            institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL DEFAULT 'STUDENT',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (institute_id, user_id)
        );

        CREATE TABLE institute_batches (
            id TEXT PRIMARY KEY,
            institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            campus_id TEXT,
            academic_year_id TEXT,
            name TEXT NOT NULL,
            exam TEXT,
            target_year INTEGER,
            grade_level TEXT,
            room_number TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE institute_batch_members (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL REFERENCES institute_batches(id) ON DELETE CASCADE,
            member_id TEXT NOT NULL REFERENCES institute_members(id) ON DELETE CASCADE,
            roll_number TEXT,
            role TEXT NOT NULL DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'TEACHER')),
            enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (batch_id, member_id)
        );

        CREATE TABLE questions (
            id TEXT PRIMARY KEY,
            exam TEXT NOT NULL,
            subject TEXT NOT NULL,
            chapter TEXT NOT NULL,
            topic TEXT,
            difficulty TEXT NOT NULL,
            question_type TEXT,
            question_text TEXT NOT NULL,
            question_image TEXT,
            option_a TEXT,
            option_b TEXT,
            option_c TEXT,
            option_d TEXT,
            correct_option TEXT NOT NULL,
            explanation TEXT,
            marks INTEGER DEFAULT 4,
            negative_marks REAL DEFAULT 1.0,
            is_active INTEGER DEFAULT 1,
            source_type TEXT NOT NULL DEFAULT 'CURATED',
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE pyq_questions (
            id TEXT PRIMARY KEY,
            question_text TEXT,
            option_a TEXT,
            option_b TEXT,
            option_c TEXT,
            option_d TEXT,
            correct_option TEXT,
            numerical_answer REAL,
            numerical_min REAL,
            numerical_max REAL,
            marks_positive REAL DEFAULT 4,
            marks_negative REAL DEFAULT 1,
            exam TEXT NOT NULL,
            subject TEXT NOT NULL,
            chapter TEXT NOT NULL,
            year INTEGER,
            status TEXT DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE institute_tests (
            id TEXT PRIMARY KEY,
            institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PUBLISHED',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE institute_test_questions (
            id TEXT PRIMARY KEY,
            institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            institute_test_id TEXT NOT NULL REFERENCES institute_tests(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            question_order INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (institute_test_id, question_id)
        );

        CREATE TABLE test_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            test_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE test_attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            test_id TEXT NOT NULL,
            session_id TEXT REFERENCES test_sessions(id) ON DELETE CASCADE,
            score REAL NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE institute_test_attempts (
            id TEXT PRIMARY KEY,
            institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            institute_test_id TEXT NOT NULL REFERENCES institute_tests(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            session_id TEXT REFERENCES test_sessions(id) ON DELETE SET NULL,
            attempt_id TEXT REFERENCES test_attempts(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'SUBMITTED',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            submitted_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    assert_test("Canonical consumer schema initialized", True)

    print("\nStep 2: Initializing B2B LMS Reconciled Tables...")
    cursor.executescript("""
        CREATE TABLE organization_campuses (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            address TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (organization_id, name)
        );

        CREATE TABLE organization_academic_years (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            starts_on DATE NOT NULL,
            ends_on DATE NOT NULL CHECK (ends_on > starts_on),
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (organization_id, name)
        );

        CREATE TABLE organization_test_schedules (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            test_id TEXT NOT NULL REFERENCES institute_tests(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES institute_batches(id) ON DELETE CASCADE,
            starts_at TIMESTAMP NOT NULL,
            ends_at TIMESTAMP NOT NULL CHECK (ends_at > starts_at),
            is_strict_timing INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE organization_attendance_sessions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES institute_batches(id) ON DELETE CASCADE,
            session_date DATE NOT NULL,
            marked_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (batch_id, session_date)
        );

        CREATE TABLE organization_attendance_records (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES organization_attendance_sessions(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (session_id, student_id)
        );

        CREATE TABLE organization_cbt_sessions (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            schedule_id TEXT NOT NULL REFERENCES organization_test_schedules(id) ON DELETE CASCADE,
            student_user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED')),
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            submitted_at TIMESTAMP,
            total_score REAL,
            max_score REAL,
            rank INTEGER,
            percentile REAL,
            marked_for_review TEXT DEFAULT '[]',
            visited_questions TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (schedule_id, student_user_id)
        );

        CREATE TABLE organization_cbt_answers (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES organization_cbt_sessions(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
            selected_option_ids TEXT DEFAULT '[]',
            numerical_value REAL,
            time_spent_seconds INTEGER NOT NULL DEFAULT 0,
            status TEXT DEFAULT 'unanswered' CHECK (status IN ('correct', 'incorrect', 'unanswered', 'partially_correct')),
            score_awarded REAL DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (session_id, question_id)
        );

        CREATE TABLE organization_fee_plans (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            target_exam TEXT NOT NULL CHECK (target_exam IN ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
            total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
            default_installments INTEGER NOT NULL DEFAULT 3 CHECK (default_installments BETWEEN 1 AND 12),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (organization_id, name)
        );

        CREATE TABLE organization_student_fees (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            student_user_id TEXT NOT NULL,
            fee_plan_id TEXT REFERENCES organization_fee_plans(id) ON DELETE RESTRICT,
            batch_id TEXT REFERENCES institute_batches(id) ON DELETE SET NULL,
            base_amount_paise INTEGER NOT NULL CHECK (base_amount_paise >= 0),
            discount_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_paise >= 0),
            final_amount_paise INTEGER NOT NULL CHECK (final_amount_paise >= 0),
            total_paid_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_paid_paise >= 0),
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
            assigned_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (organization_id, student_user_id, fee_plan_id)
        );

        CREATE TABLE organization_fee_installments (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
            student_fee_id TEXT NOT NULL REFERENCES organization_student_fees(id) ON DELETE CASCADE,
            installment_number INTEGER NOT NULL CHECK (installment_number > 0),
            due_date DATE NOT NULL,
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            paid_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_paise >= 0),
            status TEXT NOT NULL DEFAULT 'DUE' CHECK (status IN ('DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (student_fee_id, installment_number)
        );

        -- Backward Compatibility Views
        CREATE VIEW organization_batches AS
        SELECT
            id,
            institute_id AS organization_id,
            campus_id,
            academic_year_id,
            name,
            exam AS target_exam,
            grade_level,
            room_number,
            is_active,
            created_at
        FROM institute_batches;
    """)
    assert_test("B2B reconciled tables and views initialized", True)

    print("\nStep 3: Testing Foreign Key Referential Integrity & Constraints...")

    # Insert valid seed institution
    cursor.execute("INSERT INTO institutes (id, name, slug, owner_user_id) VALUES ('inst-apex', 'Apex Institute', 'apex', 'usr-dir-1');")
    cursor.execute("INSERT INTO institute_members (id, institute_id, user_id, role) VALUES ('mem-std-1', 'inst-apex', 'usr-std-1', 'STUDENT');")
    cursor.execute("INSERT INTO institute_batches (id, institute_id, name, exam, target_year) VALUES ('bat-jee-1', 'inst-apex', 'JEE Titans', 'JEE_ADVANCED', 2026);")
    cursor.execute("INSERT INTO institute_batch_members (id, batch_id, member_id, roll_number) VALUES ('bm-1', 'bat-jee-1', 'mem-std-1', 'APX-001');")

    # 1. Foreign Key Rejection on Batch Member referencing non-existent member
    try:
        cursor.execute("INSERT INTO institute_batch_members (id, batch_id, member_id) VALUES ('bm-invalid', 'bat-jee-1', 'mem-non-existent');")
        assert_test("FK constraint rejection on non-existent member_id", False, "Should have failed foreign key constraint")
    except sqlite3.IntegrityError:
        assert_test("FK constraint correctly rejects non-existent member_id", True)

    # 2. Foreign Key Rejection on Test Schedule referencing non-existent test
    try:
        cursor.execute("INSERT INTO organization_test_schedules (id, organization_id, test_id, batch_id, starts_at, ends_at) VALUES ('sched-inv', 'inst-apex', 'tst-non-existent', 'bat-jee-1', '2026-10-25 09:00:00', '2026-10-25 12:00:00');")
        assert_test("FK constraint rejection on non-existent test_id", False, "Should have failed foreign key constraint")
    except sqlite3.IntegrityError:
        assert_test("FK constraint correctly rejects non-existent test_id", True)

    # 3. Foreign Key Rejection on Test Schedule referencing non-existent batch
    cursor.execute("INSERT INTO institute_tests (id, institute_id, title) VALUES ('tst-phy-1', 'inst-apex', 'Physics Weekly Mock');")
    try:
        cursor.execute("INSERT INTO organization_test_schedules (id, organization_id, test_id, batch_id, starts_at, ends_at) VALUES ('sched-inv-batch', 'inst-apex', 'tst-phy-1', 'bat-non-existent', '2026-10-25 09:00:00', '2026-10-25 12:00:00');")
        assert_test("FK constraint rejection on non-existent batch_id", False, "Should have failed foreign key constraint")
    except sqlite3.IntegrityError:
        assert_test("FK constraint correctly rejects non-existent batch_id", True)

    # 4. Valid Test Schedule creation
    cursor.execute("INSERT INTO organization_test_schedules (id, organization_id, test_id, batch_id, starts_at, ends_at) VALUES ('sched-1', 'inst-apex', 'tst-phy-1', 'bat-jee-1', '2026-10-25 09:00:00', '2026-10-25 12:00:00');")
    assert_test("Valid test schedule references institute_tests and institute_batches successfully", True)

    # 5. Check Constraint on End Time > Start Time
    try:
        cursor.execute("INSERT INTO organization_test_schedules (id, organization_id, test_id, batch_id, starts_at, ends_at) VALUES ('sched-bad-time', 'inst-apex', 'tst-phy-1', 'bat-jee-1', '2026-10-25 12:00:00', '2026-10-25 09:00:00');")
        assert_test("Check constraint ends_at > starts_at", False, "Should have failed check constraint")
    except sqlite3.IntegrityError:
        assert_test("Check constraint ends_at > starts_at enforced successfully", True)

    # 6. PYQ and Question referential integrity check
    cursor.execute("INSERT INTO questions (id, exam, subject, chapter, difficulty, question_text, correct_option) VALUES ('q-canonical-1', 'JEE_ADVANCED', 'Physics', 'Mechanics', 'HARD', 'Sample text', 'a');")
    cursor.execute("INSERT INTO pyq_questions (id, question_text, exam, subject, chapter, year) VALUES ('pyq-raw-99', 'Raw PYQ', 'JEE Main', 'Physics', 'Optics', 2024);")

    # Linking canonical question to test_questions succeeds
    cursor.execute("INSERT INTO institute_test_questions (id, institute_id, institute_test_id, question_id, question_order) VALUES ('tq-1', 'inst-apex', 'tst-phy-1', 'q-canonical-1', 1);")
    assert_test("institute_test_questions links to canonical public.questions", True)

    # Linking unsynchronized PYQ to institute_test_questions FAILS foreign key constraint
    try:
        cursor.execute("INSERT INTO institute_test_questions (id, institute_id, institute_test_id, question_id, question_order) VALUES ('tq-pyq-bad', 'inst-apex', 'tst-phy-1', 'pyq-raw-99', 2);")
        assert_test("Unsynchronized PYQ rejected by foreign key constraint", False, "Should have failed foreign key constraint")
    except sqlite3.IntegrityError:
        assert_test("Unsynchronized PYQ cannot be attached directly without synchronization (FK enforced)", True)

    # Perform Controlled Synchronization of PYQ into public.questions
    cursor.execute("""
        INSERT INTO questions (id, exam, subject, chapter, difficulty, question_text, correct_option, source_type)
        SELECT id, exam, subject, chapter, 'MEDIUM', question_text, coalesce(correct_option, 'a'), 'PYQ'
        FROM pyq_questions WHERE id = 'pyq-raw-99';
    """)
    # Now linking synchronized PYQ succeeds!
    cursor.execute("INSERT INTO institute_test_questions (id, institute_id, institute_test_id, question_id, question_order) VALUES ('tq-pyq-good', 'inst-apex', 'tst-phy-1', 'pyq-raw-99', 2);")
    assert_test("Synchronized PYQ links to institute_test_questions cleanly via standard foreign key", True)

    # 7. Unique Constraint: duplicate question in same test
    try:
        cursor.execute("INSERT INTO institute_test_questions (id, institute_id, institute_test_id, question_id, question_order) VALUES ('tq-dup', 'inst-apex', 'tst-phy-1', 'q-canonical-1', 3);")
        assert_test("Duplicate question in same test rejected", False, "Should have failed unique constraint")
    except sqlite3.IntegrityError:
        assert_test("Unique constraint (institute_test_id, question_id) prevents duplicate questions in test", True)

    # 8. Check Constraint: Fee Plan positive amount and valid installments
    try:
        cursor.execute("INSERT INTO organization_fee_plans (id, organization_id, name, target_exam, total_amount_paise, default_installments) VALUES ('fp-bad', 'inst-apex', 'Bad Plan', 'JEE_MAIN', -500, 3);")
        assert_test("Fee plan negative amount check", False, "Should have failed check constraint")
    except sqlite3.IntegrityError:
        assert_test("Check constraint total_amount_paise >= 0 enforced", True)

    try:
        cursor.execute("INSERT INTO organization_fee_plans (id, organization_id, name, target_exam, total_amount_paise, default_installments) VALUES ('fp-bad-inst', 'inst-apex', 'Bad Plan 2', 'JEE_MAIN', 100000, 15);")
        assert_test("Fee plan installments check (1-12)", False, "Should have failed check constraint")
    except sqlite3.IntegrityError:
        assert_test("Check constraint default_installments between 1 and 12 enforced", True)

    # 9. Backward Compatibility View Verification
    view_rows = cursor.execute("SELECT id, organization_id, name, target_exam FROM organization_batches WHERE id = 'bat-jee-1';").fetchall()
    assert_test("organization_batches compatibility view queries canonical institute_batches cleanly", len(view_rows) == 1 and view_rows[0][1] == 'inst-apex' and view_rows[0][3] == 'JEE_ADVANCED')

    print("\nStep 4: Testing Transaction Boundaries & Rollback Safety...")
    # Transaction Rollback Test: When multiple statements run in a transaction and one fails,
    # the entire transaction must roll back cleanly.
    conn.isolation_level = None # Autocommit off
    cursor.execute("BEGIN TRANSACTION;")
    cursor.execute("INSERT INTO organization_campuses (id, organization_id, name) VALUES ('cmp-1', 'inst-apex', 'North Campus');")

    try:
        # Deliberate constraint failure in transaction
        cursor.execute("INSERT INTO organization_attendance_sessions (id, organization_id, batch_id, session_date, marked_by) VALUES ('att-fail', 'inst-apex', 'bat-non-existent', '2026-10-23', 'usr-dir-1');")
        cursor.execute("COMMIT;")
    except sqlite3.IntegrityError:
        cursor.execute("ROLLBACK;")

    # Verify that 'cmp-1' was rolled back and does not exist
    cmp_exists = cursor.execute("SELECT count(*) FROM organization_campuses WHERE id = 'cmp-1';").fetchone()[0]
    assert_test("Transaction rollback cleanly aborts uncommitted writes on constraint violation", cmp_exists == 0)

    # On Delete Cascade Test: Deleting institute cascades to batches, schedules, and attempts
    cursor.execute("DELETE FROM institutes WHERE id = 'inst-apex';")
    remaining_batches = cursor.execute("SELECT count(*) FROM institute_batches WHERE id = 'bat-jee-1';").fetchone()[0]
    remaining_schedules = cursor.execute("SELECT count(*) FROM organization_test_schedules WHERE id = 'sched-1';").fetchone()[0]
    assert_test("ON DELETE CASCADE cleanly purges tenant-owned child records across reconciled tables", remaining_batches == 0 and remaining_schedules == 0)

    print(f"\n=================================================================")
    print(f"🎉 All {passed} / {total} Disposable SQL Database Integration Tests PASSED!")
    print(f"=================================================================\n")

if __name__ == "__main__":
    run_tests()
