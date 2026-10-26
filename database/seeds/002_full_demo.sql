-- APAAR SIH 2026 synthetic demonstration data
-- Execute against an EMPTY restored database (or rerun; identifiers are guarded).
-- Do not use actual APAAR IDs or student data.
BEGIN;

INSERT INTO public.institutions (aicte_institution_code, institution_name, campus_code, state, city)
VALUES ('DEMO-AICTE-001','Demo Engineering College A','DEMO-CAMPUS-A','Maharashtra','Pune'),
       ('DEMO-AICTE-002','Demo Engineering College B','DEMO-CAMPUS-B','Maharashtra','Mumbai')
ON CONFLICT (aicte_institution_code) DO NOTHING;

INSERT INTO public.programmes (institution_id, programme_code, programme_name, programme_level)
SELECT i.institution_id, x.code, x.name, 'UG'
FROM (VALUES ('DEMO-AICTE-001','COMP','Computer Engineering'),
             ('DEMO-AICTE-001','IT','Information Technology'),
             ('DEMO-AICTE-002','COMP','Computer Engineering')) AS x(inst, code, name)
JOIN public.institutions i ON i.aicte_institution_code=x.inst
ON CONFLICT DO NOTHING;

INSERT INTO public.approval_master (programme_id, academic_year, approved_intake)
SELECT p.programme_id, '2026-27', CASE WHEN p.programme_code='COMP' THEN 120 ELSE 60 END
FROM public.programmes p
JOIN public.institutions i ON i.institution_id=p.institution_id
WHERE i.aicte_institution_code IN ('DEMO-AICTE-001','DEMO-AICTE-002')
  AND p.programme_code IN ('COMP','IT')
ON CONFLICT DO NOTHING;

INSERT INTO public.users (institution_id, full_name, email, password_hash, role, account_status)
SELECT i.institution_id,'Demo College A Data Officer','demo.college.a@example.invalid','DISABLED_DEMO_ACCOUNT','INSTITUTION','INACTIVE'
FROM public.institutions i WHERE i.aicte_institution_code='DEMO-AICTE-001'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.users (institution_id, full_name, email, password_hash, role, account_status)
SELECT i.institution_id,'Demo College B Data Officer','demo.college.b@example.invalid','DISABLED_DEMO_ACCOUNT','INSTITUTION','INACTIVE'
FROM public.institutions i WHERE i.aicte_institution_code='DEMO-AICTE-002'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.upload_batches (institution_id, uploaded_by, file_name, total_rows, flagged_rows, batch_status)
SELECT i.institution_id, u.user_id, 'demo_a_2026.csv', 2, 1, 'ACTION_REQUIRED'
FROM public.institutions i JOIN public.users u ON u.institution_id=i.institution_id
WHERE i.aicte_institution_code='DEMO-AICTE-001' AND u.email='demo.college.a@example.invalid'
 AND NOT EXISTS (SELECT 1 FROM public.upload_batches b WHERE b.institution_id=i.institution_id AND b.file_name='demo_a_2026.csv');

INSERT INTO public.upload_batches (institution_id, uploaded_by, file_name, total_rows, batch_status)
SELECT i.institution_id, u.user_id, 'demo_b_2026.csv', 1, 'UPLOADED'
FROM public.institutions i JOIN public.users u ON u.institution_id=i.institution_id
WHERE i.aicte_institution_code='DEMO-AICTE-002' AND u.email='demo.college.b@example.invalid'
 AND NOT EXISTS (SELECT 1 FROM public.upload_batches b WHERE b.institution_id=i.institution_id AND b.file_name='demo_b_2026.csv');

INSERT INTO public.upload_rows (batch_id, row_number, raw_data, normalized_apaar_id, normalized_prn, row_status)
SELECT b.batch_id, v.row_number, v.raw_data::jsonb, v.apaar, v.prn, v.row_status
FROM public.upload_batches b
JOIN (VALUES
 ('demo_a_2026.csv',1,'{"student_name":"Demo Learner A","apaar_id":"900000000001","prn":"DEMO-A-001"}','900000000001','DEMO-A-001','READY_TO_ACCEPT'),
 ('demo_a_2026.csv',2,'{"student_name":"Demo Learner Missing","apaar_id":"","prn":"DEMO-A-002"}',NULL,'DEMO-A-002','ACTION_REQUIRED'),
 ('demo_b_2026.csv',1,'{"student_name":"Demo Learner B","apaar_id":"900000000002","prn":"DEMO-B-001"}','900000000002','DEMO-B-001','READY_TO_ACCEPT')
) AS v(filename,row_number,raw_data,apaar,prn,row_status) ON v.filename=b.file_name
WHERE NOT EXISTS (SELECT 1 FROM public.upload_rows r WHERE r.batch_id=b.batch_id AND r.row_number=v.row_number);

INSERT INTO public.students (apaar_id,student_name)
VALUES ('900000000001','Demo Learner A'),('900000000002','Demo Learner B')
ON CONFLICT (apaar_id) DO NOTHING;

INSERT INTO public.enrolments (student_id,institution_id,programme_id,academic_year,prn,admission_date,source_row_id)
SELECT s.student_id,i.institution_id,p.programme_id,'2026-27',v.prn,DATE '2026-08-15',r.row_id
FROM (VALUES ('900000000001','DEMO-AICTE-001','DEMO-A-001','demo_a_2026.csv',1),
             ('900000000002','DEMO-AICTE-002','DEMO-B-001','demo_b_2026.csv',1)) AS v(apaar,inst,prn,filename,row_number)
JOIN public.students s ON s.apaar_id=v.apaar
JOIN public.institutions i ON i.aicte_institution_code=v.inst
JOIN public.programmes p ON p.institution_id=i.institution_id AND p.programme_code='COMP'
JOIN public.upload_batches b ON b.institution_id=i.institution_id AND b.file_name=v.filename
JOIN public.upload_rows r ON r.batch_id=b.batch_id AND r.row_number=v.row_number
WHERE NOT EXISTS (SELECT 1 FROM public.enrolments e WHERE e.source_row_id=r.row_id);

INSERT INTO public.validation_issues (row_id,issue_code,reason,severity,issue_status)
SELECT r.row_id,'MISSING_APAAR','Synthetic record has no APAAR ID','HIGH','OPEN'
FROM public.upload_rows r
JOIN public.upload_batches b ON b.batch_id=r.batch_id
WHERE b.file_name='demo_a_2026.csv' AND r.row_number=2
  AND NOT EXISTS (SELECT 1 FROM public.validation_issues vi WHERE vi.row_id=r.row_id AND vi.issue_code='MISSING_APAAR');

COMMIT;

-- Check: demo batch counts (A should see 2 rows, B 1)
SELECT i.aicte_institution_code, b.file_name, count(r.row_id) AS rows_in_batch
FROM public.upload_batches b
JOIN public.institutions i ON i.institution_id=b.institution_id
LEFT JOIN public.upload_rows r ON r.batch_id=b.batch_id
WHERE b.file_name IN ('demo_a_2026.csv','demo_b_2026.csv')
GROUP BY i.aicte_institution_code,b.file_name
ORDER BY i.aicte_institution_code;
