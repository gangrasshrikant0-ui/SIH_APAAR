
const express = require("express");
const pool = require("./db/pool");

const app = express();

app.use(express.json());

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
app.get("/api/institutions", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                institution_id,
                aicte_institution_code,
                institution_name
            FROM public.institutions
            ORDER BY institution_id
        `);

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

app.use("/api/uploads", uploadsRouter);


const validationsRouter =
    require("./modules/validations/validations.routes");

app.use("/api/validations", validationsRouter);


module.exports = app;
