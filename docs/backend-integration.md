# Backend integration guide

This guide covers the synthetic APAAR API, disposable database setup, migration
readiness checks, and the complete demonstration flow for the SIH team.

## Local setup

Requirements: PostgreSQL 18, PostgreSQL command-line tools, and Node.js.

1. Copy [.env.example](../.env.example) to `apps/api/.env`.
2. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and a random
   `JWT_SECRET`. Never commit `apps/api/.env`.
3. Create the database and apply the database files as an administrator:

```powershell
& 'D:\postgreSQL\bin\createdb.exe' apaar_platform
& 'D:\postgreSQL\bin\psql.exe' -d apaar_platform -f database\roles.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_platform -f database\schema_snapshot.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_platform -f database\migrations\001_api_role_privileges.sql
& 'D:\postgreSQL\bin\psql.exe' -d apaar_platform -f database\seeds\002_full_demo.sql
```

The migration must be applied before the API runtime role is used. It is
repeatable on the tested schema: grants and revokes are safe to repeat,
transaction-local policies are dropped and recreated, and security-definer
functions use `CREATE OR REPLACE`. Review warnings for missing role
memberships; they are expected when the old test memberships are absent.

## Disposable integration database

The integration suite is intentionally restricted to
`127.0.0.1:55432/apaar_ci_test` without a password. Copy
[.env.test.local.example](../apps/api/.env.test.local.example) to
`apps/api/.env.test.local`, then run:

```powershell
Set-Location apps\api
npm test
```

The test bootstrap rejects other database URLs and does not fall back to
`apaar_platform` or `apaar_test_restore`.

## Safe migration rehearsal

Do not run the migration on an existing development database without approval.
Create a local custom-format backup first:

```powershell
& 'D:\postgreSQL\bin\pg_dump.exe' -Fc --no-owner --no-acl `
  -d apaar_platform -f "$env:TEMP\apaar_platform_safe_copy.dump"
```

Restore that dump into a new temporary cluster/database, apply
`roles.sql` and `001_api_role_privileges.sql`, and run `npm test` against the
temporary database. Roll back a rehearsal by stopping the temporary cluster
and deleting only its temporary data directory. For an approved production
change, restore the backup into a separate database and reverse only the
privileges/policies introduced by the migration; do not replay the historical
schema snapshot over a populated database.

Before approval, compare table owners, role memberships, `BYPASSRLS`, default
privileges, existing policies, and function execute privileges. The current
development database inspection found 13 public tables and no existing
`apaar_app` runtime grants or `runtime_*` policies.

## Synthetic accounts and fixtures

The seed creates inactive demo accounts:

- `demo.college.a@example.invalid`
- `demo.college.b@example.invalid`

They intentionally cannot log in. Create an active disposable account through
an administrator-controlled SQL fixture using a bcrypt hash generated locally;
do not place a password or hash in source control. The test suite creates its
own random active account and password at runtime.

Use [upload.csv](../samples/upload.csv) for the upload request. The API accepts
either JSON (`fileName` plus `csv`) or `text/csv` with a `.csv` filename.

## Endpoint sequence

All endpoints except login require `Authorization: Bearer <token>`.

1. `POST /api/auth/login`
2. `GET /api/institutions/me` and `GET /api/institutions/me/programmes`
3. `POST /api/uploads` with [upload.csv](../samples/upload.csv)
4. `GET /api/validations/issues`
5. `POST /api/validations/issues/{id}/correction`
6. Re-run validation in the client by fetching the issue list. The current API
   records corrections as `PENDING_REVIEW`; it does not expose a separate
   asynchronous revalidation worker.
7. `POST /api/enrolments/accept` for a row in `READY_TO_ACCEPT`
8. `POST /api/verification/consents`
9. `POST /api/verification/requests`
10. `GET /api/students` and `GET /api/enrolments` for final status.

The verification route returns the simulated `NOT_VERIFIED` result used by the
current backend. An external identity-verification provider is not implemented.
