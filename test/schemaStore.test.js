const test = require('node:test');
const assert = require('node:assert/strict');
const { SchemaStore } = require('../src/schemaStore');

test('stores validation output in upload_batches, upload_rows, validation_issues, and issue_events shape', () => {
  const store = new SchemaStore();
  const batch = store.createBatch({ institutionId: 1, uploadedBy: 7, fileName: 'students.csv' });
  const result = {
    rowNumber: 2,
    recordStatus: 'ACTION_REQUIRED',
    issues: [{
      code: 'INVALID_DOB', severity: 'HIGH', field: 'dob',
      message: 'DOB is invalid.', suggestedAction: 'Correct the date.', humanReview: false
    }]
  };
  const persisted = store.persistValidation(batch, [{
    student_id: 'SYN-001', apaar_id: '900000000001'
  }], [result]);
  assert.equal(persisted.batch.batch_id, 1);
  assert.equal(persisted.batch.batch_status, 'ACTION_REQUIRED');
  assert.equal(persisted.batch.total_rows, 1);
  assert.equal(persisted.batch.flagged_rows, 1);
  assert.equal(persisted.rows[0].batch_id, persisted.batch.batch_id);
  assert.equal(persisted.rows[0].normalized_apaar_id, '900000000001');
  assert.equal(result.schemaRowId, persisted.rows[0].row_id);
  const snapshot = store.schemaSnapshot(persisted.batch.batch_id);
  assert.equal(snapshot.validation_issues[0].row_id, persisted.rows[0].row_id);
  assert.equal(snapshot.validation_issues[0].issue_status, 'OPEN');
  assert.equal(snapshot.issue_events[0].action, 'DETECTED');
  assert.deepEqual(result.schemaIssueIds, [snapshot.validation_issues[0].issue_id]);
});

test('allows a general upload without institution or uploader context', () => {
  const store = new SchemaStore();
  const batch = store.createBatch({ fileName: 'general-upload.csv' });

  assert.equal(batch.institution_id, null);
  assert.equal(batch.uploaded_by, null);
});

test('maps multiple issues for one student to the same upload row', () => {
  const store = new SchemaStore();
  const batch = store.createBatch({ fileName: 'multiple-issues.csv' });
  const result = {
    rowNumber: 2,
    recordStatus: 'ACTION_REQUIRED',
    issues: [
      {
        code: 'INVALID_APAAR_FORMAT', severity: 'HIGH', field: 'apaar_id',
        message: 'APAAR format is invalid.', suggestedAction: 'Correct the APAAR ID.', humanReview: false
      },
      {
        code: 'INVALID_DOB', severity: 'HIGH', field: 'dob',
        message: 'DOB is invalid.', suggestedAction: 'Correct the DOB.', humanReview: false
      }
    ]
  };

  const persisted = store.persistValidation(batch, [{ student_id: 'SYN-002', apaar_id: 'ABC' }], [result]);
  const snapshot = store.schemaSnapshot(batch.batch_id);

  assert.equal(snapshot.upload_rows.length, 1);
  assert.equal(snapshot.validation_issues.length, 1);
  assert.equal(snapshot.validation_issues[0].row_id, snapshot.upload_rows[0].row_id);
  assert.deepEqual(result.schemaIssueIds, snapshot.validation_issues.map((issue) => issue.issue_id));
  assert.equal(snapshot.validation_issues[0].issue_code, 'MULTIPLE_ISSUES');
  assert.equal(snapshot.validation_issues[0].issue_details.length, 2);
  assert.equal(persisted.rows.length, 1);
});
