const express = require("express");
const withTransaction = require("../../db/transaction");

const router = express.Router();

router.post("/consents/:id/revoke", async (req, res) => {
    const consentId = Number(req.params.id);
    if (!Number.isSafeInteger(consentId) || consentId < 1) {
        return res.status(400).json({ success: false, message: "Invalid consent ID" });
    }
    try {
        const result = await withTransaction(req.user.institutionId, (client) => client.query(`
            UPDATE public.consents
            SET consent_status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP
            WHERE consent_id = $1
              AND consent_status = 'GRANTED'
              AND revoked_at IS NULL
            RETURNING consent_id, consent_status, revoked_at
        `, [consentId]));
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Active consent not found" });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error("Consent revocation failed:", error.message);
        return res.status(400).json({ success: false, message: "Unable to revoke consent" });
    }
});

router.post("/consents", async (req, res) => {
    const studentId = Number(req.body?.studentId);
    const purpose = typeof req.body?.purpose === "string" ? req.body.purpose.trim() : "";
    const expiresAt = req.body?.expiresAt || null;
    if (!Number.isSafeInteger(studentId) || studentId < 1 || !purpose || purpose.length > 100) {
        return res.status(400).json({ success: false, message: "Valid studentId and purpose are required" });
    }
    try {
        const result = await withTransaction(req.user.institutionId, async (client) => {
            const student = await client.query(
                "SELECT student_id FROM public.students WHERE student_id = $1",
                [studentId]
            );
            if (student.rows.length === 0) {
                return { notFound: true };
            }
            const consent = await client.query(`
                INSERT INTO public.consents (student_id, purpose, expires_at)
                VALUES ($1, $2, $3)
                RETURNING consent_id, student_id, purpose, consent_status, expires_at
            `, [studentId, purpose, expiresAt]);
            return consent.rows[0];
        });
        if (result.notFound) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error("Consent creation failed:", error.message);
        return res.status(400).json({ success: false, message: "Unable to create consent" });
    }
});

router.post("/requests", async (req, res) => {
    const studentId = Number(req.body?.studentId);
    const consentId = Number(req.body?.consentId);
    if (!Number.isSafeInteger(studentId) || !Number.isSafeInteger(consentId) ||
        studentId < 1 || consentId < 1) {
        return res.status(400).json({ success: false, message: "Valid studentId and consentId are required" });
    }
    try {
        const result = await withTransaction(req.user.institutionId, async (client) => {
            const consent = await client.query(`
                SELECT consent_id
                FROM public.consents
                WHERE consent_id = $1 AND student_id = $2
                  AND consent_status = 'GRANTED'
                  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                  AND revoked_at IS NULL
            `, [consentId, studentId]);
            if (consent.rows.length === 0) {
                return { consentInvalid: true };
            }
            const request = await client.query(`
                INSERT INTO public.verification_requests
                    (student_id, requested_by, consent_id, request_status, verification_result, completed_at)
                VALUES ($1, $2, $3, 'COMPLETED', 'NOT_VERIFIED', CURRENT_TIMESTAMP)
                RETURNING request_id, student_id, consent_id, request_status, verification_result
            `, [studentId, req.user.id, consentId]);
            return request.rows[0];
        });
        if (result.consentInvalid) {
            return res.status(403).json({ success: false, message: "Valid, unexpired consent is required" });
        }
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        console.error("Verification request failed:", error.message);
        return res.status(400).json({ success: false, message: "Unable to create verification request" });
    }
});

module.exports = router;
