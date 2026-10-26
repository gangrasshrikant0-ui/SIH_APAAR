
const pool = require("./src/db/pool");

async function testDatabase() {
    try {
        const result = await pool.query(`
            SELECT
                current_database() AS database,
                current_user AS db_user,
                (SELECT COUNT(*) FROM public.upload_batches)
                    AS visible_batches,
                (SELECT COUNT(*) FROM public.upload_rows)
                    AS visible_rows,
                (SELECT COUNT(*) FROM public.enrolments)
                    AS visible_enrolments
        `);

        console.table(result.rows);
    } catch (error) {
        console.error("Database test failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

testDatabase();
