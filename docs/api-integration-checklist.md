# API integration checklist

- [ ] Copy `apps/api/.env.test.local.example` to `apps/api/.env.test.local`.
- [ ] Confirm the API points to the disposable database for local tests.
- [ ] Apply `database/roles.sql`, `database/schema_snapshot.sql`, the migration,
      and `database/seeds/002_full_demo.sql` in that order on a new database.
- [ ] Confirm `apaar_app` is not a superuser, table owner, inherited privileged
      role, or `BYPASSRLS` role.
- [ ] Confirm every API request uses a bearer token except login.
- [ ] Store the token in memory or an approved secret store; never commit it.
- [ ] Use institution-scoped routes rather than passing a caller-selected
      institution ID.
- [ ] Mask APAAR identifiers in UI displays; the student endpoint returns only
      the final four digits.
- [ ] Upload CSV columns: `apaar_id`, `student_name`, `prn`, `programme_code`,
      `academic_year`.
- [ ] Handle `400`, `401`, `403`, `404`, `409`, `429`, and `500` responses.
- [ ] Treat `PENDING_REVIEW` as not yet eligible for enrolment acceptance.
- [ ] Obtain active, unexpired consent before creating a verification request.
- [ ] Run `npm test` and confirm 17 passed, 0 failed, 0 skipped.
- [ ] Confirm the complete demo flow uses synthetic records only.

## Current backend boundaries

- No frontend is included in this branch.
- No asynchronous revalidation worker is implemented; correction records
  `PENDING_REVIEW`.
- Verification is simulated and returns `NOT_VERIFIED`.
- Accounts are not self-registering; active accounts require an administrator
  fixture or an integration test setup.
