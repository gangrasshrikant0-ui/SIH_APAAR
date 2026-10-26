const test = require("node:test");
const assert = require("node:assert/strict");
const { Client } = require("pg");

const databaseUrl = process.env.TEST_DATABASE_URL;

test("runtime role is not a superuser or BYPASSRLS role", { skip: !databaseUrl }, async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        const result = await client.query(`
            SELECT rolsuper, rolbypassrls
            FROM pg_roles
            WHERE rolname = current_user
        `);
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0].rolsuper, false);
        assert.equal(result.rows[0].rolbypassrls, false);
    } finally {
        await client.end();
    }
});

test("transaction-local tenant context isolates reads and writes", { skip: !databaseUrl }, async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.institution_id', '1', true)");
        const visible = await client.query("SELECT institution_id FROM public.upload_batches");
        assert.ok(visible.rows.length > 0);
        assert.ok(visible.rows.every((row) => row.institution_id === 1));

        const update = await client.query(
            "UPDATE public.upload_batches SET file_name = file_name WHERE institution_id = 2"
        );
        assert.equal(update.rowCount, 0);
        await client.query("ROLLBACK");
    } finally {
        await client.end();
    }
});

test("pooled transactions do not retain tenant context", { skip: !databaseUrl }, async () => {
    const first = new Client({ connectionString: databaseUrl });
    const second = new Client({ connectionString: databaseUrl });
    await Promise.all([first.connect(), second.connect()]);
    try {
        await Promise.all([
            (async () => {
                await first.query("BEGIN");
                await first.query("SELECT set_config('app.institution_id', '1', true)");
                const result = await first.query("SELECT institution_id FROM public.upload_batches");
                assert.ok(result.rows.every((row) => row.institution_id === 1));
                await first.query("COMMIT");
            })(),
            (async () => {
                await second.query("BEGIN");
                await second.query("SELECT set_config('app.institution_id', '2', true)");
                const result = await second.query("SELECT institution_id FROM public.upload_batches");
                assert.ok(result.rows.every((row) => row.institution_id === 2));
                await second.query("COMMIT");
            })()
        ]);
    } finally {
        await Promise.all([first.end(), second.end()]);
    }
});

test("runtime role cannot insert, update, or delete audit history", { skip: !databaseUrl }, async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        await assert.rejects(
            client.query(`
                INSERT INTO public.audit_logs
                    (actor_id, action, entity_type, entity_id, outcome)
                VALUES (NULL, 'TEST', 'TEST', NULL, 'SUCCESS')
            `),
            /permission denied/
        );
        await assert.rejects(
            client.query("UPDATE public.audit_logs SET action = action"),
            /permission denied/
        );
        await assert.rejects(
            client.query("DELETE FROM public.audit_logs"),
            /permission denied/
        );
        await assert.rejects(
            client.query(`
                INSERT INTO public.issue_events
                    (issue_id, actor_id, action, change_summary)
                VALUES (1, NULL, 'COMMENT_ADDED', 'unauthorized direct write')
            `),
            /permission denied/
        );
    } finally {
        await client.end();
    }
});
