
const express = require("express");
const withTransaction = require("../../db/transaction");

const router = express.Router();

// GET /api/validations/issues
router.get("/issues", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT
                v.issue_id,
                v.row_id,
                v.issue_code,
                v.reason,
                v.severity,
                v.issue_status,
                v.created_at
            FROM public.validation_issues v
            JOIN public.upload_rows r ON r.row_id = v.row_id
            JOIN public.upload_batches b ON b.batch_id = r.batch_id
            ORDER BY v.issue_id
        `));

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Validation issues query:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch validation issues"
        });
    }
});

// GET /api/validations/issues/:id
router.get("/issues/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid issue ID"
        });
    }

    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT
                issue_id,
                row_id,
                issue_code,
                reason,
                severity,
                issue_status
            FROM public.validation_issues
            WHERE issue_id = $1
        `, [id]));

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Issue not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Issue lookup:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch issue"
        });
    }
});

router.post("/issues/:id/correction", async (req, res) => {
    const issueId = Number(req.params.id);
    const correction = req.body || {};
    const apaarId = typeof correction.apaar_id === "string"
        ? correction.apaar_id.trim()
        : "";
    const studentName = typeof correction.student_name === "string"
        ? correction.student_name.trim()
        : "";
    const prn = typeof correction.prn === "string" ? correction.prn.trim() : "";

    if (!Number.isSafeInteger(issueId) || issueId < 1 ||
        !/^\d{12}$/.test(apaarId) || !studentName || studentName.length > 150 ||
        !prn || prn.length > 50) {
        return res.status(400).json({
            success: false,
            message: "A valid APAAR ID, student name, and PRN are required"
        });
    }

    try {
        const result = await withTransaction(req.user.institutionId, async (client) => {
            const issueResult = await client.query(`
                SELECT v.issue_id, v.issue_status, v.row_id, r.raw_data
                FROM public.validation_issues v
                JOIN public.upload_rows r ON r.row_id = v.row_id
                WHERE v.issue_id = $1
                FOR UPDATE
            `, [issueId]);
            const issue = issueResult.rows[0];
            if (!issue) {
                return { notFound: true };
            }
            if (!["OPEN", "ASSIGNED", "IN_CORRECTION", "REJECTED"].includes(issue.issue_status)) {
                return { invalidTransition: true, status: issue.issue_status };
            }

            const rawData = {
                ...issue.raw_data,
                apaar_id: apaarId,
                student_name: studentName,
                prn
            };
            await client.query(`
                UPDATE public.upload_rows
                SET raw_data = $2::jsonb,
                    normalized_apaar_id = $3,
                    normalized_prn = $4,
                    row_status = 'PENDING_REVIEW',
                    updated_at = CURRENT_TIMESTAMP
                WHERE row_id = $1
            `, [issue.row_id, JSON.stringify(rawData), apaarId, prn]);
            await client.query(`
                UPDATE public.validation_issues
                SET issue_status = 'PENDING_REVIEW', updated_at = CURRENT_TIMESTAMP
                WHERE issue_id = $1
            `, [issueId]);
            await client.query(`
                SELECT public.record_issue_event(
                    $1, $2, 'CORRECTION_SUBMITTED', $3, 'PENDING_REVIEW', $4
                )
            `, [issueId, req.user.id, issue.issue_status, "Correction submitted for revalidation"]);
            return { issueId, status: "PENDING_REVIEW" };
        });
        if (result.notFound) {
            return res.status(404).json({ success: false, message: "Issue not found" });
        }
        if (result.invalidTransition) {
            return res.status(409).json({
                success: false,
                message: `Issue cannot be corrected from ${result.status}`
            });
        }
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error("Issue correction failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to submit correction" });
    }
});

module.exports = router;
