const http = require('node:http');
const fs = require('node:fs');
const pathModule = require('node:path');
const dotenv = require('dotenv');
dotenv.config({ path: pathModule.join(__dirname, '..', '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: pathModule.join(__dirname, '..', 'db', '.env') });
}
const { parseCsv, toCsv } = require('./csv');
const { ValidationEngine } = require('./validationEngine');
const { SchemaStore } = require('./schemaStore');
const { PostgresStore } = require('./postgresStore');

const repository = [
  { student_id: 'SYN-EXISTING-001', apaar_id: '900000000010', institution_id: 'INST-A',
    programme_id: 'PROG-CSE', academic_year: '2026', seat_category: 'REGULAR', accepted: true,
    student_name: 'Synthetic Existing', dob: '2004-02-02' },
  { student_id: 'SYN-TRANSFER-001', apaar_id: '900000000011', institution_id: 'INST-B',
    programme_id: 'PROG-AI', academic_year: '2026', seat_category: 'REGULAR', accepted: true,
    student_name: 'Synthetic Transfer', dob: '2003-03-03' }
];
const approvals = [
  { institution_id: 'INST-A', programme_id: 'PROG-CSE', academic_year: '2026', seat_category: 'REGULAR', approved_intake: 3 },
  { institution_id: 'INST-B', programme_id: 'PROG-AI', academic_year: '2026', seat_category: 'REGULAR', approved_intake: 1 }
];
const engine = new ValidationEngine({ repository, approvals });
const schemaStore = new SchemaStore({
  institutions: [
    { institution_id: 1, aicte_institution_code: 'SYN-INST-A', institution_name: 'Synthetic Institute A',
      campus_code: 'MAIN', state: 'Synthetic State', city: 'Synthetic City', institution_status: 'ACTIVE' },
    { institution_id: 2, aicte_institution_code: 'SYN-INST-B', institution_name: 'Synthetic Institute B',
      campus_code: 'MAIN', state: 'Synthetic State', city: 'Synthetic City', institution_status: 'ACTIVE' }
  ],
  programmes: [
    { programme_id: 1, institution_id: 1, programme_code: 'PROG-CSE', programme_name: 'Synthetic CSE',
      programme_level: 'UG', programme_status: 'ACTIVE' },
    { programme_id: 2, institution_id: 2, programme_code: 'PROG-AI', programme_name: 'Synthetic AI',
      programme_level: 'UG', programme_status: 'ACTIVE' }
  ],
  approvals: [
    { approval_id: 1, programme_id: 1, academic_year: '2026', approved_intake: 3,
      supernumerary_limit: 0, nri_limit: 0, oci_limit: 0, fn_limit: 0, approval_reference: 'SYNTHETIC-DEMO' },
    { approval_id: 2, programme_id: 2, academic_year: '2026', approved_intake: 1,
      supernumerary_limit: 0, nri_limit: 0, oci_limit: 0, fn_limit: 0, approval_reference: 'SYNTHETIC-DEMO' }
  ]
});
const databaseStore = process.env.DATABASE_URL ? new PostgresStore() : null;
const batches = new Map();
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  response.end(JSON.stringify(body));
}

/** Derive a filesystem-safe batch identifier from the stored batchId. */
function safeBatchId(batchId) {
  return String(batchId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
}

/**
 * Build an error-report CSV from a completed batch result.
 * One row is emitted per issue so that every problem is independently visible.
 * APAAR IDs are masked. API credentials are never included.
 * Returns { csv, issueCount } where issueCount is the number of rows emitted.
 */
function buildErrorReportCsv(batch) {
  const ERROR_REPORT_HEADERS = [
    'rowNumber', 'safeStudentReference', 'maskedApaarId',
    'institution', 'programme',
    'issueCode', 'severity', 'affectedField', 'explanation', 'suggestedAction',
    'recordStatus'
  ];
  const issueRows = [];
  for (const result of batch.results) {
    if (!result.issues || result.issues.length === 0) continue;
    for (const iss of result.issues) {
      issueRows.push({
        rowNumber: result.rowNumber,
        safeStudentReference: result.safeStudentReference,
        maskedApaarId: result.maskedApaarId,
        institution: result.institution,
        programme: result.programme,
        issueCode: iss.code,
        severity: iss.severity,
        affectedField: iss.field,
        explanation: iss.message,
        suggestedAction: iss.suggestedAction,
        recordStatus: result.recordStatus
      });
    }
  }
  return { csv: toCsv(issueRows, ERROR_REPORT_HEADERS), issueCount: issueRows.length };
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; if (body.length > MAX_UPLOAD_BYTES) reject(new Error('Upload exceeds 5 MB limit.')); });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}
function parsePayload(body) {
  const payload = JSON.parse(body || '{}');
  if (payload.csv) {
    return {
      rows: parseCsv(payload.csv),
      fileName: payload.fileName || 'upload.csv',
      institutionId: payload.institutionId,
      uploadedBy: payload.uploadedBy
    };
  }
  if (Array.isArray(payload.rows)) {
    return {
      rows: payload.rows,
      fileName: payload.fileName || 'upload.json',
      institutionId: payload.institutionId,
      uploadedBy: payload.uploadedBy
    };
  }
  throw new Error('Request must contain CSV text in "csv" or an array in "rows".');
}
function optionalId(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a positive integer when provided.`);
  }
  return parsed;
}
async function route(request, response) {
  if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); return response.end(); }
  const requestPath = request.url.split('?')[0];
  try {
    if (request.method === 'GET' && requestPath === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(fs.readFileSync(pathModule.join(__dirname, '..', 'public', 'index.html')));
    }
    if (request.method === 'GET' && requestPath === '/test-data/apaar_validation_test.csv') {
      const filePath = pathModule.join(__dirname, '..', 'test-data', 'apaar_validation_test.csv');
      response.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="apaar_validation_test.csv"'
      });
      return response.end(fs.readFileSync(filePath));
    }
    if (request.method === 'GET' && requestPath === '/api/validation/health') {
      return json(response, 200, { demoMode: true, databaseMode: Boolean(databaseStore), status: 'ok' });
    }
    if (request.method === 'GET' && requestPath === '/api/validation/db-health') {
      if (!databaseStore) return json(response, 503, { connected: false, mode: 'IN_MEMORY',
        error: 'DATABASE_URL is not configured.' });
      try {
        return json(response, 200, { mode: 'POSTGRESQL', ...(await databaseStore.health()) });
      } catch (error) {
        return json(response, 503, { connected: false, mode: 'POSTGRESQL', error: error.message });
      }
    }
    if (request.method === 'POST' && (requestPath === '/api/validation/preview' || requestPath === '/api/validation/batches')) {
      const payload = parsePayload(await requestBody(request));
      const rows = payload.rows;
      if (!rows.length) return json(response, 400, { error: 'The uploaded CSV contains no data rows.' });
      const schemaBatch = databaseStore
        ? await databaseStore.createBatch({
          institutionId: optionalId(payload.institutionId, 'institutionId'),
          uploadedBy: optionalId(payload.uploadedBy, 'uploadedBy'),
          fileName: payload.fileName, totalRows: rows.length
        })
        : schemaStore.createBatch({
          institutionId: optionalId(payload.institutionId, 'institutionId'),
          uploadedBy: optionalId(payload.uploadedBy, 'uploadedBy'),
          fileName: payload.fileName, totalRows: rows.length
        });
      const result = await engine.validateBatch(rows, { batchId: schemaBatch.batch_id });
      const persisted = databaseStore
        ? await databaseStore.persistValidation(schemaBatch, rows, result.results)
        : schemaStore.persistValidation(schemaBatch, rows, result.results);
      result.schema = {
        uploadBatch: persisted.batch,
        uploadRows: persisted.rows,
        validationIssues: databaseStore ? undefined : schemaStore.schemaSnapshot(schemaBatch.batch_id).validation_issues
      };
      if (requestPath.endsWith('/batches')) batches.set(String(result.batchId), result);
      return json(response, requestPath.endsWith('/batches') ? 201 : 200, { ...result, accepted: false });
    }
    const match = requestPath.match(/^\/api\/validation\/batches\/([^/]+)(?:\/(revalidate|report|error-report))?$/);
    if (match) {
      const batch = batches.get(match[1]);
      if (!batch) return json(response, 404, { error: 'Batch not found.' });
      if (request.method === 'GET' && !match[2]) return json(response, 200, batch);
      if (request.method === 'POST' && match[2] === 'revalidate') {
        const rows = parsePayload(await requestBody(request)).rows;
        const refreshed = await engine.validateBatch(rows, { batchId: match[1] });
        batches.set(match[1], refreshed);
        return json(response, 200, refreshed);
      }
      if (request.method === 'GET' && match[2] === 'report') {
        const csv = toCsv(batch.results.map((row) => ({ rowNumber: row.rowNumber, safeStudentReference: row.safeStudentReference,
          maskedApaarId: row.maskedApaarId, recordStatus: row.recordStatus, issueCodes: row.issues.map((item) => item.code).join('|') })));
        response.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${match[1]}-report.csv"` });
        return response.end(csv);
      }
      // GET /api/validation/batches/:batchId/error-report
      // Returns a detailed CSV with one row per validation issue. Validation must be complete.
      // Masked APAAR IDs, no API credentials. Formula-injection protected via safeCsv in toCsv.
      if (request.method === 'GET' && match[2] === 'error-report') {
        if (batch.status !== 'VALIDATED') {
          return json(response, 409, { error: 'Batch validation has not completed; no report is available.' });
        }
        const { csv, issueCount } = buildErrorReportCsv(batch);
        const safeId = safeBatchId(match[1]);
        response.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="validation_errors_${safeId}.csv"`,
          'X-Issue-Count': String(issueCount),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'X-Issue-Count'
        });
        return response.end(csv);
      }
    }
    return json(response, 404, { error: 'Route not found.' });
  } catch (error) { return json(response, 400, { error: error.message }); }
}
const server = http.createServer(route);
if (require.main === module) server.listen(Number(process.env.PORT || 8010), () => console.log('APAAR validation API: http://localhost:8010'));
module.exports = { server, batches, buildErrorReportCsv, safeBatchId, schemaStore };
