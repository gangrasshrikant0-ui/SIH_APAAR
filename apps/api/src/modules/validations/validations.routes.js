
const express = require("express");
const pool = require("../../db/pool");

const router = express.Router();

// GET /api/validations/issues
router.get("/issues", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                v.issue_id,
                v.row_id,
                v.issue_code,
                v.reason,
                v.severity,
                v.issue_status,
                v.created_at
            FROM public.validation_issues v
            ORDER BY v.issue_id
        `);

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
        const result = await pool.query(`
            SELECT
                issue_id,
                row_id,
                issue_code,
                reason,
                severity,
                issue_status
            FROM public.validation_issues
            WHERE issue_id = $1
        `, [id]);

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

module.exports = router;
