const test = require('node:test');
const assert = require('node:assert/strict');
const { ValidationEngine } = require('../src/validationEngine');
const { ApaarVerificationService } = require('../src/apaarVerificationService');
const { parseCsv } = require('../src/csv');
const fs = require('node:fs');

const approvals = [
  { institution_id: 'INST-A', programme_id: 'PROG-CSE', academic_year: '2026', seat_category: 'REGULAR', approved_intake: 2 },
  { institution_id: 'INST-B', programme_id: 'PROG-AI', academic_year: '2026', seat_category: 'REGULAR', approved_intake: 1 }
];
const base = (overrides = {}) => ({ student_id: 'SYN-001', apaar_id: '900000000001', student_name: 'Synthetic Student',
  dob: '2004-01-15', institution_id: 'INST-A', institution_name: 'Synthetic Institute A', programme_id: 'PROG-CSE',
  programme_name: 'Synthetic CSE', academic_year: '2026', reservation_category: 'SC', seat_category: 'REGULAR',
  nri_flag: 'false', oci_flag: 'false', foreign_national_flag: 'false', admission_date: '2026-07-01',
  enrolment_status: 'ACTIVE', ...overrides });
const make = (repository = []) => new ValidationEngine({ repository, approvals, verificationService: new ApaarVerificationService() });
async function codes(row, repository = []) { return (await make(repository).validateBatch([row])).results[0].issues.map((item) => item.code); }

test('fixture has 20+ deterministic synthetic rows', () => assert.ok(parseCsv(fs.readFileSync('test-data/apaar_validation_test.csv', 'utf8')).length >= 20));
for (const [label, value] of [['missing', ''], ['eleven', '12345678901'], ['thirteen', '1234567890123'], ['letters', '12345678901A'], ['internal spaces', '900000 000001'], ['hyphens', '9000-0000-001']]) {
  test(`flags ${label} APAAR`, async () => assert.ok((await codes(base({ apaar_id: value })).then((result) => result.includes(value ? 'INVALID_APAAR_FORMAT' : 'MISSING_APAAR_ID')))));
}
test('outer whitespace passes format and remains demo pending', async () => {
  const result = (await make().validateBatch([base({ apaar_id: ' 900000000001 ' })])).results[0];
  assert.equal(result.checks.apaarFormat, 'FORMAT_PASS'); assert.equal(result.verification.mode, 'DEMO'); assert.equal(result.recordStatus, 'READY_TO_ACCEPT');
});
test('batch duplicate flags all rows', async () => {
  const result = await make().validateBatch([base(), base({ student_id: 'SYN-002' })]);
  assert.ok(result.results.every((row) => row.issues.some((item) => item.code === 'DUPLICATE_IN_BATCH')));
});
test('repository duplicate, repeated upload and cross institution conflict are separate', async () => {
  const repo = [{ ...base(), accepted: true }];
  assert.ok((await codes(base(), repo)).includes('REPEATED_UPLOAD'));
  assert.ok((await codes(base({ institution_id: 'INST-B' }), repo)).includes('CROSS_INSTITUTION_CONFLICT'));
});
test('strict dates and authorized test comparison', async () => {
  assert.ok((await codes(base({ dob: '2024-02-30' })).then((result) => result.includes('INVALID_DOB'))));
  assert.ok((await codes(base({ apaar_id: '900000000007', student_name: 'Wrong' })).then((result) => result.includes('OFFICIAL_NAME_MISMATCH'))));
  assert.ok((await codes(base({ apaar_id: '900000000007', dob: '2004-01-15' })).then((result) => result.includes('OFFICIAL_DOB_MISMATCH'))));
});
test('provider failures remain distinct and do not become invalid IDs', async () => {
  for (const [id, outcome] of [['900000000002', 'TIMEOUT'], ['900000000003', 'RATE_LIMITED'], ['900000000004', 'UNAUTHORIZED'], ['900000000005', 'PROVIDER_ERROR'], ['900000000006', 'NO_MATCH']]) {
    const result = (await make().validateBatch([base({ apaar_id: id })])).results[0];
    assert.equal(result.verification.outcome, outcome);
    if (outcome !== 'NO_MATCH') assert.ok(!result.issues.some((item) => item.code === 'INVALID_APAAR_FORMAT'));
  }
});
test('categories, mappings, intake and mixed results are counted correctly', async () => {
  assert.ok((await codes(base({ reservation_category: '' })).then((result) => result.includes('UNKNOWN_RESERVATION_CATEGORY'))));
  assert.ok((await codes(base({ reservation_category: 'Martian' })).then((result) => result.includes('UNKNOWN_RESERVATION_CATEGORY'))));
  assert.ok((await codes(base({ institution_id: 'UNKNOWN', institution_name: 'Unknown' })).then((result) => result.includes('INVALID_APPROVAL_MAPPING'))));
  const result = await make().validateBatch([base({ student_id: 'C' }), base({ student_id: 'D', apaar_id: '' })]);
  assert.equal(result.summary.totalUploaded, 2); assert.equal(result.summary.actionRequired, 1); assert.ok(result.summary.missingInvalidApaarCount === 1);
  assert.ok((await codes(base({ student_id: 'E' }), [{ ...base({ student_id: 'A' }), accepted: true }, { ...base({ student_id: 'B' }), accepted: true }])).includes('INTAKE_EXCEEDED'));
});
