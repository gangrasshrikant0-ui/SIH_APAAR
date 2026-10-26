
const express = require("express");
const withTransaction = require("../../db/transaction");

const router = express.Router();

router.post("/accept", async (req, res) => {
    const rowId = Number(req.body?.rowId);
    if (!Number.isSafeInteger(rowId) || rowId < 1) {
        return res.status(400).json({ success: false, message: "A valid rowId is required" });
    }
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(
            "SELECT * FROM public.accept_upload_row($1, $2)",
            [rowId, req.user.id]
        ));
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Enrolment acceptance failed:", error.message);
        return res.status(409).json({ success: false, message: error.message });
    }
});

// GET /api/enrolments
router.get("/", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT
                enrolment_id,
                institution_id,
                programme_id,
                academic_year,
                admission_category,
                enrolment_status
            FROM public.enrolments
            ORDER BY enrolment_id
        `));

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (error) {
        console.error("Enrolment query failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch enrolments"
        });
    }
});

// GET /api/enrolments/:id
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({
            success: false,
            message: "Invalid enrolment ID"
        });
    }

    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT
                enrolment_id,
                programme_id,
                academic_year,
                admission_category,
                enrolment_status
            FROM public.enrolments
            WHERE enrolment_id = $1
        `, [id]));

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Enrolment not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("Enrolment lookup failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch enrolment"
        });
    }
});

module.exports = router;
