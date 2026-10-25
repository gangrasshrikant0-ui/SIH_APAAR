--
-- PostgreSQL database dump
--

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: prevent_audit_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_audit_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are append-only';
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_master (
    approval_id integer NOT NULL,
    programme_id integer NOT NULL,
    academic_year character varying(9) NOT NULL,
    approved_intake integer NOT NULL,
    supernumerary_limit integer DEFAULT 0 NOT NULL,
    nri_limit integer DEFAULT 0 NOT NULL,
    oci_limit integer DEFAULT 0 NOT NULL,
    fn_limit integer DEFAULT 0 NOT NULL,
    approval_reference character varying(100),
    CONSTRAINT valid_seat_limits CHECK (((approved_intake >= 0) AND (supernumerary_limit >= 0) AND (nri_limit >= 0) AND (oci_limit >= 0) AND (fn_limit >= 0)))
);


--
-- Name: approval_master_approval_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.approval_master ALTER COLUMN approval_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.approval_master_approval_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    audit_id bigint NOT NULL,
    actor_id integer,
    action character varying(60) NOT NULL,
    entity_type character varying(60) NOT NULL,
    entity_id bigint,
    outcome character varying(20) NOT NULL,
    change_summary text,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT nonempty_audit_action CHECK ((length(TRIM(BOTH FROM action)) > 0)),
    CONSTRAINT nonempty_audit_entity_type CHECK ((length(TRIM(BOTH FROM entity_type)) > 0)),
    CONSTRAINT valid_audit_outcome CHECK (((outcome)::text = ANY ((ARRAY['SUCCESS'::character varying, 'DENIED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: audit_logs_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN audit_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consents (
    consent_id integer NOT NULL,
    student_id integer NOT NULL,
    purpose character varying(100) NOT NULL,
    consent_status character varying(20) DEFAULT 'GRANTED'::character varying NOT NULL,
    granted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    evidence_reference character varying(255),
    CONSTRAINT valid_consent_dates CHECK ((((expires_at IS NULL) OR (expires_at > granted_at)) AND ((revoked_at IS NULL) OR (revoked_at >= granted_at)))),
    CONSTRAINT valid_consent_status CHECK (((consent_status)::text = ANY ((ARRAY['GRANTED'::character varying, 'REVOKED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: consents_consent_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.consents ALTER COLUMN consent_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.consents_consent_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: enrolments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrolments (
    enrolment_id integer NOT NULL,
    student_id integer NOT NULL,
    institution_id integer NOT NULL,
    programme_id integer NOT NULL,
    academic_year character varying(9) NOT NULL,
    admission_date date NOT NULL,
    admission_category character varying(30) DEFAULT 'REGULAR'::character varying NOT NULL,
    nri_flag boolean DEFAULT false NOT NULL,
    oci_flag boolean DEFAULT false NOT NULL,
    fn_flag boolean DEFAULT false NOT NULL,
    enrolment_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    source_row_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_admission_category CHECK (((admission_category)::text = ANY ((ARRAY['REGULAR'::character varying, 'SUPERNUMERARY'::character varying, 'NRI'::character varying, 'OCI'::character varying, 'FN'::character varying])::text[]))),
    CONSTRAINT valid_enrolment_status CHECK (((enrolment_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'COMPLETED'::character varying, 'WITHDRAWN'::character varying, 'TRANSFERRED'::character varying])::text[])))
);


--
-- Name: enrolments_enrolment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.enrolments ALTER COLUMN enrolment_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.enrolments_enrolment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: institutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutions (
    institution_id integer NOT NULL,
    aicte_institution_code character varying(30) NOT NULL,
    institution_name character varying(200) NOT NULL,
    campus_code character varying(30) NOT NULL,
    state character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    institution_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT valid_institution_status CHECK (((institution_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: institutions_institution_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.institutions ALTER COLUMN institution_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.institutions_institution_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: issue_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issue_events (
    event_id integer NOT NULL,
    issue_id integer NOT NULL,
    actor_id integer,
    action character varying(40) NOT NULL,
    previous_status character varying(30),
    new_status character varying(30),
    change_summary text NOT NULL,
    event_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_event_action CHECK (((action)::text = ANY ((ARRAY['DETECTED'::character varying, 'ASSIGNED'::character varying, 'CORRECTION_SUBMITTED'::character varying, 'REVALIDATED'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying, 'ESCALATED'::character varying, 'COMMENT_ADDED'::character varying])::text[]))),
    CONSTRAINT valid_event_new_status CHECK (((new_status IS NULL) OR ((new_status)::text = ANY ((ARRAY['OPEN'::character varying, 'ASSIGNED'::character varying, 'IN_CORRECTION'::character varying, 'PENDING_REVIEW'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying])::text[])))),
    CONSTRAINT valid_event_status_pair CHECK (((previous_status IS NULL) OR ((previous_status)::text = ANY ((ARRAY['OPEN'::character varying, 'ASSIGNED'::character varying, 'IN_CORRECTION'::character varying, 'PENDING_REVIEW'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying])::text[])))),
    CONSTRAINT valid_event_summary CHECK ((length(TRIM(BOTH FROM change_summary)) > 0))
);


--
-- Name: issue_events_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.issue_events ALTER COLUMN event_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.issue_events_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programmes (
    programme_id integer NOT NULL,
    institution_id integer NOT NULL,
    programme_code character varying(30) NOT NULL,
    programme_name character varying(150) NOT NULL,
    programme_level character varying(30) NOT NULL,
    programme_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT valid_programme_status CHECK (((programme_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: programmes_programme_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.programmes ALTER COLUMN programme_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.programmes_programme_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    student_id integer NOT NULL,
    apaar_id character varying(12) NOT NULL,
    student_name character varying(150) NOT NULL,
    identity_verification_status character varying(20) DEFAULT 'UNVERIFIED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_identity_status CHECK (((identity_verification_status)::text = ANY ((ARRAY['UNVERIFIED'::character varying, 'PENDING'::character varying, 'VERIFIED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT valid_student_apaar CHECK (((apaar_id)::text ~ '^[0-9]{12}$'::text))
);


--
-- Name: students_student_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.students ALTER COLUMN student_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.students_student_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: upload_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_batches (
    batch_id integer NOT NULL,
    institution_id integer,
    uploaded_by integer,
    file_name character varying(255) NOT NULL,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    batch_status character varying(30) DEFAULT 'UPLOADED'::character varying NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    accepted_rows integer DEFAULT 0 NOT NULL,
    flagged_rows integer DEFAULT 0 NOT NULL,
    CONSTRAINT valid_batch_counts CHECK (((total_rows >= 0) AND (accepted_rows >= 0) AND (flagged_rows >= 0) AND (accepted_rows <= total_rows) AND (flagged_rows <= total_rows))),
    CONSTRAINT valid_batch_status CHECK (((batch_status)::text = ANY ((ARRAY['UPLOADED'::character varying, 'VALIDATING'::character varying, 'ACTION_REQUIRED'::character varying, 'PENDING_REVIEW'::character varying, 'READY_TO_ACCEPT'::character varying, 'ACCEPTED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: upload_batches_batch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.upload_batches ALTER COLUMN batch_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.upload_batches_batch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: upload_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_rows (
    row_id integer NOT NULL,
    batch_id integer NOT NULL,
    row_number integer NOT NULL,
    raw_data jsonb NOT NULL,
    normalized_apaar_id character varying(50),
    row_status character varying(30) DEFAULT 'UPLOADED'::character varying NOT NULL,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_raw_data CHECK ((jsonb_typeof(raw_data) = 'object'::text)),
    CONSTRAINT valid_row_number CHECK ((row_number > 0)),
    CONSTRAINT valid_row_status CHECK (((row_status)::text = ANY ((ARRAY['UPLOADED'::character varying, 'VALIDATING'::character varying, 'ACTION_REQUIRED'::character varying, 'PENDING_REVIEW'::character varying, 'READY_TO_ACCEPT'::character varying, 'ACCEPTED'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: upload_rows_row_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.upload_rows ALTER COLUMN row_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.upload_rows_row_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    institution_id integer,
    full_name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20) NOT NULL,
    account_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_account_status CHECK (((account_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))),
    CONSTRAINT valid_role_institution CHECK (((((role)::text = 'INSTITUTION'::text) AND (institution_id IS NOT NULL)) OR (((role)::text = ANY ((ARRAY['AICTE'::character varying, 'VERIFIER'::character varying])::text[])) AND (institution_id IS NULL)))),
    CONSTRAINT valid_user_role CHECK (((role)::text = ANY ((ARRAY['INSTITUTION'::character varying, 'AICTE'::character varying, 'VERIFIER'::character varying])::text[])))
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: validation_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_issues (
    issue_id integer NOT NULL,
    row_id integer NOT NULL,
    issue_code character varying(50) NOT NULL,
    reason text NOT NULL,
    issue_details jsonb DEFAULT '[]'::jsonb NOT NULL,
    severity character varying(20) DEFAULT 'MEDIUM'::character varying NOT NULL,
    issue_status character varying(30) DEFAULT 'OPEN'::character varying NOT NULL,
    assigned_to integer,
    due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT nonempty_issue_reason CHECK ((length(TRIM(BOTH FROM reason)) > 0)),
    CONSTRAINT valid_issue_severity CHECK (((severity)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT valid_issue_status CHECK (((issue_status)::text = ANY ((ARRAY['OPEN'::character varying, 'ASSIGNED'::character varying, 'IN_CORRECTION'::character varying, 'PENDING_REVIEW'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: validation_issues_issue_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.validation_issues ALTER COLUMN issue_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.validation_issues_issue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: verification_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_requests (
    request_id integer NOT NULL,
    student_id integer NOT NULL,
    requested_by integer NOT NULL,
    consent_id integer NOT NULL,
    request_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    verification_result character varying(30),
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    token_hash character varying(255),
    CONSTRAINT valid_request_status CHECK (((request_status)::text = ANY ((ARRAY['PENDING'::character varying, 'COMPLETED'::character varying, 'DENIED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT valid_verification_result CHECK (((verification_result IS NULL) OR ((verification_result)::text = ANY ((ARRAY['MATCH'::character varying, 'NO_MATCH'::character varying, 'NOT_VERIFIED'::character varying])::text[]))))
);


--
-- Name: verification_requests_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.verification_requests ALTER COLUMN request_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.verification_requests_request_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: approval_master approval_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_master
    ADD CONSTRAINT approval_master_pkey PRIMARY KEY (approval_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: consents consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT consents_pkey PRIMARY KEY (consent_id);


--
-- Name: enrolments enrolments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_pkey PRIMARY KEY (enrolment_id);


--
-- Name: enrolments enrolments_source_row_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_source_row_id_key UNIQUE (source_row_id);


--
-- Name: institutions institutions_aicte_institution_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_aicte_institution_code_key UNIQUE (aicte_institution_code);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (institution_id);


--
-- Name: issue_events issue_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_events
    ADD CONSTRAINT issue_events_pkey PRIMARY KEY (event_id);


--
-- Name: programmes programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT programmes_pkey PRIMARY KEY (programme_id);


--
-- Name: students students_apaar_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_apaar_id_key UNIQUE (apaar_id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (student_id);


--
-- Name: upload_rows unique_batch_row; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_rows
    ADD CONSTRAINT unique_batch_row UNIQUE (batch_id, row_number);


--
-- Name: consents unique_consent_student_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT unique_consent_student_pair UNIQUE (consent_id, student_id);


--
--
-- Name: programmes unique_institution_programme; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT unique_institution_programme UNIQUE (institution_id, programme_code);


--
-- Name: programmes unique_programme_institution_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT unique_programme_institution_pair UNIQUE (programme_id, institution_id);


--
-- Name: approval_master unique_programme_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_master
    ADD CONSTRAINT unique_programme_year UNIQUE (programme_id, academic_year);


--
-- Name: consents unique_student_consent_purpose; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT unique_student_consent_purpose UNIQUE (student_id, purpose);


--
-- Name: enrolments unique_student_programme_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT unique_student_programme_year UNIQUE (student_id, programme_id, academic_year);


--
-- Name: upload_batches upload_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT upload_batches_pkey PRIMARY KEY (batch_id);


--
-- Name: upload_rows upload_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_rows
    ADD CONSTRAINT upload_rows_pkey PRIMARY KEY (row_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: validation_issues validation_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_issues
    ADD CONSTRAINT validation_issues_pkey PRIMARY KEY (issue_id);


--
-- Name: verification_requests verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT verification_requests_pkey PRIMARY KEY (request_id);


--
-- Name: idx_audit_actor_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor_time ON public.audit_logs USING btree (actor_id, occurred_at DESC);


--
-- Name: idx_issue_events_history; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_issue_events_history ON public.issue_events USING btree (issue_id, event_time, event_id);


--
-- Name: audit_logs audit_logs_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_logs_immutable BEFORE DELETE OR UPDATE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_changes();


--
-- Name: approval_master fk_approval_programme; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_master
    ADD CONSTRAINT fk_approval_programme FOREIGN KEY (programme_id) REFERENCES public.programmes(programme_id);


--
-- Name: audit_logs fk_audit_actor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES public.users(user_id);


--
-- Name: upload_batches fk_batch_institution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT fk_batch_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(institution_id);


--
-- Name: upload_batches fk_batch_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT fk_batch_user FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id);


--
-- Name: consents fk_consent_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consents
    ADD CONSTRAINT fk_consent_student FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: enrolments fk_enrolment_institution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT fk_enrolment_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(institution_id);


--
-- Name: enrolments fk_enrolment_programme; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT fk_enrolment_programme FOREIGN KEY (programme_id) REFERENCES public.programmes(programme_id);


--
-- Name: enrolments fk_enrolment_programme_institution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT fk_enrolment_programme_institution FOREIGN KEY (programme_id, institution_id) REFERENCES public.programmes(programme_id, institution_id);


--
-- Name: enrolments fk_enrolment_source; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT fk_enrolment_source FOREIGN KEY (source_row_id) REFERENCES public.upload_rows(row_id);


--
-- Name: enrolments fk_enrolment_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT fk_enrolment_student FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: issue_events fk_event_actor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_events
    ADD CONSTRAINT fk_event_actor FOREIGN KEY (actor_id) REFERENCES public.users(user_id);


--
-- Name: issue_events fk_event_issue; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issue_events
    ADD CONSTRAINT fk_event_issue FOREIGN KEY (issue_id) REFERENCES public.validation_issues(issue_id);


--
-- Name: validation_issues fk_issue_assignee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_issues
    ADD CONSTRAINT fk_issue_assignee FOREIGN KEY (assigned_to) REFERENCES public.users(user_id);


--
-- Name: validation_issues fk_issue_row; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_issues
    ADD CONSTRAINT fk_issue_row FOREIGN KEY (row_id) REFERENCES public.upload_rows(row_id);


--
-- Name: programmes fk_programme_institution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT fk_programme_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(institution_id);


--
-- Name: upload_rows fk_row_batch; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_rows
    ADD CONSTRAINT fk_row_batch FOREIGN KEY (batch_id) REFERENCES public.upload_batches(batch_id);


--
-- Name: users fk_user_institution; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_user_institution FOREIGN KEY (institution_id) REFERENCES public.institutions(institution_id);


--
-- Name: verification_requests fk_verification_consent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT fk_verification_consent FOREIGN KEY (consent_id) REFERENCES public.consents(consent_id);


--
-- Name: verification_requests fk_verification_consent_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT fk_verification_consent_student FOREIGN KEY (consent_id, student_id) REFERENCES public.consents(consent_id, student_id);


--
-- Name: verification_requests fk_verification_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT fk_verification_student FOREIGN KEY (student_id) REFERENCES public.students(student_id);


--
-- Name: verification_requests fk_verification_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT fk_verification_user FOREIGN KEY (requested_by) REFERENCES public.users(user_id);


--
-- PostgreSQL database dump complete
--
