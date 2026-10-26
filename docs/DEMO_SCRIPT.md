# Live demo script

This script uses the synthetic data from `npm run demo:reset`. The app detects
the new backend seed version and clears its local `apaar_*` store once on
startup; no manual local-storage step is required.

## Continuous story

1. Run `npm run demo:reset`, then `npm run dev:all`, and open
   `http://localhost:5173`.
2. Select **College (PICT Pune)** and log in as
   `pict.admin@college.edu` / `demo123`.
3. Open **Batch Upload & Ingestion** → **Choose CSV** → select
   `samples/batch_faulty.csv` → **Upload**. Show the stored/flagged/rejected
   counts and row-level issues.
4. Open **Validate Records**, select the flagged records, and click
   **Validate Selected**. Show the invalid APAAR and duplicate issues.
5. Open **Issue Workbench**, select a flagged record, click **Fix Record**, use
   **Apply Valid Sample Fix**, and click **Save & Revalidate**.
6. Return to **Validate Records**, validate the corrected row, then open
   **Issue Workbench** and click **Accept Valid Records**.
7. Log out and select **AICTE Central Reviewer**:
   `aicte.central@gov.in` / `demo123`.
8. Open **National Dashboard** and then **Central Repository**. The accepted
   record should appear after the backend synchronization completes.
9. Open **Review Queue**, select the cross-institution case, and use
   **Confirm Evidence** or **Send Back to College**. Open **Student Journey**,
   enter the exact 12-digit APAAR, and show the cross-institution timeline.
10. Log out and select **External Verifier**:
    `verifier@credential-review.example` / `demo123`.
11. Open **Verify Record** using the QR/reference link for a synthetic accepted
    record, choose **Regulatory check**, tick the authorization checkbox, and
    click **Verify**. The result shows the APAAR ID and record status in demo
    mode.
12. Return to the College portal, open **Compliance Reports**, and use the
    certificate action for an accepted record. Confirm the certificate displays
    both APAAR ID and student ID.
13. Return to AICTE and open **Audit Trail**. Filter or sort to show ingestion,
    validation, correction, acceptance, review, and APAAR lookup actions.

## If something fails

- **Backend down:** run `npm run server` in a second terminal or restart
  `npm run dev:all`. The UI keeps local changes and displays an offline notice.
- **Stale local storage:** reload once with the backend running so the seed
  version reset can complete. If the browser was offline, open DevTools →
  Application → Local Storage, remove the `apaar_*` entries, and reload.
- **Missing QR/reference:** use an `ACCEPTED` record from the Central Repository
  or certificate view; accepted seeded records have `DEMO-INST-00x-00n`
  references. Do not use an `INGEST-*` ID as a verifier reference.
- **Port already in use:** stop the old Vite/API process, or change `PORT` and
  `VITE_API_BASE_URL` together in `.env`, then restart both processes.
- **Native SQLite install error:** remove `node_modules` and
  `package-lock.json`, run `npm install` again on the current operating system,
  and retry `npm run server`.

All records and outcomes in this script are synthetic. Do not present the
demo as a live government or APAAR verification service.
