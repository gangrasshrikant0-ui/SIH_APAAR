const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../src/db/pool");

const app = require("../src/app");

let server;
let baseUrl;
let canReadUsers = false;

test.before(async () => {
    try {
        const passwordHash = await bcrypt.hash(process.env.TEST_ACTIVE_LOGIN_PASSWORD, 12);
        await pool.query(`
            INSERT INTO public.users
                (institution_id, full_name, email, password_hash, role, account_status)
            VALUES ($1, $2, $3, $4, 'INSTITUTION', 'ACTIVE')
        `, [
            1,
            "Disposable CI Active User",
            process.env.TEST_ACTIVE_LOGIN_EMAIL,
            passwordHash
        ]);
        const result = await pool.query(
            "SELECT has_table_privilege(current_user, 'public.users', 'SELECT') AS permitted"
        );
        canReadUsers = result.rows[0].permitted;
        if (!canReadUsers) {
            throw new Error("Disposable runtime role cannot read public.users");
        }
    } catch (error) {
        throw new Error(`Disposable PostgreSQL setup failed: ${error.message}`);
    }
    await new Promise((resolve) => {
        server = app.listen(0, "127.0.0.1", () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
});

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { status: response.status, body };
}

function token(claims = {}, options = {}) {
    const { ...payload } = claims;
    return jwt.sign({
        userId: 1,
        institutionId: 1,
        role: "INSTITUTION",
        ...payload
    }, process.env.JWT_SECRET, {
        algorithm: "HS256",
        issuer: "apaar-api",
        audience: "apaar-platform",
        expiresIn: options.expiresIn || "1h"
    });
}

test("protected API requests require a bearer token", async () => {
    const result = await request("/api/enrolments");
    assert.equal(result.status, 401);
});

test("malformed, expired, and unsupported-role tokens are rejected", async (t) => {
    for (const value of ["not-a-jwt", token({}, { expiresIn: "-1s" }), token({ role: "ADMIN" })]) {
        const result = await request("/api/enrolments", {
            headers: { authorization: `Bearer ${value}` }
        });
        assert.equal(result.status, 401, `unexpected status for token case ${t.name}`);
    }
});

test("role-restricted endpoints reject unauthorized roles", async () => {
    const result = await request("/api/students", {
        headers: { authorization: `Bearer ${token({ role: "AICTE", institutionId: null })}` }
    });
    assert.equal(result.status, 403);
});

test("login rejects malformed credentials", async () => {
    const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "invalid", password: "" })
    });
    assert.equal(result.status, 400);
});

test("inactive synthetic demo account cannot log in", async (t) => {
    if (!canReadUsers) {
        t.skip("configured database role cannot read users; apply runtime migration to a disposable database");
        return;
    }
    const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            email: "demo.college.a@example.invalid",
            password: crypto.randomUUID()
        })
    });
    assert.equal(result.status, 401);
});

test("successful login requires a disposable active account", { skip: !process.env.TEST_ACTIVE_LOGIN_EMAIL }, async () => {
    const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            email: process.env.TEST_ACTIVE_LOGIN_EMAIL,
            password: process.env.TEST_ACTIVE_LOGIN_PASSWORD
        })
    });
    assert.equal(result.status, 200);
    assert.equal(typeof result.body.token, "string");
});

test("institution-scoped API surfaces return seeded records", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const headers = { authorization: `Bearer ${token()}` };
    for (const path of [
        "/api/institutions/me",
        "/api/institutions/me/programmes",
        "/api/students",
        "/api/uploads",
        "/api/validations/issues",
        "/api/enrolments"
    ]) {
        const result = await request(path, { headers });
        assert.equal(result.status, 200, `${path} returned ${result.status}`);
        assert.equal(result.body.success, true, `${path} did not return success`);
    }
});

test("institution B cannot observe institution A records", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const result = await request("/api/enrolments", {
        headers: {
            authorization: `Bearer ${token({ institutionId: 2 })}`
        }
    });
    assert.equal(result.status, 200);
    assert.ok(result.body.data.every((row) => row.institution_id !== 1));
});

test("CSV upload creates rows and structured validation issues", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const csv = [
        "apaar_id,student_name,prn,programme_code,academic_year",
        "900000123456,Upload Test A,CI-UPLOAD-1,COMP,2026-27",
        ",Upload Test Missing,CI-UPLOAD-2,COMP,2026-27",
        "bad,Upload Test Invalid,CI-UPLOAD-3,COMP,2026-27"
    ].join("\n");
    const result = await request("/api/uploads", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ fileName: "ci-upload.csv", csv })
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    assert.equal(result.body.data.flaggedRows, 2);

    const issues = await request("/api/validations/issues", {
        headers: { authorization: `Bearer ${token()}` }
    });
    assert.equal(issues.status, 200);
    assert.ok(issues.body.data.some((issue) => issue.issue_code === "MISSING_APAAR"));
    assert.ok(issues.body.data.some((issue) => issue.issue_code === "INVALID_APAAR"));
});

test("issue correction moves a row to pending review", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const issues = await request("/api/validations/issues", {
        headers: { authorization: `Bearer ${token()}` }
    });
    const issue = issues.body.data
        .filter((entry) => entry.issue_code === "MISSING_APAAR" && entry.issue_status === "OPEN")
        .sort((left, right) => right.issue_id - left.issue_id)[0];
    assert.ok(issue);
    const result = await request(`/api/validations/issues/${issue.issue_id}/correction`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            apaar_id: "900000999999",
            student_name: "Corrected Synthetic Student",
            prn: "CI-CORRECTED-1"
        })
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.status, "PENDING_REVIEW");
});

test("verification requires active consent and returns a simulated result", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const students = await request("/api/students", {
        headers: { authorization: `Bearer ${token()}` }
    });
    const studentId = students.body.data[0].student_id;
    const denied = await request("/api/verification/requests", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ studentId, consentId: 999999999 })
    });
    assert.equal(denied.status, 403);

    const consent = await request("/api/verification/consents", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            purpose: `Synthetic verification test ${Date.now()}`
        })
    });
    assert.equal(consent.status, 201);
    const verified = await request("/api/verification/requests", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ studentId, consentId: consent.body.data.consent_id })
    });
    assert.equal(verified.status, 201);
    assert.equal(verified.body.data.verification_result, "NOT_VERIFIED");
});

test("verification rejects expired and revoked consent", { skip: !process.env.TEST_DATABASE_URL }, async () => {
    const students = await request("/api/students", {
        headers: { authorization: `Bearer ${token()}` }
    });
    const studentId = students.body.data[0].student_id;
    const expiredConsent = await request("/api/verification/consents", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            purpose: `Expired consent ${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 100).toISOString()
        })
    });
    assert.equal(expiredConsent.status, 201);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const expiredRequest = await request("/api/verification/requests", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            consentId: expiredConsent.body.data.consent_id
        })
    });
    assert.equal(expiredRequest.status, 403);

    const activeConsent = await request("/api/verification/consents", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            purpose: `Revoked consent ${crypto.randomUUID()}`
        })
    });
    assert.equal(activeConsent.status, 201);
    const revoked = await request(
        `/api/verification/consents/${activeConsent.body.data.consent_id}/revoke`,
        {
            method: "POST",
            headers: { authorization: `Bearer ${token()}` }
        }
    );
    assert.equal(revoked.status, 200);
    const revokedRequest = await request("/api/verification/requests", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token()}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            studentId,
            consentId: activeConsent.body.data.consent_id
        })
    });
    assert.equal(revokedRequest.status, 403);
});

test("valid uploaded rows can be accepted transactionally", {
    skip: !process.env.TEST_DATABASE_URL || !process.env.TEST_ACTIVE_LOGIN_EMAIL
}, async () => {
    const activeUser = await pool.query(
        "SELECT user_id FROM public.users WHERE email = $1 AND account_status = 'ACTIVE'",
        [process.env.TEST_ACTIVE_LOGIN_EMAIL]
    );
    assert.equal(activeUser.rows.length, 1);
    const csv = [
        "apaar_id,student_name,prn,programme_code,academic_year",
        `900000${String(Date.now()).slice(-6)},Acceptance Test,CI-ACCEPT-${crypto.randomUUID()},COMP,2026-27`
    ].join("\n");
    const upload = await request("/api/uploads", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token({ userId: activeUser.rows[0].user_id })}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ fileName: "acceptance.csv", csv })
    });
    assert.equal(upload.status, 201);
    const accepted = await request("/api/enrolments/accept", {
        method: "POST",
        headers: {
            authorization: `Bearer ${token({ userId: activeUser.rows[0].user_id })}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ rowId: upload.body.data.rowIds[0] })
    });
    assert.equal(accepted.status, 201);
    assert.ok(accepted.body.data.enrolment_id);
});
