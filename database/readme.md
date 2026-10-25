
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
5. Verify the 13 tables and 8 RLS policies.
6. Configure a restricted backend login locally.

## Important

- Use synthetic student records only.
- Never commit `.env` files or passwords.
- The schema snapshot contains table definitions, not student records.
- Existing databases should not be overwritten with the snapshot.
- Institution-specific development roles are not production authentication.

## Setup verification

Run the following SQL in the new database:

SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

Expected result: 13.
