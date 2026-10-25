
const express = require("express");
const pool = require("../../db/pool");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT batch_id, institution_id,
                   file_name, batch_status, total_rows
            FROM public.upload_batches
            ORDER BY batch_id
        `);

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
