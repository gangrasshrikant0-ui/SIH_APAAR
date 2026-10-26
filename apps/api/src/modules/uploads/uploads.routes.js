
const express = require("express");
const withTransaction = require("../../db/transaction");
const { parseCsv, recordsToRows } = require("./csv");

const router = express.Router();

router.post("/", async (req, res) => {
    const fileName = typeof req.body?.fileName === "string"
        ? req.body.fileName.trim()
        : (req.is("text/csv") ? "upload.csv" : "");
    const csv = req.is("text/csv") ? req.body : req.body?.csv;

    if (!fileName || !/^[^\\/:*?"<>|]+\.csv$/i.test(fileName) ||
        typeof csv !== "string" || csv.length === 0 || csv.length > 5 * 1024 * 1024) {
        return res.status(400).json({
            success: false,
            message: "A CSV file name and non-empty CSV content up to 5 MB are required"
        });
    }

    let rows;
    try {
        rows = recordsToRows(parseCsv(csv));
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }

    try {
        const result = await withTransaction(req.user.institutionId, async (client) => {
            const programmes = await client.query(`
                SELECT programme_code, programme_id
                FROM public.programmes
                WHERE institution_id = $1 AND programme_status = 'ACTIVE'
            `, [req.user.institutionId]);
            const programmeIds = new Map(
                programmes.rows.map((programme) => [programme.programme_code.toLowerCase(), programme.programme_id])
            );
            const seenApaar = new Set();
            const batchResult = await client.query(`
                INSERT INTO public.upload_batches
                    (institution_id, uploaded_by, file_name, batch_status, total_rows)
                VALUES ($1, $2, $3, 'VALIDATING', $4)
                RETURNING batch_id
            `, [req.user.institutionId, req.user.id, fileName, rows.length]);
            const batchId = batchResult.rows[0].batch_id;
            let flaggedRows = 0;
            const rowIds = [];

            for (const row of rows) {
                const normalizedApaar = row.apaar_id || null;
                const normalizedPrn = row.prn || null;
                const issueList = [];
                if (!normalizedApaar) {
                    issueList.push(["MISSING_APAAR", "APAAR ID is required", "HIGH"]);
                } else if (!/^\d{12}$/.test(normalizedApaar)) {
                    issueList.push(["INVALID_APAAR", "APAAR ID must contain exactly 12 digits", "HIGH"]);
                } else if (seenApaar.has(normalizedApaar)) {
                    issueList.push(["DUPLICATE_APAAR", "APAAR ID is duplicated in this upload", "HIGH"]);
                }
                if (!row.student_name) {
                    issueList.push(["MISSING_STUDENT_NAME", "Student name is required", "MEDIUM"]);
                }
                if (!programmeIds.has(row.programme_code.toLowerCase())) {
                    issueList.push(["INVALID_PROGRAMME", "Programme is not active for this institution", "HIGH"]);
                }
                if (!/^\d{4}-\d{2}$/.test(row.academic_year)) {
                    issueList.push(["INVALID_ACADEMIC_YEAR", "Academic year must use YYYY-YY format", "MEDIUM"]);
                }
                if (normalizedApaar) {
                    seenApaar.add(normalizedApaar);
                }
                const rowStatus = issueList.length > 0 ? "ACTION_REQUIRED" : "READY_TO_ACCEPT";
                if (issueList.length > 0) {
                    flaggedRows += 1;
                }
                const rowResult = await client.query(`
                    INSERT INTO public.upload_rows
                        (batch_id, row_number, raw_data, normalized_apaar_id, normalized_prn, row_status)
                    VALUES ($1, $2, $3::jsonb, $4, $5, $6)
                    RETURNING row_id
                `, [
                    batchId,
                    row.row_number,
                    JSON.stringify(row),
                    normalizedApaar,
                    normalizedPrn,
                    rowStatus
                ]);
                rowIds.push(rowResult.rows[0].row_id);
                for (const [issueCode, reason, severity] of issueList) {
                    await client.query(`
                        INSERT INTO public.validation_issues
                            (row_id, issue_code, reason, severity, issue_status)
                        VALUES ($1, $2, $3, $4, 'OPEN')
                    `, [rowResult.rows[0].row_id, issueCode, reason, severity]);
                }
            }
            await client.query(`
                UPDATE public.upload_batches
                SET batch_status = $2, flagged_rows = $3
                WHERE batch_id = $1
            `, [batchId, flaggedRows > 0 ? "ACTION_REQUIRED" : "READY_TO_ACCEPT", flaggedRows]);
            return { batchId, flaggedRows, rowIds };
        });
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error("CSV upload failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to process CSV upload" });
    }
});

router.get("/", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT batch_id, institution_id,
                   file_name, batch_status, total_rows
            FROM public.upload_batches
            ORDER BY batch_id
        `));

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Upload error:", error.message);
        res.status(500).json({
            success: false,
            message: "Database query failed"
        });
    }
});

module.exports = router;
