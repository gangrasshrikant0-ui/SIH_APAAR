import test from "node:test";
import assert from "node:assert/strict";

// Import APIs & Mocks
import { APPROVAL_MASTER } from "../src/mocks/approvalMasterMock.js";
import { FAULTY_MOCK_BATCH } from "../src/mocks/mockBatches.js";
import { initializeStore, resetDemoState, setCurrentUser, DEMO_ACCOUNTS } from "../src/mocks/mockStore.js";
import { collegeApi } from "../src/api/collegeApi.js";
import { aicteApi } from "../src/api/aicteApi.js";
import { getAuditLogs } from "../src/mocks/mockAuditLog.js";

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
