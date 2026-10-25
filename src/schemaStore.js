const BATCH_STATUSES = new Set(['UPLOADED', 'VALIDATING', 'ACTION_REQUIRED', 'PENDING_REVIEW', 'READY_TO_ACCEPT', 'ACCEPTED', 'REJECTED']);
const ROW_STATUSES = new Set([...BATCH_STATUSES, 'VERIFIED']);
const ISSUE_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_CORRECTION', 'PENDING_REVIEW', 'RESOLVED', 'REJECTED']);
const SEVERITY = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

class SchemaStore {
  constructor({ institutions = [], programmes = [], approvals = [], students = [], enrolments = [] } = {}) {
    this.tables = {
      upload_batches: [], upload_rows: [], validation_issues: [], issue_events: [],
      students, enrolments, institutions, programmes, approval_master: approvals,
      verification_requests: [], audit_logs: []
    };
    this.nextIds = Object.fromEntries([
      'upload_batches', 'upload_rows', 'validation_issues', 'issue_events',
      'students', 'enrolments', 'verification_requests', 'audit_logs'
    ].map((table) => [table, 1]));
  }

  id(table) {
    const value = this.nextIds[table];
    this.nextIds[table] += 1;
    return value;
  }

  createBatch({ institutionId = null, uploadedBy = null, fileName = 'upload.csv', totalRows = 0 } = {}) {
    const batch = {
      batch_id: this.id('upload_batches'), institution_id: institutionId, uploaded_by: uploadedBy,
      file_name: fileName, uploaded_at: new Date().toISOString(), batch_status: 'UPLOADED',
      total_rows: totalRows, accepted_rows: 0, flagged_rows: 0
    };
    this.tables.upload_batches.push(batch);
    return batch;
  }

  persistValidation(batch, rows, validationResults) {
    batch.batch_status = 'VALIDATING';
    const batchRows = [];
    validationResults.forEach((result, index) => {
      const source = rows[index];
      const uploadRow = {
        row_id: this.id('upload_rows'), batch_id: batch.batch_id, row_number: result.rowNumber,
        raw_data: { ...source }, normalized_apaar_id: String(source.apaar_id || '').trim() || null,
        row_status: result.recordStatus,
        submitted_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      this.tables.upload_rows.push(uploadRow);
      batchRows.push(uploadRow);
      result.schemaRowId = uploadRow.row_id;
      result.schemaIssueIds = [];
      if (result.issues.length > 0) {
        const primaryIssue = result.issues[0];
        const validationIssue = {
          issue_id: this.id('validation_issues'), row_id: uploadRow.row_id,
          issue_code: result.issues.length === 1 ? primaryIssue.code : 'MULTIPLE_ISSUES',
          reason: result.issues.map((item) => item.message).join(' '),
          issue_details: result.issues.map((item) => ({ ...item })),
          severity: result.issues.reduce((highest, item) =>
            SEVERITY[item.severity] > SEVERITY[highest] ? item.severity : highest, 'LOW'),
          issue_status: result.issues.some((item) => item.humanReview) ? 'PENDING_REVIEW' : 'OPEN',
          assigned_to: null, due_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        };
        if (!ISSUE_STATUSES.has(validationIssue.issue_status)) throw new Error('Invalid schema issue state.');
        this.tables.validation_issues.push(validationIssue);
        result.schemaIssueIds.push(validationIssue.issue_id);
        this.tables.issue_events.push({
          event_id: this.id('issue_events'), issue_id: validationIssue.issue_id, actor_id: null,
          action: 'DETECTED', previous_status: null, new_status: validationIssue.issue_status,
          change_summary: validationIssue.reason, event_time: new Date().toISOString()
        });
      }
    });
    batch.batch_status = validationResults.some((result) => result.recordStatus === 'ACTION_REQUIRED')
      ? 'ACTION_REQUIRED' : validationResults.some((result) => result.recordStatus === 'PENDING_REVIEW')
        ? 'PENDING_REVIEW' : 'READY_TO_ACCEPT';
    batch.accepted_rows = validationResults.filter((result) => result.recordStatus === 'READY_TO_ACCEPT').length;
    batch.flagged_rows = validationResults.filter((result) => result.issues.length > 0).length;
    batch.total_rows = validationResults.length;
    return { batch, rows: batchRows };
  }

  schemaSnapshot(batchId) {
    return {
      upload_batch: this.tables.upload_batches.find((row) => row.batch_id === batchId),
      upload_rows: this.tables.upload_rows.filter((row) => row.batch_id === batchId),
      validation_issues: this.tables.validation_issues.filter((issue) =>
        this.tables.upload_rows.some((row) => row.row_id === issue.row_id && row.batch_id === batchId)),
      issue_events: this.tables.issue_events.filter((event) =>
        this.tables.validation_issues.some((issue) => issue.issue_id === event.issue_id &&
          this.tables.upload_rows.some((row) => row.row_id === issue.row_id && row.batch_id === batchId)))
    };
  }
}

module.exports = { SchemaStore, BATCH_STATUSES, ROW_STATUSES, ISSUE_STATUSES };
