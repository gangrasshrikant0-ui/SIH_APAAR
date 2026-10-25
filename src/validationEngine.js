const crypto = require('node:crypto');
const { ApaarVerificationService } = require('./apaarVerificationService');

const REQUIRED_FIELDS = ['student_id', 'apaar_id', 'student_name', 'dob', 'institution_id',
  'institution_name', 'programme_id', 'programme_name', 'academic_year', 'reservation_category',
  'seat_category', 'admission_date', 'enrolment_status'];
const CATEGORY_MAP = Object.freeze({ general: 'GENERAL', gen: 'GENERAL', sc: 'SC', st: 'ST', obc: 'OBC', ews: 'EWS' });
const FLAGS = ['nri_flag', 'oci_flag', 'foreign_national_flag'];
const SEVERITY = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function text(value) { return String(value ?? '').trim(); }
function norm(value) { return text(value).replace(/\s+/g, ' ').toLowerCase(); }
function safeRef(row) {
  return crypto.createHash('sha256').update(text(row.student_id) || `row-${row._rowNumber}`).digest('hex').slice(0, 12);
}
function strictDate(value) {
  const valueText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return false;
  const date = new Date(`${valueText}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === valueText;
}
function issue(code, severity, field, message, suggestedAction, humanReview = false) {
  return { code, severity, field, message, suggestedAction, humanReview };
}
function fingerprint(row) {
  return ['apaar_id', 'institution_id', 'programme_id', 'academic_year', 'student_id']
    .map((field) => norm(row[field])).join('|');
}

class ValidationEngine {
  constructor({ repository = [], approvals = [], verificationService = new ApaarVerificationService(),
    categoryMap = CATEGORY_MAP } = {}) {
    this.repository = repository;
    this.approvals = approvals;
    this.verificationService = verificationService;
    this.categoryMap = categoryMap;
  }

  async validateBatch(rows, { batchId = `batch-${Date.now()}` } = {}) {
    const ids = new Map();
    rows.forEach((row) => {
      const id = text(row.apaar_id);
      if (id) ids.set(id, [...(ids.get(id) || []), row]);
    });
    const results = [];
    for (let i = 0; i < rows.length; i += 1) {
      results.push(await this.validateRow({ ...rows[i], _rowNumber: i + 2 }, ids, batchId));
    }
    return { batchId, demoMode: this.verificationService.mode === 'DEMO', status: 'VALIDATED',
      summary: summarize(results), results };
  }

  async validateRow(row, ids, batchId) {
    const issues = [];
    const checks = {};
    const id = text(row.apaar_id);
    if (!id) {
      checks.apaarFormat = 'FAIL';
      issues.push(issue('MISSING_APAAR_ID', 'HIGH', 'apaar_id', 'APAAR ID is missing.', 'Provide the APAAR ID as text.'));
    } else if (!/^\d{12}$/.test(id)) {
      checks.apaarFormat = 'FAIL';
      issues.push(issue('INVALID_APAAR_FORMAT', 'HIGH', 'apaar_id',
        'APAAR ID must be exactly 12 numeric digits after outer trimming; malformed values are not repaired.',
        'Correct the source value and upload again.'));
    } else {
      checks.apaarFormat = 'FORMAT_PASS';
      if ((ids.get(id) || []).length > 1) issues.push(issue('DUPLICATE_IN_BATCH', 'HIGH', 'apaar_id',
        'This APAAR ID occurs in multiple rows in the uploaded batch.',
        'Review all affected rows and retain only the legitimate enrolment.'));
      const existing = this.repository.filter((record) => text(record.apaar_id) === id);
      if (existing.length) {
        const repeated = existing.some((record) => fingerprint(record) === fingerprint(row));
        issues.push(issue(repeated ? 'REPEATED_UPLOAD' : 'EXISTING_REPOSITORY_DUPLICATE', 'HIGH', 'apaar_id',
          repeated ? 'The same record was already processed.' : 'This APAAR ID exists in repository records.',
          'Review the existing record; do not create a duplicate accepted record.'));
        if (existing.some((record) => norm(record.institution_id) !== norm(row.institution_id))) {
          issues.push(issue('CROSS_INSTITUTION_CONFLICT', 'HIGH', 'institution_id',
            'This APAAR ID is associated with another institution. This is a review case, not an automatic fraud finding.',
            'Confirm transfer, withdrawal, or historical enrolment with authorized records.', true));
        }
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (!text(row[field])) issues.push(issue(`MISSING_${field.toUpperCase()}`, 'MEDIUM', field,
        `${field} is required.`, `Provide ${field} and revalidate.`));
    }
    if (text(row.dob) && !strictDate(row.dob)) issues.push(issue('INVALID_DOB', 'HIGH', 'dob',
      'DOB must be a real date in YYYY-MM-DD format.', 'Correct the DOB using strict ISO format.'));
    if (text(row.admission_date) && !strictDate(row.admission_date)) issues.push(issue('INVALID_ADMISSION_DATE', 'MEDIUM',
      'admission_date', 'Admission date must be a real date in YYYY-MM-DD format.', 'Correct the admission date.'));
    if (FLAGS.some((flag) => !['true', 'false', '0', '1', 'yes', 'no', ''].includes(norm(row[flag])))) {
      issues.push(issue('INVALID_FLAG_VALUE', 'MEDIUM', 'flags',
        'NRI, OCI and Foreign National flags must use true/false or 0/1.', 'Correct the flag values.'));
    }

    const category = this.categoryMap[norm(row.reservation_category)] || 'UNKNOWN';
    if (category === 'UNKNOWN') issues.push(issue('UNKNOWN_RESERVATION_CATEGORY', 'MEDIUM', 'reservation_category',
      'Reservation category is missing or not configured; it will not be counted as General.',
      'Provide a configured category such as General, SC, ST, OBC, or EWS.'));
    if (!text(row.seat_category)) issues.push(issue('MISSING_SEAT_CATEGORY', 'MEDIUM', 'seat_category',
      'Seat/admission category is required and is separate from reservation category.',
      'Provide the applicable seat category.'));

    const approval = this.approvals.find((item) => norm(item.institution_id) === norm(row.institution_id)
      && norm(item.programme_id) === norm(row.programme_id)
      && String(item.academic_year) === String(row.academic_year)
      && (!item.seat_category || norm(item.seat_category) === norm(row.seat_category)));
    if (!approval) issues.push(issue('INVALID_APPROVAL_MAPPING', 'HIGH', 'institution_id',
      'No Approval Master mapping matches institution, programme, academic year, and seat category.',
      'Correct the row or update the authorized Approval Master reference data.'));
    else {
      const accepted = this.repository.filter((record) => record.accepted
        && norm(record.institution_id) === norm(row.institution_id)
        && norm(record.programme_id) === norm(row.programme_id)
        && String(record.academic_year) === String(row.academic_year)
        && (!approval.seat_category || norm(record.seat_category) === norm(row.seat_category))).length;
      if (accepted + 1 > approval.approved_intake) issues.push(issue('INTAKE_EXCEEDED', 'HIGH', 'programme_id',
        'This record would exceed the configured synthetic approved intake.',
        'Review the authorized intake and enrolment before acceptance.'));
    }

    let verification = { outcome: 'NOT_AVAILABLE', mode: this.verificationService.mode, source: 'NOT_RUN' };
    if (checks.apaarFormat === 'FORMAT_PASS') {
      verification = await this.verificationService.verify(id);
      if (verification.outcome === 'NO_MATCH') issues.push(issue('VERIFICATION_NO_MATCH', 'HIGH', 'apaar_id',
        verification.message, 'Confirm the ID through the authorized verification process.', true));
      if (verification.name && norm(verification.name) !== norm(row.student_name)) issues.push(issue('OFFICIAL_NAME_MISMATCH',
        'HIGH', 'student_name', 'Authorized test response name does not match the uploaded name.',
        'Correct the student details or send the record for manual review.', true));
      if (verification.dob && verification.dob !== text(row.dob)) issues.push(issue('OFFICIAL_DOB_MISMATCH',
        'HIGH', 'dob', 'Authorized test response DOB does not match the uploaded DOB.',
        'Correct the DOB or send the record for manual review.', true));
    }
    const blocking = issues.some((item) => SEVERITY[item.severity] >= SEVERITY.HIGH);
    const recordStatus = blocking ? 'ACTION_REQUIRED' : issues.length ? 'PENDING_REVIEW' : 'READY_TO_ACCEPT';
    return {
      rowNumber: row._rowNumber, safeStudentReference: safeRef(row), maskedApaarId: id ? `${id.slice(0, 3)}******${id.slice(-3)}` : '—',
      institution: text(row.institution_name), programme: text(row.programme_name), category, checks, verification,
      verificationTimestamp: verification.outcome === 'PENDING' ? new Date().toISOString() : null,
      issueCount: issues.length, issues, recordStatus, batchId
    };
  }
}

function summarize(results) {
  const has = (result, codes) => result.issues.some((item) => codes.includes(item.code));
  return {
    totalUploaded: results.length,
    passingLocalValidation: results.filter((result) => result.recordStatus === 'READY_TO_ACCEPT').length,
    actionRequired: results.filter((result) => result.recordStatus === 'ACTION_REQUIRED').length,
    pendingOfficialVerification: results.filter((result) => result.verification.mode === 'DEMO' || result.verification.outcome === 'PENDING').length,
    duplicateCount: results.filter((result) => has(result, ['DUPLICATE_IN_BATCH', 'EXISTING_REPOSITORY_DUPLICATE', 'REPEATED_UPLOAD'])).length,
    crossInstitutionConflictCount: results.filter((result) => has(result, ['CROSS_INSTITUTION_CONFLICT'])).length,
    missingInvalidApaarCount: results.filter((result) => has(result, ['MISSING_APAAR_ID', 'INVALID_APAAR_FORMAT'])).length,
    categoryIssueCount: results.filter((result) => has(result, ['UNKNOWN_RESERVATION_CATEGORY', 'MISSING_SEAT_CATEGORY'])).length,
    mappingIntakeIssueCount: results.filter((result) => has(result, ['INVALID_APPROVAL_MAPPING', 'INTAKE_EXCEEDED'])).length
  };
}

module.exports = { ValidationEngine, summarize, strictDate, REQUIRED_FIELDS };
