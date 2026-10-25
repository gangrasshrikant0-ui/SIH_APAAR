
-- APAAR synthetic demo institutions
-- Safe to execute multiple times.

BEGIN;

INSERT INTO public.institutions (
    aicte_institution_code,
    institution_name,
    campus_code,
    state,
    city
)
VALUES
(
    'DEMO-AICTE-001',
    'Demo Engineering College A',
    'DEMO-CAMPUS-A',
    'Maharashtra',
    'Pune'
),
(
    'DEMO-AICTE-002',
    'Demo Engineering College B',
    'DEMO-CAMPUS-B',
    'Maharashtra',
    'Mumbai'
)
ON CONFLICT (aicte_institution_code)
DO NOTHING;

COMMIT;
