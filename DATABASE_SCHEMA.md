# Database Schema Documentation — PrepZii for Institutes
## PostgreSQL Relational Models & Row-Level Security

All tables are strictly tenant-scoped using `organization_id` referencing the canonical `public.institutes(id)`.

---

### 1. Core Tenancy & Membership

#### `institutes`
- `id` (UUID, Primary Key)
- `name` (TEXT, Not Null)
- `slug` (TEXT, Unique, Indexed)
- `institute_type` (TEXT: 'COACHING', 'SCHOOL', 'TUTOR')
- `logo_url` (TEXT)
- `primary_color` (TEXT)
- `contact_email` (TEXT)
- `contact_phone` (TEXT)
- `address` (JSONB)
- `owner_user_id` (TEXT, Indexed)
- `status` (TEXT: 'ACTIVE', 'SUSPENDED')
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### `institute_members`
- `id` (UUID, Primary Key)
- `institute_id` (UUID, FK -> institutes.id)
- `user_id` (TEXT, Indexed)
- `role` (TEXT: 'OWNER', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
- `status` (TEXT: 'ACTIVE', 'INVITED', 'INACTIVE')
- `created_at` (TIMESTAMPTZ)

---

### 2. Academics, Batches & Campuses

#### `organization_batches`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> institutes.id)
- `name` (TEXT, Not Null)
- `target_exam` (TEXT: 'JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')
- `grade_level` (TEXT)
- `room_number` (TEXT)
- `is_active` (BOOLEAN, Default True)
- `created_at` (TIMESTAMPTZ)

#### `organization_batch_members`
- `id` (UUID, Primary Key)
- `batch_id` (UUID, FK -> organization_batches.id)
- `user_id` (TEXT, Indexed)
- `role` (TEXT: 'STUDENT', 'TEACHER')
- `roll_number` (TEXT)
- `enrolled_at` (TIMESTAMPTZ)

#### `organization_campuses` & `campus_rooms`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> institutes.id)
- `name` (TEXT)
- `capacity` (INTEGER)
- `facilities` (TEXT[] / JSONB: SMART_BOARD, AC, LAB_BENCHES, CCTV, etc.)
- `status` (TEXT: 'IN_USE', 'AVAILABLE', 'MAINTENANCE')

---

### 3. Admissions CRM

#### `organization_leads`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> institutes.id)
- `name` (TEXT, Not Null)
- `phone` (TEXT, Not Null)
- `email` (TEXT)
- `guardian_name` (TEXT)
- `guardian_phone` (TEXT)
- `target_exam` (TEXT)
- `target_batch_id` (UUID, FK -> organization_batches.id)
- `source` (TEXT: 'WALK_IN', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'NEWSPAPER', 'CAMPAIGN')
- `stage` (TEXT: 'NEW', 'CONTACTED', 'COUNSELLING_SCHEDULED', 'TRIAL_ATTENDED', 'CONVERTED', 'LOST')
- `follow_up_date` (DATE)
- `estimated_fee` (NUMERIC(12, 2))
- `notes` (TEXT)
- `converted_student_id` (TEXT)
- `converted_at` (TIMESTAMPTZ)

---

### 4. Fee Management & Ledger

#### `organization_student_fees`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> institutes.id)
- `student_id` (TEXT, Not Null)
- `batch_id` (UUID, FK -> organization_batches.id)
- `total_course_fee` (NUMERIC(12, 2))
- `concession_amount` (NUMERIC(12, 2), Default 0)
- `concession_reason` (TEXT)
- `net_payable` (NUMERIC(12, 2))
- `status` (TEXT: 'PAID', 'PARTIAL', 'OVERDUE', 'UNPAID')

#### `organization_fee_transactions`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, FK -> institutes.id)
- `student_id` (TEXT, Not Null)
- `amount` (NUMERIC(12, 2))
- `method` (TEXT: 'UPI', 'NET_BANKING', 'CARD', 'CHEQUE', 'CASH')
- `reference_number` (TEXT, Unique)
- `receipt_number` (TEXT, Unique)
- `recorded_by` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

### 5. Subscriptions & Platform Billing

#### `subscription_plans`
- `id` (TEXT, Primary Key: 'basic', 'growth', 'scale')
- `name` (TEXT)
- `price_inr` (INTEGER)
- `billing_interval` (TEXT: 'monthly', 'yearly')
- `student_limit` (INTEGER: 100, 500, 1500)
- `branch_limit` (INTEGER)
- `storage_gb` (INTEGER)
- `ai_credits_per_month` (INTEGER)
- `features` (JSONB)

#### `organization_subscriptions`
- `id` (UUID, Primary Key)
- `organization_id` (UUID, Unique, FK -> institutes.id)
- `plan_id` (TEXT, FK -> subscription_plans.id)
- `status` (TEXT: 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED')
- `current_period_start` / `current_period_end` (TIMESTAMPTZ)
- `razorpay_customer_id` / `razorpay_subscription_id` (TEXT)
