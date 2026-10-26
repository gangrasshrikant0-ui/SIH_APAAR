const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../db/pool");

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function isValidEmail(value) {
    return typeof value === "string" &&
        value.length <= 255 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRateLimited(key) {
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || now - entry.startedAt >= WINDOW_MS) {
        attempts.set(key, { startedAt: now, count: 1 });
        return false;
    }
    entry.count += 1;
    return entry.count > MAX_ATTEMPTS;
}

router.post("/login", async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const key = `${req.ip}:${email}`;

    if (!isValidEmail(email) || password.length < 1 || password.length > 200) {
        return res.status(400).json({
            success: false,
            message: "A valid email and password are required"
        });
    }
    if (isRateLimited(key)) {
        return res.status(429).json({
            success: false,
            message: "Too many login attempts"
        });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: "Authentication is not configured"
        });
    }

    try {
        const result = await pool.query(`
            SELECT user_id, institution_id, full_name, password_hash, role, account_status
            FROM public.users
            WHERE lower(email) = $1
        `, [email]);
        const user = result.rows[0];
        const passwordMatches = user
            ? await bcrypt.compare(password, user.password_hash)
            : false;

        if (!user || user.account_status !== "ACTIVE" || !passwordMatches ||
            !["INSTITUTION", "AICTE", "VERIFIER"].includes(user.role)) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign({
            userId: user.user_id,
            institutionId: user.institution_id,
            role: user.role
        }, process.env.JWT_SECRET, {
            algorithm: "HS256",
            issuer: "apaar-api",
            audience: "apaar-platform",
            expiresIn: "1h"
        });

        attempts.delete(key);
        return res.json({
            success: true,
            token,
            user: {
                id: user.user_id,
                name: user.full_name,
                role: user.role,
                institutionId: user.institution_id
            }
        });
    } catch (error) {
        console.error("Login failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Unable to authenticate"
        });
    }
});

module.exports = router;
