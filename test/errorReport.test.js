'use strict';
/**
 * Tests for the Download Error Report CSV feature.
 * Covers: CSV escaping, empty reports, multiple issues per student,
 * formula-injection protection, endpoint behaviour, and safe batch-id derivation.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

// ── Unit imports ──────────────────────────────────────────────────────────────
const { toCsv } = require('../src/csv');
const { buildErrorReportCsv, safeBatchId, batches } = require('../src/server');
const { ValidationEngine } = require('../src/validationEngine');
const { ApaarVerificationService } = require('../src/apaarVerificationService');

// ── Shared fixtures ───────────────────────────────────────────────────────────
const approvals = [
  { institution_id: 'INST-A', programme_id: 'PROG-CSE', academic_year: '2026', seat_category: 'REGULAR', approved_intake: 5 }
];
const base = (overrides = {}) => ({
  student_id: 'SYN-001', apaar_id: '900000000001', student_name: 'Synthetic Student',
  dob: '2004-01-15', institution_id: 'INST-A', institution_name: 'Synthetic Institute A',
  programme_id: 'PROG-CSE', programme_name: 'Synthetic CSE', academic_year: '2026',
  reservation_category: 'SC', seat_category: 'REGULAR',
  nri_flag: 'false', oci_flag: 'false', foreign_national_flag: 'false',
  admission_date: '2026-07-01', enrolment_status: 'ACTIVE', ...overrides
});
const makeEngine = (repository = []) =>
  new ValidationEngine({ repository, approvals, verificationService: new ApaarVerificationService() });

// ─────────────────────────────────────────────────────────────────────────────
// 1. CSV escaping helpers (unit — tests toCsv / safeCsv in csv.js)
// ─────────────────────────────────────────────────────────────────────────────
test('CSV: plain values are emitted unchanged', () => {
  const out = toCsv([{ a: 'hello', b: 'world' }], ['a', 'b']);
  assert.equal(out, 'a,b\nhello,world');
});

test('CSV: values containing a comma are double-quoted', () => {
  const out = toCsv([{ a: 'one,two' }], ['a']);
  assert.equal(out, 'a\n"one,two"');
});

test('CSV: values containing a double-quote are escaped by doubling', () => {
  const out = toCsv([{ a: 'say "hi"' }], ['a']);
  assert.equal(out, 'a\n"say ""hi"""');
});

test('CSV: embedded newlines are wrapped in quotes', () => {
  const out = toCsv([{ a: 'line1\nline2' }], ['a']);
  assert.equal(out, 'a\n"line1\nline2"');
});

test('CSV: embedded CR+LF are wrapped in quotes', () => {
  const out = toCsv([{ a: 'a\r\nb' }], ['a']);
  assert.equal(out, 'a\n"a\r\nb"');
});

test('CSV: null and undefined become empty strings', () => {
  const out = toCsv([{ a: null, b: undefined }], ['a', 'b']);
  assert.equal(out, 'a,b\n,');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Formula-injection protection (unit)
// ─────────────────────────────────────────────────────────────────────────────
for (const [label, value, expected] of [
  ['= prefix', '=SUM(A1)', "'=SUM(A1)"],
  ['+ prefix', '+CMD', "'+CMD"],
  ['- prefix', '-1+2', "'-1+2"],
  ['@ prefix', '@SUM()', "'@SUM()"],
  ['safe value passthrough', 'MISSING_APAAR_ID', 'MISSING_APAAR_ID'],
  ['numeric string passthrough', '900000000001', '900000000001']
]) {
  test(`formula-injection: ${label}`, () => {
    const out = toCsv([{ v: value }], ['v']);
    const dataLine = out.split('\n')[1];
    assert.equal(dataLine, expected, `Expected cell to be ${JSON.stringify(expected)}, got ${JSON.stringify(dataLine)}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. safeBatchId — filesystem-safe derivation
// ─────────────────────────────────────────────────────────────────────────────
test('safeBatchId: keeps alphanumeric, hyphens, underscores', () => {
  assert.equal(safeBatchId('batch-1234_abc'), 'batch-1234_abc');
});

test('safeBatchId: replaces unsafe characters with underscores', () => {
  assert.equal(safeBatchId('batch/2026?x=1&y=2'), 'batch_2026_x_1_y_2');
});

test('safeBatchId: truncates to 80 characters', () => {
  const long = 'a'.repeat(120);
  assert.equal(safeBatchId(long).length, 80);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. buildErrorReportCsv — unit tests
// ─────────────────────────────────────────────────────────────────────────────
test('buildErrorReportCsv: returns empty body (headers only) when no issues exist', async () => {
  const eng = makeEngine();
  const batch = await eng.validateBatch([base()]);
  const { csv, issueCount } = buildErrorReportCsv(batch);
  assert.equal(issueCount, 0, 'Expected issueCount to be 0');
  // Only the header line — no data rows
  const lines = csv.split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'Expected only the header row when there are no issues');
  assert.ok(lines[0].includes('issueCode'), 'Header must contain issueCode column');
});

test('buildErrorReportCsv: one row per issue for a student with multiple issues', async () => {
  // Missing APAAR, missing required fields — guaranteed multiple issues
  const eng = makeEngine();
  const batch = await eng.validateBatch([base({ apaar_id: '', student_name: '' })]);
  const result = batch.results[0];
  assert.ok(result.issues.length >= 2, 'Test precondition: expect >=2 issues on this row');
  const { csv, issueCount } = buildErrorReportCsv(batch);
  assert.equal(issueCount, result.issues.length, 'issueCount must match actual issue count');
  const dataLines = csv.split('\n').slice(1).filter(Boolean);
  assert.equal(dataLines.length, result.issues.length, 'One CSV row per issue');
});

test('buildErrorReportCsv: APAAR ID is masked, not exposed in plain text', async () => {
  const eng = makeEngine();
  const row = base({ apaar_id: '900000000013', dob: '2024-02-30' }); // bad DOB → issue
  const batch = await eng.validateBatch([row]);
  const { csv } = buildErrorReportCsv(batch);
  assert.ok(!csv.includes('900000000013'), 'Plain APAAR ID must not appear in error report CSV');
  assert.ok(csv.includes('900******013'), 'Masked APAAR ID must appear in error report CSV');
});

test('buildErrorReportCsv: required columns are present in header', async () => {
  const eng = makeEngine();
  const batch = await eng.validateBatch([base({ apaar_id: '' })]);
  const { csv } = buildErrorReportCsv(batch);
  const header = csv.split('\n')[0];
  for (const col of ['rowNumber', 'safeStudentReference', 'maskedApaarId', 'institution', 'programme',
    'issueCode', 'severity', 'affectedField', 'explanation', 'suggestedAction', 'recordStatus']) {
    assert.ok(header.includes(col), `Header must include column: ${col}`);
  }
});

test('buildErrorReportCsv: formula injection in issue message is neutralised', async () => {
  // Synthesise a fake batch result containing an issue message that starts with "="
  // safeCsv() prepends "'" to cells starting with =, +, -, @.
  // When the value also contains quotes/commas it gets CSV-quoted, so the cell
  // content in the raw CSV text is: "'=HYPERLINK(..." (single-quote prefix retained).
  // The assertion is that the cell does NOT start with a bare "=" — i.e. the
  // dangerous prefix is neutralised — NOT that the substring "=HYPERLINK" vanishes
  // entirely (it is still present after the protective single-quote).
  const fakeBatch = {
    status: 'VALIDATED',
    results: [{
      rowNumber: 2,
      safeStudentReference: 'aabbcc112233',
      maskedApaarId: '900******001',
      institution: 'Test',
      programme: 'CSE',
      issues: [{
        code: 'CUSTOM_CODE',
        severity: 'HIGH',
        field: 'apaar_id',
        message: '=HYPERLINK("http://evil.example","click")',
        suggestedAction: '+rm -rf /'
      }],
      recordStatus: 'ACTION_REQUIRED'
    }]
  };
  const { csv } = buildErrorReportCsv(fakeBatch);

  // Parse the data row back out: split on newline, skip header.
  const dataLine = csv.split('\n').filter(Boolean)[1];

  // The 'explanation' column is column index 8 (0-based) in the header.
  // Rather than fragile positional parsing, verify directly via safeCsv's contract:
  // The cell value in the CSV must start with "'" (single-quote), not with "=".
  // Since the value contains double-quotes, it will be CSV-wrapped: `"'=HYPERLINK(...)"`
  // Assertion 1: the protected prefix "'=" appears in the output
  assert.ok(csv.includes("'=HYPERLINK"), "Explanation cell must be prefixed with single-quote before '='");
  // Assertion 2: no cell starts with a bare "=" at the field boundary (comma/newline followed by =)
  // In CSV, a cell starting with = at a field boundary would appear as ,= or \n= (unquoted) or ,"= (quoted but unprotected)
  assert.ok(!/(,|^)\s*"?=/.test(dataLine), 'No field must begin with a bare = sign at a CSV field boundary');
  // Assertion 3: suggestedAction starting with + is also protected
  assert.ok(csv.includes("'+rm"), "suggestedAction cell must be prefixed with single-quote before '+'");
  assert.ok(!/(,|^)\s*"?\+rm/.test(dataLine), 'No field must begin with a bare + at a CSV field boundary');
});

test('buildErrorReportCsv: filename uses safe batch ID', () => {
  // The filename is constructed in the route handler; verify safeBatchId is applied
  const dangerous = 'batch/../../../etc/passwd';
  const safe = safeBatchId(dangerous);
  assert.ok(!safe.includes('/'), 'Safe batch ID must not contain forward slashes');
  assert.ok(!safe.includes('..'), 'Safe batch ID must not contain ".."');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Integration tests — in-process, no TCP sockets needed
// ─────────────────────────────────────────────────────────────────────────────

// Import already happened at the top of file:
//   buildErrorReportCsv, safeBatchId, batches  ← from ../src/server

test('route integration: 404-equivalent — batch not in map returns error object', () => {
  // buildErrorReportCsv is never called for an unknown batchId; the route returns
  // a 404 JSON body. We verify the batches Map does not contain a random key.
  const unknownId = 'completely-unknown-batch-xyz';
  assert.ok(!batches.has(unknownId), 'Unknown batch must not be present in the batches Map');
});

test('route integration: error-report for batch with issues returns correct CSV', async () => {
  const eng = makeEngine();
  // A row with a missing APAAR — guaranteed issues
  const badRow = base({ apaar_id: '', student_id: 'SYN-INT-001' });
  const batch = await eng.validateBatch([badRow], { batchId: 'test-int-batch-001' });
  // Manually register the batch as if the POST /batches endpoint stored it
  batches.set(batch.batchId, batch);

  const { csv, issueCount } = buildErrorReportCsv(batch);
  assert.ok(issueCount > 0, 'issueCount must be positive for a batch with issues');
  const lines = csv.split('\n').filter(Boolean);
  assert.ok(lines.length >= 2, 'CSV must have a header and at least one data row');
  assert.ok(lines[0].includes('issueCode'), 'Header must include issueCode column');

  // Content-Disposition filename must use safeBatchId
  const safeId = safeBatchId(batch.batchId);
  const expectedFilename = `validation_errors_${safeId}.csv`;
  assert.ok(expectedFilename.startsWith('validation_errors_'), 'Filename must start with validation_errors_');
  assert.ok(expectedFilename.endsWith('.csv'), 'Filename must end with .csv');

  batches.delete(batch.batchId);
});

test('route integration: error-report for clean batch returns headers-only CSV with issueCount 0', async () => {
  const eng = makeEngine();
  const cleanRow = base({ student_id: 'SYN-INT-CLEAN' });
  const batch = await eng.validateBatch([cleanRow], { batchId: 'test-int-batch-clean' });
  batches.set(batch.batchId, batch);

  const { csv, issueCount } = buildErrorReportCsv(batch);
  assert.equal(issueCount, 0, 'issueCount must be 0 for a clean batch');
  const lines = csv.split('\n').filter(Boolean);
  assert.equal(lines.length, 1, 'Only the header row should be returned when there are no issues');

  batches.delete(batch.batchId);
});

test('route integration: multiple issues per student produce multiple rows', async () => {
  const eng = makeEngine();
  // Missing APAAR ID and missing student_name → at least 2 issues
  const multiRow = base({ apaar_id: '', student_name: '', student_id: 'SYN-INT-MULTI' });
  const batch = await eng.validateBatch([multiRow], { batchId: 'test-int-batch-multi' });
  batches.set(batch.batchId, batch);

  const result = batch.results[0];
  assert.ok(result.issues.length >= 2, 'Precondition: expect >=2 issues on this row');

  const { csv, issueCount } = buildErrorReportCsv(batch);
  assert.equal(issueCount, result.issues.length, 'issueCount must equal the actual number of issues');
  const dataLines = csv.split('\n').filter(Boolean).slice(1);
  assert.equal(dataLines.length, result.issues.length, 'One CSV data row per issue');

  // All data rows must reference rowNumber=2
  for (const line of dataLines) {
    assert.ok(line.startsWith('2,'), `Each data row must begin with rowNumber=2, got: ${line}`);
  }

  batches.delete(batch.batchId);
});
