# APAAR-Based Student Data Management & Verification Platform
### Smart India Hackathon 2026 Prototype

An automated validation, monitoring, and verification layer for the **All India Council for Technical Education (AICTE)**. This platform standardizes student enrolment data ingested from institutional ERPs, runs explainable validation rules against official AICTE Approval Masters, tracks discrepancies through a closed-loop issue workbench, and facilitates student-consented external credential verification.

---

## Key Principles & Scope Boundaries

1. **Validation & Monitoring Layer:** Does **NOT** replace college ERPs. Colleges ingest data via CSV upload with column-mapping or REST API.
2. **Format Verification:** Does **NOT** generate APAAR IDs (issued exclusively by the Government of India). Checks verify 12-digit numeric structure (*format-checked, not identity-verified*).
3. **Immutable Rulebook:** Never edits approved intake. Ingestion compares student admissions against AICTE Approval Master quotas.
4. **Honesty Rules:**
   - `ACCEPTED` is not `VERIFIED` (*Accepted = internal validation passed; Verified = confirmed by an authorized source*).
   - Cross-institution duplicates are *flagged for review*, never labeled fraud.
   - Invalid rows are never counted as accepted into the repository.
   - DigiLocker/APAAR connections are marked *simulated / demo mode*.

---

## Quick Start (Fresh Clone)

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Run automated acceptance test suite
npm test
```

The portal is accessible locally at `http://localhost:5173`.

---

## Demo Accounts & Role Logins

The landing page features **three dedicated login cards** with one-click demo credentials:

| Role | Demo Identifier | Demo Password / OTP | Default Portal Route |
| :--- | :--- | :--- | :--- |
| **College (PICT Pune)** | `pict.admin@college.edu` | `demo123` | `/college/dashboard` |
| **AICTE Central Reviewer** | `aicte.central@gov.in` | `demo123` | `/aicte/dashboard` |
| **Student (Aarav Sharma)** | `1111 2222 3333` | `7492` *(demo mode)* | `/student/record` |
| **Public Verifier** | *No login required* | *N/A* | `/verify/111122223333` |

### College portal tabs
After college login the landing page is **Intake Dashboard**. Tab order:

1. Intake Dashboard (`/college/dashboard`)
2. Add Students (`/college/add-students`) — manual single or few-row entry into staging
3. Batch Upload & Ingestion (`/college/upload`)
4. Validate Records (`/college/validate`) — runs the existing validation engine on staged records
5. Issue Workbench (`/college/workbench`)
6. Compliance Reports (`/college/reports`)

`/college` redirects to `/college/dashboard`. Previous paths (`/college/upload`, `/college/workbench`, `/college/dashboard`, `/college/reports`) still work.

### Route Guards & Compliance Audit Log
Any attempt by a user to access a route belonging to another role (e.g. a College user attempting `/aicte/*`) is intercepted by `ProtectedRoute`, presents an accessible **Access Denied** notice, and records an `UNAUTHORIZED_ACCESS_ATTEMPT` event with timestamp into the Mock Compliance Audit Log.

---

## Phase 2 Capabilities: Correction Loop, Escalation, Dashboards, & Reports

### 1. Correction Loop
- **Owner & Action:** Every issue has an assigned owner (*Institution Data Officer*, *Admissions Officer*, or *AICTE Central Reviewer*), a required action in plain sentence-case language, and a due date (default 7 days, labelled *prototype setting*).
- **Fix Dialog:** College users click **Fix Record** on any flagged row to inspect the planted diagnostic reason and evidence, edit the fields (APAAR ID, PRN, course, category, year), or click **Apply Valid Sample Fix**.
- **Automated Revalidation:** On resubmission, the validation engine revalidates the record. Fixed rows move to `READY_TO_ACCEPT` with issue status `RESOLVED`. Faulty rows stay `ACTION_REQUIRED`.
- **Batch Acceptance:** Clicking **Accept Valid Records** transitions only `READY_TO_ACCEPT` records to `ACCEPTED`. Invalid rows are never counted as accepted.

### 2. Auto-Escalation & AICTE Review Queue
- **Simulate 8 Days Passing:** A dedicated demo button on both the College and AICTE workbenches simulates the passage of 8 days, auto-escalating all unresolved issues past their 7-day deadline to `OVERDUE` and `ESCALATED`, reassigning their owner to the *AICTE Central Reviewer*.
- **Issue Priority Sorting:** Issues are prioritized by severity and impact (High errors & overdue cases appear first).
- **AICTE Adjudication Queue (`/aicte/workbench`):**
  - AICTE Central Reviewers inspect cross-institution conflicts and escalated cases across institutions.
  - Reviewers can record an adjudication note and choose:
    - **Evidence Confirmed:** Resolves the discrepancy and transitions the record to `READY_TO_ACCEPT`.
    - **Send Back to College:** Returns the discrepancy to `ACTION_REQUIRED` for institutional re-examination.
  - Statutory notice displayed: *The platform never edits approved intake and never grants exceptions itself.*

### 3. Real-Time Dashboards (No Refresh Needed)
- **College Dashboard (`/college/dashboard`):**
  - Displays approved intake (420), accepted enrolment (only `ACCEPTED` rows count!), utilisation %, open anomalies, and category counts (General, OBC, SC, ST, EWS, TFWS, NRI/FN vs. 5-seat limit).
  - Departmental intake vs. enrolment table with **live utilisation progress bars that turn bold red if over 100%**.
- **AICTE National Dashboard (`/aicte/dashboard`):**
  - National overview with an **Institution Filter dropdown** (*All Institutions*, *PICT Pune*, *COEP Tech*, *VJTI Mumbai*).
  - Total approved seats vs. accepted enrolment, national utilisation %, pending review count, and escalated count.
  - Per-institution summary table with comparative utilisation bars.

### 4. Compliance Reports & Multi-Institution Data Isolation
- **Downloadable Intake CSV:** Institution, programme, year, approved intake, accepted enrolment, utilisation, seat categories.
- **Downloadable Anomaly CSV:** Batch, row, issue type, severity, reason, owner, status, due date.
- **Printable PDF Preview:** Formatted printable compliance documents.
- **Data Isolation Guard:** College users are strictly restricted to their own institution's data (`INST-001`). Any attempt to download another college's report is blocked with a 403 Forbidden alert and logged to the central audit log.
- **AICTE Central Reports:** AICTE reviewers can download consolidated national intake reports and the complete compliance audit trail.

---

## Automated Acceptance Test Results

Run `npm test` in the terminal to execute the test suite:
```
> sih@0.0.0 test
> node --test tests/acceptanceTests.test.js

✔ Acceptance Test 1: Resubmitting a corrected row revalidates, updates status and refreshes dashboard numbers
✔ Acceptance Test 2: A mixed valid/invalid batch: invalid rows are not counted as accepted
✔ Acceptance Test 3: Overdue issue escalates to the AICTE reviewer
✔ Acceptance Test 4: 125 enrolled vs 120 approved intake is flagged as potential excess
✔ Acceptance Test 5: College A requesting College B's data or report is denied and logged
✔ Acceptance Test 6: Intake check compares per institution, programme, year and seat category
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

---

## Build Phases

- [x] **Phase 1:** Landing page, three-card login, route guards, College Upload and Issue workbench with the faulty mock batch.
- [x] **Phase 2:** Correction loop, automatic revalidation, auto-escalation ("Simulate 8 days passing"), AICTE review queue & adjudication, College & AICTE dashboards, reports, and automated acceptance tests.
- [ ] **Phase 3:** Student screens, consent management, QR code verification, public verify page, certificate preview, audit log explorer.
- [ ] **Phase 4:** Polish, accessibility pass, complete demo-story walkthrough.
