# SIH–APAAR Validation Backend (prototype)

This is a **standalone first backend phase** prepared to match the uploaded React/Vite frontend's student fields and synthetic approval concepts. It does not modify or replace the frontend.

## Requirements
- Node.js 20+ recommended
- npm

## Run
```bash
npm install
copy .env.example .env
npm run dev
```
PowerShell can also use `Copy-Item .env.example .env`.

The API runs at `http://localhost:5000` by default. Set `FRONTEND_ORIGIN` in `.env` if Vite runs on another port.

## Endpoints
- `GET /api/health`
- `GET /api/v1/institutions`
- `POST /api/v1/validate` — JSON `{ "institutionId":"INST-001", "academicYear":"2026-2027", "records":[...] }`
- `POST /api/v1/validate-csv` — multipart form, CSV field named `file`; optional `institutionId` and `academicYear`
- `POST /api/v1/batches` — validate and keep a batch in memory
- `GET /api/v1/batches/:batchId`
- `GET /api/v1/college/:institutionId/summary`
- `GET /api/v1/aicte/summary`

## CSV fields
Recognizes common aliases for `studentId`, `studentName`, `apaarId`, `programme`, `yearOfStudy`, `category`, `ociStatus`, `foreignNationalStatus`, `supernumerarySeats`, and `admissionDate`.

## Important prototype limitations
- All reference data is synthetic and clearly marked demo-only.
- APAAR validation is format checking and lookup against a tiny synthetic registry only. This is **not** official APAAR identity verification.
- Intake comparisons are against rows in the submitted batch only; production must compare against repository-wide enrolment and the applicable approved seat rules for the relevant programme/year.
- Batch storage is in memory and resets on server restart.
- Authentication, role-based access control, persistent database, production-grade audit logging, rate limiting, and official provider integration are **not implemented yet**. Do not expose this server publicly.
- The existing frontend currently calls mock functions in `src/api/*.js` and stores demo state in browser storage. This backend is not wired into the frontend yet; that is a separate integration step. The current UI should continue to work as before.
