# APAAR validation synthetic test guide

All records in this directory are synthetic and must not be interpreted as real
APAAR or student data. The Approval Master fixture is intentionally limited:

| Institution | Programme | Academic year | Seat category | Approved intake |
|---|---|---:|---|---:|
| INST-A | PROG-CSE | 2026 | REGULAR | 2 |
| INST-B | PROG-AI | 2026 | REGULAR | 1 |

`apaar_validation_test.csv` contains 23 records. `SYN-006` has outer whitespace
and shares an ID with the batch duplicate cases; outer whitespace is trimmed,
but malformed internal whitespace and hyphens are not repaired. `SYN-010` is
preconfigured in the synthetic repository. `SYN-011` uses a repository ID under
another institution. `SYN-022` demonstrates a repeated upload and batch
duplicate. `SYN-023` demonstrates a deterministic timeout response. Demo
verification remains pending and never becomes official verification.

Use the expected-results CSV as a human-authored acceptance reference. A
single row may also receive missing-field or mapping issues when deliberately
configured that way.
