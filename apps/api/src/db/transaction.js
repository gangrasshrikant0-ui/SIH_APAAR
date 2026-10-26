const pool = require("./pool");

async function withTransaction(institutionId, work) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        if (institutionId != null) {
            await client.query(
                "SELECT set_config('app.institution_id', $1, true)",
                [String(institutionId)]
            );
        }
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            error.rollbackError = rollbackError;
        }
        throw error;
    } finally {
        client.release();
    }
}

module.exports = withTransaction;