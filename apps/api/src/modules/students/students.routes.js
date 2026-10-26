const express = require("express");
const withTransaction = require("../../db/transaction");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT DISTINCT s.student_id, s.student_name,
                   right(s.apaar_id, 4) AS apaar_id_suffix,
                   s.identity_verification_status
            FROM public.students s
            JOIN public.enrolments e ON e.student_id = s.student_id
            ORDER BY s.student_id
        `));
        return res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
        console.error("Student query failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to fetch students" });
    }
});

module.exports = router;
