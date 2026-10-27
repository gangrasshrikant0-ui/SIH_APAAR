import test from "node:test";
import assert from "node:assert/strict";

// Import APIs & Mocks
import { APPROVAL_MASTER } from "../src/mocks/approvalMasterMock.js";
import { FAULTY_MOCK_BATCH } from "../src/mocks/mockBatches.js";
import { initializeStore, resetDemoState, setCurrentUser, setActiveBatchId, getStoredBatches, saveBatch, DEMO_ACCOUNTS } from "../src/mocks/mockStore.js";
import { collegeApi } from "../src/api/collegeApi.js";
import { aicteApi } from "../src/api/aicteApi.js";
import { authApi } from "../src/api/authApi.js";
import { verificationApi } from "../src/api/verificationApi.js";
import { checkApaar } from "../src/api/apaarApi.js";
import { repairStoredAcceptedRecords } from "../src/api/collegeApi.js";
import { storedRecordsOnly } from "../src/api/ingestionApi.js";
import { getAuditLogs } from "../src/mocks/mockAuditLog.js";
import {
  COLLEGE_DEFAULT_PATH,
  COLLEGE_PORTAL_TABS,
  COLLEGE_ROUTE_REDIRECTS,
  COLLEGE_LEGACY_PATHS_UNCHANGED
} from "../src/pages/college/collegeNav.js";
import {
  MAX_STUDENT_ROWS,
  addStudentRow,
  removeStudentRow,
  clearStudentRows,
  createEmptyStudent,
  rowsReadyToStage
} from "../src/pages/college/studentEntry.js";

test.beforeEach(() => {
  resetDemoState();
  setCurrentUser(DEMO_ACCOUNTS.COLLEGE);
});

test("Acceptance Test 1: Resubmitting a corrected row revalidates, updates status and refreshes dashboard numbers", async () => {
  const batch = await collegeApi.getActiveBatch();
  const faultyRecord = batch.records.find((r) => r.id === "REC-001");
  assert.equal(faultyRecord.status, "ACTION_REQUIRED");
  assert.equal(faultyRecord.issueType, "MISSING_APAAR_ID");

  const initialStats = await collegeApi.getDashboardStats();
  const initialOpen = initialStats.openAnomalies;
  const initialReady = initialStats.readyToAccept;

  // Resubmit with a valid 12-digit numeric APAAR ID
  const fixResult = await collegeApi.fixAndRevalidateRecord(batch.batchId, "REC-001", {
    apaarId: "987654321098"
  });

  assert.equal(fixResult.validationPassed, true, "Validation should pass for valid 12-digit APAAR");
  assert.equal(fixResult.record.status, "READY_TO_ACCEPT", "Status must update to READY_TO_ACCEPT");
  assert.equal(fixResult.record.issueStatus, "RESOLVED", "Issue status must be marked RESOLVED");

  // Dashboard metrics refresh without reload
  const updatedStats = await collegeApi.getDashboardStats();
  assert.equal(updatedStats.openAnomalies, initialOpen - 1, "Open anomalies must decrement by 1");
  assert.equal(updatedStats.readyToAccept, initialReady + 1, "Ready to accept must increment by 1");
});

test("Acceptance Test 2: A mixed valid/invalid batch: invalid rows are not counted as accepted", async () => {
  const batch = await collegeApi.getActiveBatch();
  const initialReadyCount = batch.records.filter((r) => r.status === "READY_TO_ACCEPT").length;
  const initialInvalidCount = batch.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;

  assert.ok(initialInvalidCount > 0, "Batch must contain invalid rows");

  // Accept valid records
  const acceptResult = await collegeApi.acceptBatchRecords(batch.batchId);
  assert.equal(acceptResult.newlyAcceptedCount, initialReadyCount, "Only valid records should be accepted");

  const updatedBatch = await collegeApi.getActiveBatch();
  const acceptedRecords = updatedBatch.records.filter((r) => r.status === "ACCEPTED");
  assert.equal(acceptedRecords.length, initialReadyCount);

  // Check that every invalid row remains unaccepted
  const invalidRows = updatedBatch.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW");
  assert.equal(invalidRows.length, initialInvalidCount, "Invalid rows must NEVER be marked ACCEPTED");

  // Dashboard reflects only accepted rows
  const stats = await collegeApi.getDashboardStats();
  assert.equal(stats.acceptedEnrolment, initialReadyCount, "Dashboard accepted count must only include valid accepted rows");

  const certificateRecords = await collegeApi.getAcceptedRecords();
  assert.equal(certificateRecords.length, initialReadyCount, "Certificate source must include accepted records only");
  assert.ok(certificateRecords.every((record) => record.studentId && record.apaarId), "Accepted certificate records must include both identifiers");
});

test("Acceptance Test 3: Overdue issue escalates to the AICTE reviewer", async () => {
  const batchBefore = await collegeApi.getActiveBatch();
  const unescalatedBefore = batchBefore.records.filter((r) => r.status === "ACTION_REQUIRED" && !r.isEscalated);
  assert.ok(unescalatedBefore.length > 0, "Must have unescalated open records");

  // Trigger Simulate 8 days passing (exceeding 7-day deadline)
  const simResult = await collegeApi.triggerSimulateDaysPassing(8);
  assert.ok(simResult.escalatedCount > 0, "Overdue issues must be escalated");

  const batchAfter = await collegeApi.getActiveBatch();
  const escalatedRecords = batchAfter.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW");

  for (const record of escalatedRecords) {
    assert.equal(record.isOverdue, true, "Record must be marked overdue");
    assert.equal(record.isEscalated, true, "Record must be marked escalated");
    assert.equal(record.owner, "AICTE Central Reviewer", "Owner must be reassigned to AICTE Reviewer");
    assert.equal(record.issueStatus, "ESCALATED", "Issue status must be ESCALATED");
  }

  // Verify Audit Log records AUTO_ESCALATION
  const auditLogs = getAuditLogs();
  const autoEscalationLog = auditLogs.find((l) => l.actionType === "AUTO_ESCALATION");
  assert.ok(autoEscalationLog, "Audit log must contain AUTO_ESCALATION event");
  assert.equal(autoEscalationLog.severity, "CRITICAL");
});

test("Acceptance Test 4: 125 enrolled vs 120 approved intake is flagged as potential excess", async () => {
  const batch = await collegeApi.getActiveBatch();
  const excessRecord = batch.records.find((r) => r.issueType === "INTAKE_EXCEEDED");
  
  assert.ok(excessRecord, "Intake exceeded record REC-006 must exist in batch");
  assert.equal(excessRecord.status, "PENDING_REVIEW", "Excess intake warning must be PENDING_REVIEW");
  assert.equal(excessRecord.owner, "AICTE Central Reviewer", "Owner must be AICTE Reviewer");
  assert.ok(excessRecord.reason.includes("Potential excess intake flagged for review"), "Reason must clearly state potential excess flagged for review");
  assert.ok(excessRecord.evidence.includes("120"), "Evidence must show approved capacity of 120");
  assert.ok(excessRecord.evidence.includes("125"), "Evidence must show enrolled 125");
});

test("Acceptance Test 5: College A requesting College B's data or report is denied and logged", async () => {
  // Set current logged in user as College PICT (INST-001)
  setCurrentUser(DEMO_ACCOUNTS.COLLEGE);

  // Attempt to export COEP Tech (INST-002) data
  let accessDeniedTriggered = false;
  try {
    await collegeApi.exportIntakeCSV("INST-002");
  } catch (err) {
    accessDeniedTriggered = true;
    assert.ok(err.message.includes("Access Denied"), "Error message must state Access Denied");
  }

  assert.equal(accessDeniedTriggered, true, "College must be blocked from requesting another college's report");

  // Check that audit log recorded the violation
  const auditLogs = getAuditLogs();
  const securityLog = auditLogs.find((l) => l.actionType === "UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT");
  assert.ok(securityLog, "Security violation must be recorded in Audit Log");
  assert.equal(securityLog.severity, "CRITICAL");
  assert.equal(securityLog.resourceId, "INST-002");
});

test("Acceptance Test 6: Intake check compares per institution, programme, year and seat category", async () => {
  const pict = APPROVAL_MASTER.institutions.find((i) => i.id === "INST-001");
  const coep = APPROVAL_MASTER.institutions.find((i) => i.id === "INST-002");

  // Verify per-institution separation
  assert.equal(pict.aicteId, "AICTE-1-1029384");
  assert.equal(coep.aicteId, "AICTE-1-1099231");

  // Verify programme-level comparison (not whole college)
  const pictComp = pict.programmes.find((p) => p.code === "COMP");
  assert.equal(pictComp.approvedIntake, 120, "PICT Computer Engineering intake is 120");
  assert.equal(pictComp.categoryLimits.NRI_FN, 5, "PICT Computer Eng NRI/FN limit is 5");

  // Check seat category quota check in batch
  const batch = await collegeApi.getActiveBatch();
  const nriRecord = batch.records.find((r) => r.issueType === "SEAT_CATEGORY_LIMIT");
  assert.ok(nriRecord, "SEAT_CATEGORY_LIMIT record must exist");
  assert.equal(nriRecord.category, "NRI_FN");
  assert.ok(nriRecord.reason.includes("NRI/FN quota exceeded"), "Must flag category-specific limit");
});

test("College tab order and default route: Intake Dashboard is first", () => {
  assert.equal(COLLEGE_DEFAULT_PATH, "/college/dashboard");
  assert.deepEqual(
    COLLEGE_PORTAL_TABS.map((t) => `${t.n}. ${t.label}`),
    [
      "1. Intake Dashboard",
      "2. Batch Upload & Ingestion",
      "3. Validate Records",
      "4. Issue Workbench",
      "5. Compliance Reports",
      "6. Student Journey"
    ]
  );
  assert.equal(COLLEGE_PORTAL_TABS[0].to, "/college/dashboard");
  assert.equal(COLLEGE_PORTAL_TABS[1].to, "/college/upload");
});

test("Old college routes still resolve or redirect to the new location", () => {
  assert.equal(COLLEGE_ROUTE_REDIRECTS[0].from, "/college");
  assert.equal(COLLEGE_ROUTE_REDIRECTS[0].to, "/college/dashboard");
  for (const path of COLLEGE_LEGACY_PATHS_UNCHANGED) {
    assert.ok(COLLEGE_PORTAL_TABS.some((t) => t.to === path), `${path} remains a college tab`);
  }
});

test("Add Students table: add row, remove row, clear all, max 10", () => {
  let rows = [createEmptyStudent()];
  rows = addStudentRow(rows);
  assert.equal(rows.length, 2);
  rows = removeStudentRow(rows, 1);
  assert.equal(rows.length, 1);
  rows = removeStudentRow(rows, 0);
  assert.equal(rows.length, 1, "Cannot remove the last row");
  for (let i = 0; i < 20; i++) rows = addStudentRow(rows);
  assert.equal(rows.length, MAX_STUDENT_ROWS);
  rows = clearStudentRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].studentId, "");
  const mixed = [
    { ...createEmptyStudent(), studentId: "A", studentName: "Ann", apaarId: "111122223333" },
    createEmptyStudent()
  ];
  assert.equal(rowsReadyToStage(mixed).length, 1);
});

test("Frontend mirrors only stored ingestion outcomes, not rejected rows", () => {
  const mirrored = storedRecordsOnly({
    records: [
      { id: "INGEST-1", status: "UPLOADED" },
      { id: "INGEST-2", status: "ACTION_REQUIRED" },
      { id: "INGEST-3", status: "PENDING_REVIEW" },
      { id: "REJECTED-4", status: "REJECTED" }
    ]
  });
  assert.deepEqual(mirrored.map((record) => record.id), ["INGEST-1", "INGEST-2", "INGEST-3"]);
});

test("Server issue remains the single issue after client validation", async () => {
  await collegeApi.addStudentsToStaging([{
    id: "INGEST-DEDUPE-1",
    studentId: "FE-COMP-DEDUPE",
    studentName: "Server Flagged",
    apaarId: "123",
    programme: "Computer Engineering",
    yearOfStudy: "FE",
    category: "GENERAL",
    status: "ACTION_REQUIRED",
    issues: [{
      issueType: "WRONG_FORMAT",
      severity: "HIGH",
      reason: "Server format issue",
      evidence: "Server evidence",
      responsibleParty: "Institution Data Officer",
      requiredAction: "Correct APAAR ID.",
      dueDate: "2026-11-01"
    }]
  }], "BULK_UPLOAD");
  const result = await collegeApi.validateStagedRecords(["INGEST-DEDUPE-1"]);
  const record = result.records.find((item) => item.id === "INGEST-DEDUPE-1");
  assert.equal(record.issueType, "WRONG_FORMAT");
  assert.equal(record.status, "ACTION_REQUIRED");
});

test("Staging save validates MANUAL_ENTRY records and writes the STUDENT_RECORDS_ADDED audit", async () => {
  const beforeStats = await collegeApi.getDashboardStats();
  const res = await collegeApi.addStudentsToStaging(
    [{
      studentId: "FE-COMP-901",
      studentName: "Meera Joshi",
      apaarId: "611122223333",
      programme: "Computer Engineering",
      yearOfStudy: "FE",
      category: "GENERAL",
      gender: "Female",
      admissionDate: "2026-08-01"
    }],
    "MANUAL_ENTRY"
  );
  assert.equal(res.success, true);
  assert.equal(res.addedCount, 1);

  const staged = await collegeApi.getStagedRecords({ source: "MANUAL_ENTRY", search: "FE-COMP-901" });
  assert.equal(staged.records.length, 1);
  assert.equal(staged.records[0].status, "ACTION_REQUIRED");
  assert.equal(staged.records[0].source, "MANUAL_ENTRY");
  assert.ok(
    staged.records[0].issueLedger.some((issue) => issue.issueType === "MISSING_MANDATORY_FIELD"),
    "Missing required DOB must be flagged during staging"
  );

  const afterStats = await collegeApi.getDashboardStats();
  assert.equal(afterStats.acceptedEnrolment, beforeStats.acceptedEnrolment, "Staged rows must not change accepted enrolment");

  const audit = getAuditLogs().find((l) => l.actionType === "STUDENT_RECORDS_ADDED");
  assert.ok(audit, "STUDENT_RECORDS_ADDED must be written");
  assert.ok(audit.details.includes("MANUAL_ENTRY"));
});

test("Validate selected reuses engine: pass, 11-digit APAAR, duplicate in batch, foreign programme", async () => {
  const valid = await collegeApi.addStudentsToStaging([{
    studentId: "FE-IT-101",
    studentName: "Valid Student",
    apaarId: "622233334444",
    programme: "Information Technology",
    yearOfStudy: "FE",
    category: "GENERAL"
  }], "MANUAL_ENTRY");

  const badApaar = await collegeApi.addStudentsToStaging([{
    studentId: "FE-IT-102",
    studentName: "Short APAAR",
    apaarId: "12345678901",
    programme: "Information Technology",
    yearOfStudy: "FE",
    category: "GENERAL"
  }], "MANUAL_ENTRY");

  const dups = await collegeApi.addStudentsToStaging([
    { studentId: "FE-IT-103", studentName: "Dup One", apaarId: "633344445555", programme: "Information Technology", yearOfStudy: "FE", category: "GENERAL" },
    { studentId: "FE-IT-104", studentName: "Dup Two", apaarId: "633344445555", programme: "Information Technology", yearOfStudy: "FE", category: "GENERAL" }
  ], "MANUAL_ENTRY");

  const aero = await collegeApi.addStudentsToStaging([{
    studentId: "FE-AERO-001",
    studentName: "Aero Student",
    apaarId: "644455556666",
    programme: "Aeronautical Engineering",
    yearOfStudy: "FE",
    category: "GENERAL"
  }], "MANUAL_ENTRY");

  const staged = await collegeApi.getStagedRecords({ source: "MANUAL_ENTRY" });
  const byPrn = (prn) => staged.records.find((r) => r.studentId === prn);

  const passResult = await collegeApi.validateStagedRecords([byPrn("FE-IT-101").id]);
  assert.equal(passResult.passed, 1);
  assert.equal(passResult.records[0].status, "READY_TO_ACCEPT");

  const formatResult = await collegeApi.validateStagedRecords([byPrn("FE-IT-102").id]);
  assert.equal(formatResult.blocking, 1);
  assert.equal(formatResult.records[0].status, "ACTION_REQUIRED");
  assert.equal(formatResult.records[0].issueType, "WRONG_FORMAT");

  const dupResult = await collegeApi.validateStagedRecords([byPrn("FE-IT-103").id, byPrn("FE-IT-104").id]);
  assert.equal(dupResult.flagged, 2);
  assert.ok(dupResult.records.every((r) => r.issueType === "DUPLICATE_IN_BATCH"));

  const aeroResult = await collegeApi.validateStagedRecords([byPrn("FE-AERO-001").id]);
  assert.equal(aeroResult.records[0].issueType, "COURSE_MAPPING_ERROR");
  assert.equal(aeroResult.records[0].status, "ACTION_REQUIRED");

  const audit = getAuditLogs().find((l) => l.actionType === "RECORDS_VALIDATED");
  assert.ok(audit, "RECORDS_VALIDATED must be written");

  assert.ok(valid.addedCount && badApaar.addedCount && dups.addedCount && aero.addedCount);
});

test("APAAR repository checks flag same-institution and cross-institution conflicts", async () => {
  const cleanBatch = await collegeApi.loadPresetBatch("CLEAN");
  const duplicate = await collegeApi.addStudentsToStaging([{
    studentId: "FE-COMP-902",
    studentName: "Repository Duplicate",
    apaarId: "111122223333",
    programme: "Computer Engineering",
    yearOfStudy: "FE",
    category: "GENERAL"
  }], "MANUAL_ENTRY");
  const staged = await collegeApi.getStagedRecords({ source: "MANUAL_ENTRY", search: "FE-COMP-902" });
  const duplicateResult = await collegeApi.validateStagedRecords([staged.records[0].id]);
  assert.equal(duplicateResult.records[0].issueType, "DUPLICATE_IN_REPOSITORY");
  assert.equal(duplicateResult.records[0].status, "ACTION_REQUIRED");

  setCurrentUser(DEMO_ACCOUNTS.AICTE);
  setActiveBatchId("BATCH-2026-COEP-0101");
  const crossInstitutionResult = await collegeApi.validateStagedRecords(["COEP-REC-001"]);
  assert.equal(crossInstitutionResult.records[0].issueType, "CROSS_INSTITUTION_CONFLICT");
  assert.equal(crossInstitutionResult.records[0].status, "PENDING_REVIEW");
  assert.equal(cleanBatch.batchId, "BATCH-2026-ENG-CLEAN-01");
  assert.ok(duplicate.addedCount);
});

test("College cannot add records for another institution", async () => {
  let denied = false;
  try {
    await collegeApi.addStudentsToStaging([{
      studentId: "X-001",
      studentName: "Other College Student",
      apaarId: "655566667777",
      programme: "Computer Engineering",
      institutionId: "INST-002"
    }], "MANUAL_ENTRY");
  } catch (err) {
    denied = true;
    assert.ok(err.message.includes("Access Denied"));
  }
  assert.equal(denied, true);
  const audit = getAuditLogs().find((l) => l.actionType === "UNAUTHORIZED_ACCESS_ATTEMPT" && l.resourceType === "STAGING_AREA");
  assert.ok(audit);
});

test("External verifier role logs in and exact-reference verification exposes only permitted valid fields", async () => {
  const login = await authApi.login({
    role: "EXTERNAL_VERIFIER",
    identifier: DEMO_ACCOUNTS.EXTERNAL_VERIFIER.email,
    password: DEMO_ACCOUNTS.EXTERNAL_VERIFIER.passwordHint
  });
  assert.equal(login.user.role, "EXTERNAL_VERIFIER");

  const acceptedRecords = getStoredBatches()["BATCH-2026-VJTI-0202"].records;
  const validReference = acceptedRecords[0].recordReference;
  const result = await verificationApi.verifyToken(` ${validReference.toLowerCase()} `, { purpose: "Employment check" });
  assert.deepEqual(result, {
    status: "VALID",
    studentName: "Nisha Rao",
    apaarId: "9001 0020 0303",
    institutionName: "Veermata Jijabai Technological Institute (VJTI Mumbai)",
    programme: "Computer Engineering",
    academicYear: "2026-2027",
    recordStatus: "ACCEPTED"
  });
  assert.equal(result.studentId, undefined);
  assert.equal(getAuditLogs().find((log) =>
    log.actionType === "RECORD_VERIFICATION_REQUESTED" &&
    log.resourceId === validReference
  )?.details.includes("Employment check"), true);
  assert.equal((await verificationApi.verifyToken("900100200303", { purpose: "Regulatory check" })).status, "NOT_FOUND");
  assert.equal((await verificationApi.verifyToken("Nisha Rao", { purpose: "Regulatory check" })).status, "NOT_FOUND");
  assert.equal((await verificationApi.verifyToken("VJTI-REC-001", { purpose: "Regulatory check" })).status, "NOT_FOUND");
});

test("External verifier never receives student details for missing, revoked, or consent-missing records", async () => {
  setCurrentUser(DEMO_ACCOUNTS.EXTERNAL_VERIFIER);
  const seededRecords = getStoredBatches()["BATCH-2026-VJTI-0202"].records;
  const revokedReference = seededRecords[3].recordReference;
  const noConsentReference = seededRecords[2].recordReference;
  const results = await Promise.all([
    verificationApi.verifyToken("unknown-reference", { purpose: "Regulatory check" }),
    verificationApi.verifyToken(revokedReference, { purpose: "Regulatory check" }),
    verificationApi.verifyToken(noConsentReference, { purpose: "Regulatory check" })
  ]);

  assert.deepEqual(results.map((result) => result.status), ["NOT_FOUND", "REVOKED", "CONSENT_MISSING"]);
  results.forEach((result) => {
    assert.equal(result.studentName, undefined);
    assert.equal(result.institutionName, undefined);
    assert.equal(result.apaarId, undefined);
  });
  const history = verificationApi.getVerificationHistory();
  assert.ok(history.some((entry) => entry.reference === "UNKNOWN-REFERENCE" && entry.result === "NOT_FOUND"));
  assert.ok(history.every((entry) => entry.verifierId === DEMO_ACCOUNTS.EXTERNAL_VERIFIER.id));
});

test("Accepted records have unique references and non-accepted records do not", async () => {
  const batches = getStoredBatches();
  const records = Object.values(batches).flatMap((batch) => batch.records || []);
  const accepted = records.filter((record) => record.status === "ACCEPTED");
  const references = accepted.map((record) => record.recordReference);
  assert.ok(accepted.length >= 3);
  assert.equal(new Set(references).size, references.length);
  assert.ok(references.every((reference) => /^APR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(reference)));
  assert.ok(records.filter((record) => record.status !== "ACCEPTED" && !record.revoked).every((record) => !record.recordReference));
});

test("APAAR journey is scoped for College and complete for AICTE", async () => {
  const collegeJourney = await collegeApi.getStudentJourney("345678901234");
  assert.equal(collegeJourney.records.length, 1);
  assert.equal(collegeJourney.records[0].institutionId, "INST-001");
  assert.equal(collegeJourney.hasActiveElsewhere, true);

  setCurrentUser(DEMO_ACCOUNTS.AICTE);
  const aicteJourney = await aicteApi.getStudentJourney("345678901234");
  assert.equal(aicteJourney.records.length, 2);
  assert.equal(aicteJourney.hasActiveElsewhere, true);
  assert.ok(getAuditLogs().some((log) => log.actionType === "APAAR_LOOKUP"));
});

test("Simulated APAAR check returns all three documented outcomes", () => {
  assert.equal(checkApaar("345678901234", "Rohan Kulkarni"), "NAME_MISMATCH");
  assert.equal(checkApaar("345678901234", "Rohan Kulkarny"), "FOUND");
  assert.equal(checkApaar("777788889999", "Absent Student"), "NOT_FOUND");
});

test("Simulated APAAR failures create a pending review without marking identity verified", async () => {
  const result = await collegeApi.fixAndRevalidateRecord("BATCH-2026-ENG-0402", "REC-009", {
    apaarId: "777788889999"
  });
  assert.equal(result.record.apaarCheck, "NOT_FOUND");
  assert.equal(result.record.status, "PENDING_REVIEW");
  assert.equal(result.record.issueType, "APAAR_AUTHENTICITY_REVIEW");
  assert.ok(getAuditLogs().some((log) => log.actionType === "APAAR_CHECK_RUN"));
});

test("National dashboard exposes accepted, unique and multi-enrolment APAAR counts", async () => {
  const stats = await aicteApi.getAicteDashboardStats("ALL");
  assert.ok(stats.totalAcceptedRecords >= stats.uniqueStudentsByApaar);
  assert.equal(stats.apaarIdsWithMultipleActiveEnrolments, 1);
  assert.equal(stats.totalAcceptedRecords, stats.totalAcceptedEnrolment);
});

test("Accepted records across stored batches receive stable integrity metadata", async () => {
  await repairStoredAcceptedRecords();
  const records = Object.values(getStoredBatches()).flatMap((batch) => batch.records || [])
    .filter((record) => record.status === "ACCEPTED");
  assert.ok(records.length > 0);
  assert.ok(records.every((record) =>
    record.recordReference &&
    record.verificationVersion === 1 &&
    /^[a-f0-9]{64}$/.test(record.verificationDigest)
  ));
});

test("Tampered verification metadata cannot produce a VALID result", async () => {
  const batch = getStoredBatches()["BATCH-2026-VJTI-0202"];
  const record = batch.records[0];
  const reference = record.recordReference;
  record.verificationDigest = "0".repeat(64);
  saveBatch(batch);
  const result = await verificationApi.verifyToken(reference, { purpose: "Employment check" });
  assert.equal(result.status, "NOT_FOUND");
});

test("Accepted records loaded without a reference receive one that stays stable", async () => {
  const batch = getStoredBatches()["BATCH-2026-ENG-0402"];
  const aarav = batch.records.find((record) => record.studentName === "Aarav Sharma");
  aarav.status = "ACCEPTED";
  delete aarav.recordReference;
  setActiveBatchId(batch.batchId);
  saveBatch(batch);

  const firstLoad = await collegeApi.getAcceptedRecords();
  const firstReference = firstLoad.find((record) => record.studentName === "Aarav Sharma").recordReference;
  const secondLoad = await collegeApi.getAcceptedRecords();
  const secondReference = secondLoad.find((record) => record.studentName === "Aarav Sharma").recordReference;

  assert.match(firstReference, /^APR-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(secondReference, firstReference);
});
