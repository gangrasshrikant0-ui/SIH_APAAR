# APAAR student data platform

## Quick start
1. Install Node.js 18+ and npm 9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` (`copy .env.example .env` on Windows).
4. Run `npm run demo:reset` for synthetic demo data; the app detects the new seed and resets its local mock store once.
5. Run `npm run dev:all` to start the API and Vite frontend together.
6. Open `http://localhost:5173`.
7. Use `npm test` and `npm run test:backend` to verify the clone.

## Prototype status

The Express/SQLite ingestion, persistence, issue storage, status synchronization,
role checks, audit rows, review queue, APAAR journey lookups, and accepted-record
repository are real local application behavior. The dashboards, reports, approval
master, much of the staging workflow, and local audit history still use browser
mock data and are intentionally not migrated. Authentication is mock header auth
(`X-Institution-Id`, `X-Role`, and `X-Actor`), not production security.

APAAR values are checked for 12-digit format only. Demo mode uses a simulated
registry and mock verification records. There is no live AICTE, APAAR, or
DigiLocker connection, and no APAAR identity verification is claimed.

## Demo accounts

| Login | Role | Institution |
|---|---|---|
| `pict.admin@college.edu` / `demo123` | College | INST-001, PICT Pune |
| `aicte.central@gov.in` / `demo123` | AICTE reviewer | AICTE-HQ |
| `verifier@credential-review.example` / `demo123` | External verifier | VERIFIER-001 |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev:all` | Starts backend on 3001 and Vite on 5173 using a cross-platform Node script |
| `npm run dev` | Frontend only |
| `npm run server` | Backend only |
| `npm run demo:reset` | Recreates SQLite and loads 60 synthetic records |
| `npm test` | Frontend acceptance tests |
| `npm run test:backend` | Backend/API tests |
| `npm run lint` | Oxlint |
| `npm run build` | Production build |

`data/apaar.sqlite` and its sidecars are ignored and created automatically.
`better-sqlite3` is the only native dependency; npm installs its platform
binding for the current machine.

## API endpoints

Bulk ingestion accepts CSV and XLSX (first sheet, first row as headers), up to 2 MB. XLSX parsing uses the read-only `read-excel-file` package. The upload response includes a `batchId`; batch status and issues are available to the owning institution at `GET /api/batches/:id` and `GET /api/batches/:id/issues`.

All institution ingestion/update calls require `X-Institution-Id`.
AICTE reads and review require `X-Role: AICTE`; institution reads and updates
require `X-Role: INSTITUTION`.

### Individual upload

```powershell
curl.exe -X POST http://localhost:3001/api/students `
  -H "Content-Type: application/json" -H "X-Institution-Id: INST-001" `
  -d "{\"studentId\":\"S-001\",\"studentName\":\"Asha Rao\",\"apaarId\":\"111122223333\",\"programme\":\"Computer Engineering\",\"yearOfStudy\":\"Year 1\"}"
```

### Bulk upload

```powershell
curl.exe -X POST http://localhost:3001/api/students/bulk `
  -H "X-Institution-Id: INST-001" `
  -F "file=@samples/batch_clean.csv"
```

The response contains `total`, `storedClean`, `storedFlagged`, `rejected`,
`records`, persisted `issues`, and row-level `errors`. Row 2 is the first CSV
data row. Storage-critical failures are rejected; business-rule failures are
stored as `ACTION_REQUIRED` or `PENDING_REVIEW`.

### Status synchronization

```powershell
curl.exe -X POST http://localhost:3001/api/students/INGEST-1/outcome `
  -H "Content-Type: application/json" -H "X-Institution-Id: INST-001" `
  -H "X-Role: INSTITUTION" `
  -d "{\"status\":\"READY_TO_ACCEPT\",\"issues\":[]}"
```

Related endpoints are `GET /api/meta`, `GET /api/aicte/dashboard`, `GET
/api/college/dashboard`, `GET /api/aicte/reports/intake`, `GET
/api/college/reports/summary`, `PATCH /api/students/:id`, `POST
/api/students/:id/accept`, `POST /api/aicte/students/:id/review`, `GET
/api/aicte/repository`, `GET /api/aicte/review-queue`, `GET
/api/aicte/students/by-apaar/:apaarId`, `GET /api/students/by-apaar/:apaarId`,
and `GET /api/aicte/audit`.

## Limitations

- Mock data remains in approval-master presentation details, most local
  staging screens, and some secondary dashboard/report widgets; the primary
  dashboard totals and intake/report rows now read from SQLite.
- Header authentication and role checks are demonstration controls, not secure
  identity, session, or authorization infrastructure.
- APAAR is format-checked only; demo registry and verifier outcomes are
  simulated. No live AICTE, APAAR, DigiLocker, ERP, or signed credential
  integration exists.
- SQLite is suitable for this local demo, not concurrent production scale.
- On startup, `/api/meta` exposes the reset seed version. When it changes, the
  app clears its `apaar_*` local-store keys and reloads once, so a reset does
  not retain stale browser staging data.

## Demo fixtures

- [samples/batch_clean.csv](./samples/batch_clean.csv)
- [samples/batch_faulty.csv](./samples/batch_faulty.csv)
- [samples/expected_results.csv](./samples/expected_results.csv)
- [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
