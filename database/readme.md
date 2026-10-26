
# APAAR Database Setup

## Requirements

- PostgreSQL 18 (used for the original schema export)
- PostgreSQL command-line tools
- A PostgreSQL administrator account

## Setup

1. Create an empty database named `apaar_platform`.
2. Connect as an administrator.
3. Execute `roles.sql`.
4. Import `schema_snapshot.sql` using psql.
5. Execute migrations in `database/migrations` in filename order.
6. Load the synthetic seed from `database/seeds/002_full_demo.sql` if needed.
7. Verify the 13 tables and 8 RLS policies.
8. Configure a restricted backend login locally and set `JWT_SECRET`.

## Important

- Use synthetic student records only.
- Never commit `.env` files or passwords.
- The schema snapshot contains table definitions, not student records.
- Existing databases should not be overwritten with the snapshot.
- Institution-specific development roles are not production authentication.
- Apply `database/migrations/001_api_role_privileges.sql` as an administrator
  before using the runtime API role. It removes the fixed College-A test-role
  membership and installs transaction-local RLS policies.
- `schema_snapshot.sql` is a historical reference and must not be replayed over a
  populated database. Apply incremental migrations only.
- The seeded demo users are intentionally inactive and cannot log in. Create
  active accounts through an administrator-controlled process using a bcrypt
  password hash; the API does not expose privileged registration.

## API configuration

Copy the repository `.env.example` to `apps/api/.env` and set every value,
including a randomly generated `JWT_SECRET`. Do not commit the resulting file.
The login endpoint is `POST /api/auth/login` with `{ "email", "password" }`.
Tokens are signed with HS256, include issuer and audience claims, and expire
after one hour.

## Automated tests

The API uses Node's built-in `node:test` runner, so no additional test framework
is required. Run `npm test` from `apps/api`. The npm script preloads the
gitignored `apps/api/.env.test.local` file, so a fresh PowerShell terminal does
not need `TEST_DATABASE_URL` exported manually. Copy
`apps/api/.env.test.local.example` to that path when provisioning a new machine.
The test bootstrap accepts only the local `apaar_ci_test` database on port
55432 and fails immediately if the file or database is unavailable. It never
falls back to `apaar_platform` or `apaar_test_restore`.

For a local isolated cluster on Windows, use a separate data directory and
port, then create `apaar_ci_test` there:

```powershell
& 'D:\postgreSQL\bin\initdb.exe' -D "$env:TEMP\apaar_ci_pgdata" --auth=trust --username=postgres
& 'D:\postgreSQL\bin\pg_ctl.exe' -D "$env:TEMP\apaar_ci_pgdata" -o '"-p 55432 -h 127.0.0.1"' -l "$env:TEMP\apaar_ci_pg.log" start
$env:PGHOST='127.0.0.1'; $env:PGPORT='55432'; $env:PGUSER='postgres'
& 'D:\postgreSQL\bin\createdb.exe' apaar_ci_test
& 'D:\postgreSQL\bin\psql.exe' -d apaar_ci_test -f database\roles.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_ci_test -f database\schema_snapshot.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_ci_test -f database\migrations\001_api_role_privileges.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_ci_test -f database\seeds\002_full_demo.sql
Copy-Item apps\api\.env.test.local.example apps\api\.env.test.local
Set-Location apps\api; npm test
```

The isolated cluster uses trust authentication only for local synthetic
testing. Do not use that configuration for a shared or production server.

## Setup verification

Run the following SQL in the new database:

SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

Expected result: 13.
