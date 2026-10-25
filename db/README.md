# PostgreSQL setup for the validation backend

The canonical schema is one directory above this folder:

```text
../schemas.sql
```

Run that file once against an empty PostgreSQL database using pgAdmin Query
Tool or `psql`. Do not put passwords in `schemas.sql`.

## Values to configure

Create this file in either location:

```text
C:\Users\Pradnya\Desktop\CODING\SIH NEW\.env
```

or:

```text
C:\Users\Pradnya\Desktop\CODING\SIH NEW\db\.env
```

The backend checks the project-root `.env` first, then `db\.env`. Copy
`.env.example` into one of those locations and replace the placeholders:

```dotenv
DATABASE_URL=postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/YOUR_DB_NAME
PGSSL=disable
PGPOOL_MAX=10
PORT=8010
```

Do not commit `.env`. It is ignored by `.gitignore`.

## Optional upload context

The database connection values above are the only required environment
settings. Institution and uploader context belongs to an individual upload,
not to the server configuration. General validation uploads may omit both
values and the batch stores `NULL` for them. When context is known, include
these fields in the JSON request:

```json
{
  "institutionId": 12,
  "uploadedBy": 34,
  "csv": "student_id,apaar_id\n..."
}
```

The IDs must already exist because the schema has foreign keys:

The IDs must already exist because the schema has foreign keys:

```sql
SELECT institution_id, institution_name
FROM public.institutions
ORDER BY institution_id;

SELECT user_id, full_name, role, institution_id
FROM public.users
ORDER BY user_id;
```

Use an institution ID from the first query as `institutionId`, and a user ID
from the second query as `uploadedBy`. Do not invent IDs or put them in `.env`.

The uploaded user must satisfy the schema role rules. An `INSTITUTION` user
must have a non-null `institution_id`. For this local demo, the database user
must also have permission to insert into `upload_batches`, `upload_rows`,
`validation_issues`, and `issue_events`.

If the database was created from an older copy of the schema where these
columns were required, run this migration once:

```sql
ALTER TABLE public.upload_batches
  ALTER COLUMN institution_id DROP NOT NULL,
  ALTER COLUMN uploaded_by DROP NOT NULL;
```

If existing uploads currently have one database issue row per problem, run
[`migration_one_issue_row_per_student.sql`](migration_one_issue_row_per_student.sql)
once after the schema migration. It consolidates each student's issue rows into
one `validation_issues` row and preserves the individual issue details in
`issue_details`.

## Start and verify

From the project root:

```powershell
npm install
npm start
```

Check:

```text
http://localhost:8010/api/validation/db-health
```

Expected connected response:

```json
{
  "mode": "POSTGRESQL",
  "connected": true,
  "database": "your_database",
  "user": "your_db_user",
  "serverTime": "..."
}
```

If `DATABASE_URL` is absent, the backend deliberately uses the in-memory
demo adapter. If the connection fails, the health endpoint returns the
provider error without exposing the password.

After a successful health check, upload the synthetic CSV from
`../test-data/apaar_validation_test.csv`. Verify the inserted records:

```sql
SELECT * FROM public.upload_batches ORDER BY batch_id DESC LIMIT 1;
SELECT * FROM public.upload_rows ORDER BY row_id DESC LIMIT 5;
SELECT * FROM public.validation_issues ORDER BY issue_id DESC LIMIT 10;
SELECT * FROM public.issue_events ORDER BY event_id DESC LIMIT 10;
```
