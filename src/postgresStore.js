const { Pool } = require('pg');

class PostgresStore {
  constructor({ connectionString = process.env.DATABASE_URL } = {}) {
    if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL mode.');
    this.pool = new Pool({
      connectionString,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.PGPOOL_MAX || 10)
    });
  }

  async health() {
    const result = await this.pool.query('SELECT current_database() AS database, current_user AS user_name, NOW() AS server_time');
    return { connected: true, database: result.rows[0].database, user: result.rows[0].user_name,
      serverTime: result.rows[0].server_time };
  }

  async createBatch({ institutionId = null, uploadedBy = null, fileName, totalRows }) {
    const result = await this.pool.query(
      `INSERT INTO public.upload_batches
       (institution_id, uploaded_by, file_name, total_rows, batch_status)
       VALUES ($1, $2, $3, $4, 'UPLOADED')
       RETURNING batch_id, institution_id, uploaded_by, file_name, uploaded_at,
                 batch_status, total_rows, accepted_rows, flagged_rows`,
      [institutionId, uploadedBy, fileName, totalRows]
    );
    return result.rows[0];
  }

  async persistValidation(batch, rows, validationResults) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE public.upload_batches
        SET batch_status = 'VALIDATING', total_rows = $2
        WHERE batch_id = $1`, [batch.batch_id, validationResults.length]);

      const storedRows = [];
      for (let index = 0; index < validationResults.length; index += 1) {
        const result = validationResults[index];
        const source = rows[index];
        const rowResult = await client.query(
          `INSERT INTO public.upload_rows
           (batch_id, row_number, raw_data, normalized_apaar_id, row_status)
           VALUES ($1, $2, $3::jsonb, NULLIF($4, ''), $5)
           RETURNING row_id, batch_id, row_number, raw_data, normalized_apaar_id,
                     row_status, submitted_at, updated_at`,
          [batch.batch_id, result.rowNumber, JSON.stringify(source),
            String(source.apaar_id || '').trim(), result.recordStatus]
        );
        const uploadRow = rowResult.rows[0];
        storedRows.push(uploadRow);
        result.schemaRowId = uploadRow.row_id;
        result.schemaIssueIds = [];
        if (result.issues.length > 0) {
          const issueStatus = result.issues.some((item) => item.humanReview)
            ? 'PENDING_REVIEW' : 'OPEN';
          const severityRank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
          const highestSeverity = result.issues.reduce((highest, item) =>
            severityRank[item.severity] > severityRank[highest] ? item.severity : highest, 'LOW');
          const issueDetails = JSON.stringify(result.issues);
          const issueCode = result.issues.length === 1 ? result.issues[0].code : 'MULTIPLE_ISSUES';
          const reason = result.issues.map((item) => item.message).join(' ');
          const issueResult = await client.query(
            `INSERT INTO public.validation_issues
             (row_id, issue_code, reason, issue_details, severity, issue_status)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6)
             RETURNING issue_id, row_id, issue_code, reason, severity, issue_status,
                       issue_details, assigned_to, due_at, created_at, updated_at`,
            [uploadRow.row_id, issueCode, reason, issueDetails, highestSeverity, issueStatus]
          );
          const issueRow = issueResult.rows[0];
          result.schemaIssueIds.push(issueRow.issue_id);
          await client.query(
            `INSERT INTO public.issue_events
             (issue_id, action, new_status, change_summary)
             VALUES ($1, 'DETECTED', $2, $3)`,
            [issueRow.issue_id, issueRow.issue_status, reason]
          );
        }
      }

      const batchStatus = validationResults.some((result) => result.recordStatus === 'ACTION_REQUIRED')
        ? 'ACTION_REQUIRED' : validationResults.some((result) => result.recordStatus === 'PENDING_REVIEW')
          ? 'PENDING_REVIEW' : 'READY_TO_ACCEPT';
      const acceptedRows = validationResults.filter((result) => result.recordStatus === 'READY_TO_ACCEPT').length;
      const flaggedRows = validationResults.filter((result) => result.issues.length > 0).length;
      const finalBatch = await client.query(
        `UPDATE public.upload_batches
         SET batch_status = $2, accepted_rows = $3, flagged_rows = $4, total_rows = $5
         WHERE batch_id = $1
         RETURNING batch_id, institution_id, uploaded_by, file_name, uploaded_at,
                   batch_status, total_rows, accepted_rows, flagged_rows`,
        [batch.batch_id, batchStatus, acceptedRows, flaggedRows, validationResults.length]
      );
      await client.query('COMMIT');
      return { batch: finalBatch.rows[0], rows: storedRows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresStore };
