const express = require("express");
const withTransaction = require("../../db/transaction");

const router = express.Router();

router.get("/me", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT institution_id, aicte_institution_code, institution_name,
                   campus_code, state, city, institution_status
            FROM public.institutions
            WHERE institution_id = $1
        `, [req.user.institutionId]));
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Institution not found" });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Institution lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to fetch institution" });
    }
});

router.get("/me/programmes", async (req, res) => {
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            SELECT programme_id, programme_code, programme_name, programme_level, programme_status
            FROM public.programmes
            WHERE institution_id = $1
            ORDER BY programme_id
        `, [req.user.institutionId]));
        return res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
        console.error("Programme lookup failed:", error.message);
        return res.status(500).json({ success: false, message: "Unable to fetch programmes" });
    }
});

module.exports = router;
