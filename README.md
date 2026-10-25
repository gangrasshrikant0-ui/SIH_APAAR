# AICTE APAAR validation demo

This folder contains a modular JavaScript validation backend and an isolated
validation-only demo page. It is not connected to an official APAAR/ABC API.

## Start

```powershell
cd "C:\Users\Pradnya\Desktop\CODING\SIH NEW"
npm test
npm start
```

For PostgreSQL setup, see [`db/README.md`](db/README.md). The backend loads
values from the root `.env` file, or from `db\.env` if the root file is
absent. Copy `.env.example` to one of those locations and fill in the
database connection values. Institution and uploader context is supplied per
upload when it is known; it is not a machine-wide configuration.

To use PostgreSQL instead of the in-memory demo store, set the connection
environment variables before starting the server:

```powershell
$env:DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME"
$env:PGSSL="disable"
npm start
```

An upload may include optional `institutionId` and `uploadedBy` fields when the
source institution and authenticated uploader are known. They must refer to
existing rows when supplied. General or pre-authentication validation can omit
both fields; PostgreSQL stores them as `NULL`. Check the connection at
`http://localhost:8010/api/validation/db-health`.
When `DATABASE_URL` is absent, the server explicitly remains in in-memory
demo mode. PostgreSQL credentials are never committed or sent to the frontend.

Open [http://localhost:8010](http://localhost:8010) only for the API. To use
the UI, serve the folder with any static server, for example in a second
terminal:

```powershell
cd "C:\Users\Pradnya\Desktop\CODING\SIH NEW"
python -m http.server 5500
```

Then open `http://localhost:5500/public/index.html`, choose
`test-data/apaar_validation_test.csv`, and click **Validate upload**.

The exact API contract is in [API_CONTRACT.md](API_CONTRACT.md). Synthetic test
files are in `test-data/`. All repository and Approval Master values are local
fixtures and do not represent real AICTE limits.

## Database schema alignment

[`schemas.sql`](schemas.sql) is the source-of-truth PostgreSQL schema. The
current dependency-free demo uses [`src/schemaStore.js`](src/schemaStore.js)
as an in-memory adapter with the same relational boundaries:

- `upload_batches` stores batch metadata and aggregate counts.
- `upload_rows` stores each source row, the normalized APAAR value, and row status.
- `validation_issues` stores one issue per row with severity and issue status.
- `issue_events` records a `DETECTED` event for each issue.
- `institutions`, `programmes`, and `approval_master` hold the synthetic reference fixtures.

The API response includes a schema projection for integration testing. The
demo intentionally does not insert records into `students` or `enrolments`
automatically: a row must be accepted through an authorized transaction
before those tables should be written. A production PostgreSQL adapter should
replace the in-memory store while preserving these table relationships,
foreign keys, unique constraints, and batch/row status values.
