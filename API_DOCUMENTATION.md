# API Documentation — PrepZii for Institutes
## REST API Specification (v1)

Base URL: `/api/v1` (Python FastAPI service) and `/api` (Next.js server routes)

All authenticated requests must supply the verified authorization header:
```http
Authorization: Bearer <clerk_or_supabase_jwt>
X-Organization-ID: <organization_uuid>
```

---

### 1. Health & Discovery

#### `GET /api/v1/health`
Returns service status, version, and active environment.
```json
{
  "status": "healthy",
  "service": "PrepZii for Institutes API",
  "version": "1.0.0",
  "environment": "development"
}
```

---

### 2. Admissions CRM API

#### `GET /api/v1/crm/leads`
Lists leads for the active organization. Requires `OWNER` or `COACHING_ADMIN`.

#### `POST /api/v1/crm/leads`
Creates a new admission lead / walk-in inquiry.
Request Body:
```json
{
  "name": "Aditya Pratapsingh",
  "phone": "+91 98234 56789",
  "email": "aditya.p@gmail.com",
  "guardian_name": "Col. Rajesh Pratapsingh",
  "target_exam": "JEE_ADVANCED",
  "source": "WALK_IN",
  "estimated_fee": 145000,
  "follow_up_date": "2026-10-18",
  "notes": "Interested in Top 500 batch"
}
```

#### `PATCH /api/v1/crm/leads/{lead_id}`
Updates lead stage or follow-up notes.
```json
{
  "stage": "COUNSELLING_SCHEDULED",
  "follow_up_date": "2026-10-20"
}
```

#### `POST /api/v1/crm/leads/{lead_id}/convert`
Enrolls lead into a student batch with official roll number. Prevents duplicate conversion.
```json
{
  "roll_number": "APX-2026-1215",
  "batch_id": "batch-1",
  "target_exam": "JEE_ADVANCED"
}
```

---

### 3. Assessment & Exam Scoring Engine

#### `POST /api/v1/assessments/evaluate`
Server-side authoritative evaluation of CBT test attempts. Answer keys are evaluated strictly on the backend.
Request Body:
```json
{
  "questions": [
    {
      "id": "q1",
      "kind": "single_choice",
      "marks": 4.0,
      "negative_marks": 1.0,
      "correct_option_ids": ["opt-b"]
    },
    {
      "id": "q2",
      "kind": "multiple_choice",
      "marks": 4.0,
      "negative_marks": 2.0,
      "correct_option_ids": ["opt-a", "opt-b", "opt-c"],
      "partial_marking": true
    },
    {
      "id": "q3",
      "kind": "numerical",
      "marks": 4.0,
      "negative_marks": 0.0,
      "correct_number": 9.8,
      "numerical_tolerance": 0.05
    }
  ],
  "submissions": [
    { "question_id": "q1", "selected_option_ids": ["opt-b"], "time_spent_seconds": 65 },
    { "question_id": "q2", "selected_option_ids": ["opt-a", "opt-b"], "time_spent_seconds": 110 },
    { "question_id": "q3", "number": 9.82, "time_spent_seconds": 90 }
  ]
}
```
Response Body:
```json
{
  "total_score": 10.0,
  "maximum_score": 12.0,
  "accuracy_percentage": 100.0,
  "correct_count": 2,
  "incorrect_count": 0,
  "unanswered_count": 0,
  "partially_correct_count": 1,
  "answers": [
    { "question_id": "q1", "status": "correct", "score": 4.0, "time_spent_seconds": 65 },
    { "question_id": "q2", "status": "partially_correct", "score": 2.0, "time_spent_seconds": 110 },
    { "question_id": "q3", "status": "correct", "score": 4.0, "time_spent_seconds": 90 }
  ]
}
```

---

### 4. Public Marketing API

#### `POST /api/demo-request`
Validates and registers demo requests from coaching directors.
```json
{
  "fullName": "Dr. Rajesh Agrawal",
  "instituteName": "Target Point Academy",
  "email": "director@targetpoint.in",
  "phone": "+91 98765 43210",
  "city": "Kota, Rajasthan",
  "studentCount": "500-1500",
  "notes": "Need multi-campus room allocator and CBT test series"
}
```
