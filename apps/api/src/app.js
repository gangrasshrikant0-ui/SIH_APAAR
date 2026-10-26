
const express = require("express");
const pool = require("./db/pool");
const requireAuth = require("./middleware/auth");
const { requireRole } = require("./middleware/auth");
const app = express();

app.use(express.json());
app.use(express.text({ type: "text/csv", limit: "5mb" }));

const authRouter = require("./modules/auth/auth.routes");
app.use("/api/auth", authRouter);

// Database health check
app.get("/api/health/db", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            status: "ok",
            database: "connected"
        });
    } catch (error) {
        console.error("Database connection failed");

        res.status(503).json({
            status: "error",
            database: "unavailable"
        });
    }
});

// Local development: read institution directory
app.get("/api/institutions", requireAuth, async (req, res) => {
    try {
        const condition = req.user.role === "INSTITUTION"
            ? "WHERE institution_id = $1"
            : "";
        const parameters = req.user.role === "INSTITUTION"
            ? [req.user.institutionId]
            : [];
        const result = await pool.query(`
            SELECT
                institution_id,
                aicte_institution_code,
                institution_name
            FROM public.institutions
            ${condition}
            ORDER BY institution_id
        `, parameters);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("Institution query failed");

        res.status(500).json({
            success: false,
            message: "Unable to fetch institutions"
        });
    }
});


const uploadsRouter = require("./modules/uploads/uploads.routes");
const institutionsRouter = require("./modules/institutions/institutions.routes");
const studentsRouter = require("./modules/students/students.routes");
const verificationRouter = require("./modules/verification/verification.routes");

app.use("/api/uploads", requireAuth, uploadsRouter);
app.use("/api/institutions", requireAuth, requireRole("INSTITUTION", "AICTE", "VERIFIER"), institutionsRouter);
app.use("/api/students", requireAuth, requireRole("INSTITUTION", "VERIFIER"), studentsRouter);
app.use("/api/verification", requireAuth, requireRole("INSTITUTION", "VERIFIER"), verificationRouter);
const validationsRouter =
    require("./modules/validations/validations.routes");
app.use("/api/validations", requireAuth, validationsRouter);


const enrolmentsRouter =
    require("./modules/enrolments/enrolments.routes");

app.use("/api/enrolments", requireAuth, enrolmentsRouter);





module.exports = app;
