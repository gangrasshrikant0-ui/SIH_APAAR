-- Incremental privileges for the restricted API role.
-- Run as a database administrator after schema_snapshot.sql.
-- The API role must not own these tables and must not have BYPASSRLS.

GRANT USAGE ON SCHEMA public TO apaar_app;
GRANT SELECT, INSERT, UPDATE ON
    public.institutions,
    public.programmes,
    public.approval_master,
    public.users,
    public.upload_batches,
    public.upload_rows,
    public.students,
    public.enrolments,
    public.validation_issues,
    public.consents,
    public.verification_requests
TO apaar_app;
GRANT SELECT ON public.issue_events TO apaar_app;
REVOKE INSERT, UPDATE, DELETE ON public.issue_events FROM apaar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO apaar_app;

REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM apaar_app;
REVOKE INSERT ON public.students FROM apaar_app;
ALTER ROLE apaar_app NOBYPASSRLS;

-- Remove the fixed College-A test membership from runtime logins.
REVOKE apaar_test_a FROM apaar_api_a;
REVOKE apaar_test_b FROM apaar_api_a;

-- Runtime RLS uses a transaction-local value set by the trusted API boundary.
-- Requests must use one checked-out client for the whole transaction.
CREATE OR REPLACE FUNCTION public.current_api_institution_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.institution_id', true), '')::integer
$$;

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_upload_batches ON public.upload_batches;
CREATE POLICY runtime_upload_batches ON public.upload_batches
    FOR ALL TO apaar_app
    USING (institution_id = public.current_api_institution_id())
    WITH CHECK (institution_id = public.current_api_institution_id());

DROP POLICY IF EXISTS runtime_upload_rows ON public.upload_rows;
CREATE POLICY runtime_upload_rows ON public.upload_rows
    FOR ALL TO apaar_app
    USING (batch_id IN (
        SELECT batch_id FROM public.upload_batches
    ))
    WITH CHECK (batch_id IN (
        SELECT batch_id FROM public.upload_batches
    ));

DROP POLICY IF EXISTS runtime_enrolments ON public.enrolments;
CREATE POLICY runtime_enrolments ON public.enrolments
    FOR ALL TO apaar_app
    USING (institution_id = public.current_api_institution_id())
    WITH CHECK (institution_id = public.current_api_institution_id());

DROP POLICY IF EXISTS runtime_validation_issues ON public.validation_issues;
CREATE POLICY runtime_validation_issues ON public.validation_issues
    FOR ALL TO apaar_app
    USING (row_id IN (
        SELECT r.row_id
        FROM public.upload_rows r
    ))
    WITH CHECK (row_id IN (
        SELECT r.row_id
        FROM public.upload_rows r
    ));

DROP POLICY IF EXISTS runtime_students ON public.students;
CREATE POLICY runtime_students ON public.students
    FOR ALL TO apaar_app
    USING (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ))
    WITH CHECK (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ));

DROP POLICY IF EXISTS runtime_consents ON public.consents;
CREATE POLICY runtime_consents ON public.consents
    FOR ALL TO apaar_app
    USING (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ))
    WITH CHECK (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ));

DROP POLICY IF EXISTS runtime_verification_requests ON public.verification_requests;
CREATE POLICY runtime_verification_requests ON public.verification_requests
    FOR ALL TO apaar_app
    USING (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ))
    WITH CHECK (student_id IN (
        SELECT e.student_id FROM public.enrolments e
    ));

CREATE OR REPLACE FUNCTION public.accept_upload_row(
    p_row_id integer,
    p_actor_id integer
)
RETURNS TABLE (student_id integer, enrolment_id integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_record record;
    existing_student record;
    programme_record record;
    approval_limit integer;
    active_count integer;
BEGIN
    SELECT r.row_id, r.batch_id, r.row_status, r.normalized_apaar_id,
           r.normalized_prn, r.raw_data, b.institution_id
    INTO row_record
    FROM upload_rows r
    JOIN upload_batches b ON b.batch_id = r.batch_id
    WHERE r.row_id = p_row_id
      AND b.institution_id = current_api_institution_id()
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'upload row not found';
    END IF;
    IF row_record.row_status <> 'READY_TO_ACCEPT' THEN
        RAISE EXCEPTION 'upload row is not ready to accept';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = p_actor_id
          AND institution_id = row_record.institution_id
          AND account_status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'actor is not an active institution user';
    END IF;

    SELECT p.programme_id, p.institution_id
    INTO programme_record
    FROM programmes p
    WHERE p.institution_id = row_record.institution_id
      AND lower(p.programme_code) = lower(row_record.raw_data->>'programme_code')
      AND p.programme_status = 'ACTIVE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'programme is not active for institution';
    END IF;

    SELECT a.approved_intake
    INTO approval_limit
    FROM approval_master a
    WHERE a.programme_id = programme_record.programme_id
      AND a.academic_year = row_record.raw_data->>'academic_year';
    IF approval_limit IS NULL THEN
        RAISE EXCEPTION 'programme approval not found';
    END IF;
    SELECT count(*) INTO active_count
    FROM enrolments e
    WHERE e.institution_id = row_record.institution_id
      AND e.programme_id = programme_record.programme_id
      AND e.academic_year = row_record.raw_data->>'academic_year'
      AND e.enrolment_status = 'ACTIVE';
    IF active_count >= approval_limit THEN
        RAISE EXCEPTION 'approved intake exceeded';
    END IF;

    SELECT s.student_id, s.student_name
    INTO existing_student
    FROM students s
    WHERE s.apaar_id = row_record.normalized_apaar_id
    FOR UPDATE;
    IF FOUND AND existing_student.student_name <> row_record.raw_data->>'student_name' THEN
        RAISE EXCEPTION 'student information is inconsistent';
    END IF;
    IF NOT FOUND THEN
        INSERT INTO students (apaar_id, student_name)
        VALUES (row_record.normalized_apaar_id, row_record.raw_data->>'student_name')
        RETURNING students.student_id INTO existing_student.student_id;
    END IF;

    INSERT INTO enrolments
        (student_id, institution_id, programme_id, academic_year, prn,
         admission_date, source_row_id)
    VALUES
        (existing_student.student_id, row_record.institution_id,
         programme_record.programme_id, row_record.raw_data->>'academic_year',
         row_record.normalized_prn, CURRENT_DATE, row_record.row_id)
    RETURNING enrolments.enrolment_id INTO enrolment_id;
    student_id := existing_student.student_id;
    UPDATE upload_rows SET row_status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP
    WHERE row_id = row_record.row_id;
    UPDATE upload_batches
    SET accepted_rows = accepted_rows + 1,
        batch_status = CASE WHEN accepted_rows + 1 >= total_rows
                            THEN 'ACCEPTED' ELSE batch_status END
    WHERE batch_id = row_record.batch_id;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_upload_row(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_upload_row(integer, integer) TO apaar_app;

CREATE OR REPLACE FUNCTION public.record_issue_event(
    p_issue_id integer,
    p_actor_id integer,
    p_action character varying,
    p_previous_status character varying,
    p_new_status character varying,
    p_change_summary text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result_id integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM validation_issues v
        JOIN upload_rows r ON r.row_id = v.row_id
        JOIN upload_batches b ON b.batch_id = r.batch_id
        WHERE v.issue_id = p_issue_id
          AND b.institution_id = current_api_institution_id()
    ) THEN
        RAISE EXCEPTION 'issue is outside the current institution';
    END IF;
    INSERT INTO issue_events
        (issue_id, actor_id, action, previous_status, new_status, change_summary)
    VALUES
        (p_issue_id, p_actor_id, p_action, p_previous_status,
         p_new_status, p_change_summary)
    RETURNING event_id INTO result_id;
    RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_issue_event(integer, integer, character varying, character varying, character varying, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_issue_event(integer, integer, character varying, character varying, character varying, text) TO apaar_app;
