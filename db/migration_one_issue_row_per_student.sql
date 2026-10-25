-- Consolidate existing validation issues so each upload row has one issue row.
-- The individual issues remain in validation_issues.issue_details.

ALTER TABLE public.validation_issues
  ADD COLUMN IF NOT EXISTS issue_details jsonb NOT NULL DEFAULT '[]'::jsonb;

WITH ranked AS (
  SELECT issue_id, row_id,
         MIN(issue_id) OVER (PARTITION BY row_id) AS keeper_id
  FROM public.validation_issues
),
aggregated AS (
  SELECT
    row_id,
    MIN(issue_id) AS keeper_id,
    jsonb_agg(
      jsonb_build_object(
        'code', issue_code,
        'message', reason,
        'severity', severity,
        'issueStatus', issue_status
      ) ORDER BY issue_id
    ) AS details,
    string_agg(reason, ' ' ORDER BY issue_id) AS combined_reason,
    CASE MAX(CASE severity
      WHEN 'CRITICAL' THEN 4
      WHEN 'HIGH' THEN 3
      WHEN 'MEDIUM' THEN 2
      ELSE 1
    END)
      WHEN 4 THEN 'CRITICAL'
      WHEN 3 THEN 'HIGH'
      WHEN 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS highest_severity,
    bool_or(issue_status = 'PENDING_REVIEW') AS needs_review,
    COUNT(*) AS issue_count
  FROM public.validation_issues
  GROUP BY row_id
)
UPDATE public.validation_issues issue
SET issue_code = CASE WHEN aggregate.issue_count = 1
                      THEN issue.issue_code ELSE 'MULTIPLE_ISSUES' END,
    reason = aggregate.combined_reason,
    issue_details = aggregate.details,
    severity = aggregate.highest_severity,
    issue_status = CASE WHEN aggregate.needs_review
                        THEN 'PENDING_REVIEW' ELSE issue.issue_status END
FROM aggregated aggregate
WHERE issue.issue_id = aggregate.keeper_id;

WITH ranked AS (
  SELECT issue_id,
         MIN(issue_id) OVER (PARTITION BY row_id) AS keeper_id
  FROM public.validation_issues
)
UPDATE public.issue_events event
SET issue_id = ranked.keeper_id
FROM ranked
WHERE event.issue_id = ranked.issue_id
  AND ranked.issue_id <> ranked.keeper_id;

WITH ranked AS (
  SELECT issue_id,
         ROW_NUMBER() OVER (PARTITION BY row_id ORDER BY issue_id) AS issue_number
  FROM public.validation_issues
)
DELETE FROM public.validation_issues issue
USING ranked
WHERE issue.issue_id = ranked.issue_id
  AND ranked.issue_number > 1;
