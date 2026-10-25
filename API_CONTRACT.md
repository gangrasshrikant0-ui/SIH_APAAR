# Validation API contract

Base URL: `http://localhost:8010`. The service is DEMO MODE by default and
does not contact APAAR/ABC. No authentication is implemented in this local
demo; production must require institution-scoped authentication and must
derive the institution from the authenticated principal rather than trusting
client input.

When `DATABASE_URL` is configured, batches, upload rows, validation issues, and
detected issue events are written transactionally to the PostgreSQL tables in
[`schemas.sql`](schemas.sql). Without it, the service uses the in-memory demo
adapter.

### `GET /api/validation/db-health`

Returns a safe connection check without credentials. It returns `200` with
`connected: true` in PostgreSQL mode, or `503` with the configuration/provider
error. The endpoint never returns the connection string or password.

## Endpoints

### `POST /api/validation/preview`

Accepts JSON `{ "csv": "<CSV text>" }` or `{ "rows": [{...}] }`. Optional
`institutionId` and `uploadedBy` identify the upload context when known; omit
them for general validation. The IDs are stored as `NULL` when omitted.
It validates without storing the batch and returns the result object with
`accepted: false`.

### `POST /api/validation/batches`

Same request body. Stores the in-memory result and returns HTTP 201. Example:

```json
{"institutionId":12,"uploadedBy":34,"csv":"student_id,apaar_id,...\nSYN-001,900000000001,..."}
```

For a general upload, omit `institutionId` and `uploadedBy`. In PostgreSQL
mode, `upload_batches.institution_id` and `upload_batches.uploaded_by` remain
`NULL` until an institution and authenticated uploader are assigned.

The stored representation follows [schemas.sql](schemas.sql): each batch is
represented by an `upload_batches` row, each input record by an `upload_rows`
row, and each validation issue by a `validation_issues` row linked to its
source row. Detected issues also create an `issue_events` `DETECTED` event.
Each student now has at most one `validation_issues` row. When a student has
multiple problems, `issue_code` is `MULTIPLE_ISSUES` and the individual issue
objects are stored in `issue_details`. The response adds `schemaRowId` and
`schemaIssueIds` to make the mapping explicit.
The demo currently uses an in-memory schema-shaped store; production should
replace that adapter with a PostgreSQL transaction using the supplied schema.
The response includes a `schema` projection with `uploadBatch`,
`uploadRows`, and `validationIssues` for integration testing.

### `GET /api/validation/batches/:batchId`

Returns the stored batch, summary, and row-level results.

### `POST /api/validation/batches/:batchId/revalidate`

Accepts the same CSV or rows body and refreshes the stored batch. This is
intended for corrected demo data.

### `GET /api/validation/batches/:batchId/report`

Returns a sanitized CSV containing row number, safe reference, masked APAAR,
record status, and issue codes. Export values are protected against CSV
formula injection.

---

### `GET /api/validation/batches/:batchId/error-report`

Returns a detailed CSV containing **one row per validation issue** so that
every problem is independently visible. Use this endpoint to power the
"Download Error Report CSV" button on the validation results page.

#### Request

```
GET /api/validation/batches/{batchId}/error-report
```

No request body. No query parameters.

#### Success response — `200 OK`

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="validation_errors_{safeBatchId}.csv"
X-Issue-Count: <integer>          ← total data rows in the CSV (0 = no issues)
Access-Control-Expose-Headers: X-Issue-Count
```

The body is a UTF-8 CSV with the following columns (in order):

| Column | Description |
|---|---|
| `rowNumber` | Source row number (header = 1, first data row = 2) |
| `safeStudentReference` | SHA-256–derived 12-hex-char opaque reference (no PII) |
| `maskedApaarId` | APAAR ID with middle digits replaced: `900******001` |
| `institution` | Institution name from uploaded record |
| `programme` | Programme name from uploaded record |
| `issueCode` | Machine-readable issue code (e.g. `MISSING_APAAR_ID`) |
| `severity` | `LOW`, `MEDIUM`, or `HIGH` |
| `affectedField` | CSV column the issue relates to |
| `explanation` | Human-readable description of the problem |
| `suggestedAction` | Recommended corrective action |
| `recordStatus` | `READY_TO_ACCEPT`, `PENDING_REVIEW`, or `ACTION_REQUIRED` |

**Security properties:**
- APAAR IDs are always masked. Raw IDs are never exported.
- API credentials, personal data beyond name/institution/programme, and
  internal implementation details are never exported.
- All cell values are protected against CSV formula injection (cells that
  start with `=`, `+`, `-`, or `@` are prefixed with a single-quote `'`).
- The filename is derived from `batchId` with all non-alphanumeric characters
  (except `-` and `_`) replaced by underscores, preventing path traversal.

**When `X-Issue-Count` is `0`**, the body contains only the header row.
The frontend should disable the download button and display
"No validation errors to download." in this case.

#### Error responses

| Status | Body | Reason |
|---|---|---|
| `404` | `{"error":"Batch not found."}` | `batchId` is unknown |
| `409` | `{"error":"Batch validation has not completed; no report is available."}` | `status !== "VALIDATED"` |

#### Frontend integration example

```javascript
// Triggered after validation completes and state.data.batchId is set.
const issueCount = state.data.results.reduce((n, r) => n + r.issues.length, 0);
if (issueCount === 0) {
  dlBtn.disabled = true;
  dlNote.textContent = 'No validation errors to download.';
} else {
  dlBtn.disabled = false;
  dlNote.textContent = `${issueCount} issue(s) will be included in the report.`;
}

dlBtn.onclick = () => {
  const url = `http://localhost:8010/api/validation/batches/${encodeURIComponent(state.data.batchId)}/error-report`;
  const a = document.createElement('a');
  a.href = url; a.download = '';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
```

---

## Response and issue schema

```json
{
  "batchId": "batch-...",
  "demoMode": true,
  "status": "VALIDATED",
  "accepted": false,
  "summary": {
    "totalUploaded": 1,
    "passingLocalValidation": 1,
    "actionRequired": 0,
    "pendingOfficialVerification": 1
  },
  "results": [{
    "rowNumber": 2,
    "safeStudentReference": "a1b2c3d4e5f6",
    "maskedApaarId": "900******001",
    "checks": {"apaarFormat": "FORMAT_PASS"},
    "verification": {"outcome": "PENDING", "mode": "DEMO"},
    "recordStatus": "READY_TO_ACCEPT",
    "issues": [{
      "code": "INVALID_DOB",
      "severity": "HIGH",
      "field": "dob",
      "message": "DOB must be a real date in YYYY-MM-DD format.",
      "suggestedAction": "Correct the DOB using strict ISO format.",
      "humanReview": false
    }]
  }]
}
```

Possible row statuses are `READY_TO_ACCEPT`, `PENDING_REVIEW`, and
`ACTION_REQUIRED`. `READY_TO_ACCEPT` is not `VERIFIED`; no DEMO result can be
officially verified. Error responses are JSON `{ "error": "..." }` with 400,
404, or 413-equivalent validation errors. Production integration must add
authentication, authorization, persistent transactions, and audit logging.
