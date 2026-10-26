
-- APAAR development database roles
-- Execute using a PostgreSQL administrator.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'apaar_test_a'
    ) THEN
        CREATE ROLE apaar_test_a NOLOGIN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'apaar_test_b'
    ) THEN
        CREATE ROLE apaar_test_b NOLOGIN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'apaar_app'
    ) THEN
        CREATE ROLE apaar_app NOLOGIN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'apaar_readonly'
    ) THEN
        CREATE ROLE apaar_readonly NOLOGIN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_roles
        WHERE rolname = 'apaar_api_a'
    ) THEN
        CREATE ROLE apaar_api_a NOLOGIN;
    END IF;
END
$$;
