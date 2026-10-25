// College API
// Simulates REST endpoint /api/v1/college/*

import { APPROVAL_MASTER } from "../mocks/approvalMasterMock.js";
import { FAULTY_MOCK_BATCH, CLEAN_MOCK_BATCH } from "../mocks/mockBatches.js";
import { getActiveBatch, saveBatch, setActiveBatchId, getCurrentUser, simulateDaysPassing, getPrototypeSettings } from "../mocks/mockStore.js";
import { logAuditEvent } from "../mocks/mockAuditLog.js";

export const collegeApi = {
  // Get AICTE Approval Master for institution
  async getApprovalMaster(institutionId = "INST-001") {
    await new Promise((res) => setTimeout(res, 80));
    const inst = APPROVAL_MASTER.institutions.find((i) => i.id === institutionId) || APPROVAL_MASTER.institutions[0];
    return {
      academicYear: APPROVAL_MASTER.academicYear,
      institution: inst
    };
  },

  // Get active batch and its records
  async getActiveBatch() {
    await new Promise((res) => setTimeout(res, 80));
    return getActiveBatch();
  },

  // Load standard demo batch (Faulty or Clean)
  async loadPresetBatch(presetType = "FAULTY") {
    await new Promise((res) => setTimeout(res, 150));
    const target = presetType === "CLEAN" ? CLEAN_MOCK_BATCH : FAULTY_MOCK_BATCH;
    const batchClone = JSON.parse(JSON.stringify(target));
    batchClone.records = (batchClone.records || []).map((r) => ({
      ...r,
      source: r.source || "BULK_UPLOAD"
    }));
    saveBatch(batchClone);
    setActiveBatchId(batchClone.batchId);

    logAuditEvent({
      actorName: "Dr. Arvind Kulkarni",
      actorRole: "COLLEGE",
      actorEmail: "pict.admin@college.edu",
      actionType: "BATCH_LOADED",
      resourceType: "BATCH",
      resourceId: batchClone.batchId,
      details: `Loaded ${presetType} batch: ${batchClone.fileName} with ${batchClone.records.length} records.`,
      changeSummary: `Status set to ${batchClone.status}, ${batchClone.flaggedRowsCount} issues active`,
      severity: presetType === "FAULTY" ? "WARNING" : "INFO"
    });

    return batchClone;
  },

  // Simulate 8 days passing (triggers auto-escalation)
  async triggerSimulateDaysPassing(days = 8) {
    await new Promise((res) => setTimeout(res, 200));
    const result = simulateDaysPassing(days);
    return result;
  },

  // Get issues with comprehensive filtering & severity prioritization
  async getIssues({ batchId, course, year, issueType, severity, status, search } = {}) {
    await new Promise((res) => setTimeout(res, 80));
    const batch = getActiveBatch();
    let records = [...(batch.records || [])];

    // Filter by Course
    if (course && course !== "ALL") {
      records = records.filter((r) => r.programmeCode === course || r.programme.toLowerCase().includes(course.toLowerCase()));
    }

    // Filter by Year
    if (year && year !== "ALL") {
      records = records.filter((r) => r.yearOfStudy === year);
    }

    // Filter by Issue Type
    if (issueType && issueType !== "ALL") {
      if (issueType === "NONE") {
        records = records.filter((r) => !r.issueType);
      } else {
        records = records.filter((r) => r.issueType === issueType);
      }
    }

    // Filter by Severity
    if (severity && severity !== "ALL") {
      records = records.filter((r) => r.severity === severity);
    }

    // Filter by Status
    if (status && status !== "ALL") {
      records = records.filter((r) => r.status === status);
    }

    // Filter by Search (student name, APAAR ID, PRN, reason)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter((r) => 
        (r.studentName && r.studentName.toLowerCase().includes(q)) ||
        (r.apaarId && r.apaarId.toLowerCase().includes(q)) ||
        (r.studentId && r.studentId.toLowerCase().includes(q)) ||
        (r.reason && r.reason.toLowerCase().includes(q))
      );
    }

    // SORTING RULE:
    // "Sort issues so the most serious and highest-impact appear first (errors before warnings, then overdue)."
    records.sort((a, b) => {
      const getPriority = (r) => {
        // High errors (ACTION_REQUIRED)
        if (r.status === "ACTION_REQUIRED" && r.severity === "HIGH") {
          return r.isOverdue ? 100 : 90;
        }
        // Escalated / Overdue
        if (r.isOverdue || r.isEscalated) {
          return 80;
        }
        // Other errors
        if (r.status === "ACTION_REQUIRED") {
          return 70;
        }
        // Warnings (PENDING_REVIEW, e.g. cross-institution)
        if (r.status === "PENDING_REVIEW") {
          return 60;
        }
        // Ready to accept (resolved issues)
        if (r.status === "READY_TO_ACCEPT") {
          return 30;
        }
        // Accepted
        if (r.status === "ACCEPTED") {
          return 10;
        }
        return 0;
      };

      return getPriority(b) - getPriority(a);
    });

    return {
      batchId: batch.batchId,
      batchStatus: batch.status,
      totalRows: batch.totalRows,
      flaggedCount: batch.flaggedRowsCount,
      readyCount: batch.readyToAcceptCount,
      acceptedCount: batch.acceptedCount,
      records
    };
  },

  // Fix and Revalidate a record (Correction Loop)
  async fixAndRevalidateRecord(batchId, recordId, updatedFields) {
    await new Promise((res) => setTimeout(res, 250));
    const batch = getActiveBatch();
    const recordIndex = batch.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) {
      throw new Error(`Record with ID ${recordId} not found.`);
    }

    const currentRecord = batch.records[recordIndex];
    const outcome = applyValidationChecks(currentRecord, batch.records, updatedFields);
    const {
      validationPassed,
      newStatus,
      newStudentId,
      updatedRecord: validatedFields
    } = outcome;

    // Apply updates to record
    const updatedRecord = {
      ...currentRecord,
      ...validatedFields
    };

    batch.records[recordIndex] = updatedRecord;

    // Recalculate batch statistics
    const remainingFlagged = batch.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;
    const readyCount = batch.records.filter((r) => r.status === "READY_TO_ACCEPT").length;
    const acceptedCount = batch.records.filter((r) => r.status === "ACCEPTED").length;

    batch.flaggedRowsCount = remainingFlagged;
    batch.readyToAcceptCount = readyCount;
    batch.acceptedCount = acceptedCount;
    batch.status = remainingFlagged === 0 ? (readyCount > 0 ? "READY_TO_ACCEPT" : "ACCEPTED") : "ACTION_REQUIRED";

    saveBatch(batch);

    // Write to Mock Audit Log
    const currentUser = getCurrentUser();
    logAuditEvent({
      actorName: currentUser?.name || "Dr. Arvind Kulkarni",
      actorRole: currentUser?.role || "COLLEGE",
      actorEmail: currentUser?.email || "pict.admin@college.edu",
      actionType: "RECORD_RESUBMIT",
      resourceType: "STUDENT_RECORD",
      resourceId: recordId,
      details: `Resubmitted record for ${currentRecord.studentName} (${newStudentId}). Automated revalidation result: ${newStatus}.`,
      changeSummary: validationPassed 
        ? `Status: ${currentRecord.status} -> READY_TO_ACCEPT. Anomaly resolved.`
        : `Record remains unresolved (${newStatus}): ${newReason}`,
      severity: validationPassed ? "INFO" : "WARNING"
    });

    return {
      success: true,
      validationPassed,
      record: updatedRecord,
      batchSummary: {
        batchId: batch.batchId,
        batchStatus: batch.status,
        flaggedRowsCount: remainingFlagged,
        readyToAcceptCount: readyCount,
        acceptedCount
      }
    };
  },

  // Accept valid records into repository
  // CONTENT RULE: "Accept valid records moves only READY_TO_ACCEPT rows into the repository as ACCEPTED. ACCEPTED is not VERIFIED. Nothing is silently dropped or marked verified."
  async acceptBatchRecords(batchId) {
    await new Promise((res) => setTimeout(res, 200));
    const batch = getActiveBatch();
    
    let newlyAcceptedCount = 0;
    batch.records = batch.records.map((r) => {
      if (r.status === "READY_TO_ACCEPT") {
        newlyAcceptedCount++;
        return {
          ...r,
          status: "ACCEPTED",
          issueStatus: "RESOLVED",
          acceptedAt: new Date().toISOString(),
          reason: "Institutional acceptance confirmed: all automated system checks passed.",
          requiredAction: "Stored in central student enrolment repository. Ready for verification.",
          owner: "Central Repository"
        };
      }
      return r;
    });

    const remainingFlagged = batch.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;
    const readyCount = batch.records.filter((r) => r.status === "READY_TO_ACCEPT").length;
    const totalAccepted = batch.records.filter((r) => r.status === "ACCEPTED").length;

    batch.flaggedRowsCount = remainingFlagged;
    batch.readyToAcceptCount = readyCount;
    batch.acceptedCount = totalAccepted;
    batch.status = remainingFlagged === 0 ? "ACCEPTED" : "ACTION_REQUIRED";

    saveBatch(batch);

    const currentUser = getCurrentUser();
    logAuditEvent({
      actorName: currentUser?.name || "Dr. Arvind Kulkarni",
      actorRole: currentUser?.role || "COLLEGE",
      actorEmail: currentUser?.email || "pict.admin@college.edu",
      actionType: "RECORDS_ACCEPTED",
      resourceType: "BATCH",
      resourceId: batch.batchId,
      details: `Accepted ${newlyAcceptedCount} validated student records into Central Repository.`,
      changeSummary: `Total Accepted: ${totalAccepted}. Remaining unresolved anomalies: ${remainingFlagged}`,
      severity: "INFO"
    });

    return {
      success: true,
      newlyAcceptedCount,
      totalAccepted,
      remainingFlagged,
      batchStatus: batch.status
    };
  },

  // College Dashboard Data (own data only)
  async getDashboardStats() {
    await new Promise((res) => setTimeout(res, 80));
    const batch = getActiveBatch();
    const records = batch.records || [];

    const approvedIntake = 420; // Total approved capacity across PICT programmes (120+120+120+60)
    // Only ACCEPTED records count toward enrolment
    const acceptedCount = records.filter((r) => r.status === "ACCEPTED").length;
    const readyCount = records.filter((r) => r.status === "READY_TO_ACCEPT").length;
    const openAnomalies = records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;
    const overdueAnomalies = records.filter((r) => r.isOverdue).length;
    const escalatedAnomalies = records.filter((r) => r.isEscalated).length;

    // Per-programme breakdown table
    const programmes = [
      {
        code: "COMP",
        name: "Computer Engineering",
        degree: "B.Tech",
        year: "2026-27",
        approvedIntake: 120,
        acceptedEnrolment: records.filter((r) => r.status === "ACCEPTED" && (r.programmeCode === "COMP" || r.programme.toLowerCase().includes("comp"))).length,
        readyToAccept: records.filter((r) => r.status === "READY_TO_ACCEPT" && (r.programmeCode === "COMP" || r.programme.toLowerCase().includes("comp"))).length,
        anomaliesCount: records.filter((r) => (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") && (r.programmeCode === "COMP" || r.programme.toLowerCase().includes("comp"))).length
      },
      {
        code: "IT",
        name: "Information Technology",
        degree: "B.Tech",
        year: "2026-27",
        approvedIntake: 120,
        acceptedEnrolment: records.filter((r) => r.status === "ACCEPTED" && (r.programmeCode === "IT" || r.programme.toLowerCase().includes("it"))).length,
        readyToAccept: records.filter((r) => r.status === "READY_TO_ACCEPT" && (r.programmeCode === "IT" || r.programme.toLowerCase().includes("it"))).length,
        anomaliesCount: records.filter((r) => (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") && (r.programmeCode === "IT" || r.programme.toLowerCase().includes("it"))).length
      },
      {
        code: "ENTC",
        name: "Electronics & Telecommunication",
        degree: "B.Tech",
        year: "2026-27",
        approvedIntake: 120,
        acceptedEnrolment: records.filter((r) => r.status === "ACCEPTED" && (r.programmeCode === "ENTC" || r.programme.toLowerCase().includes("entc"))).length,
        readyToAccept: records.filter((r) => r.status === "READY_TO_ACCEPT" && (r.programmeCode === "ENTC" || r.programme.toLowerCase().includes("entc"))).length,
        anomaliesCount: records.filter((r) => (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") && (r.programmeCode === "ENTC" || r.programme.toLowerCase().includes("entc"))).length
      },
      {
        code: "AIDS",
        name: "Artificial Intelligence & Data Science",
        degree: "B.Tech",
        year: "2026-27",
        approvedIntake: 60,
        acceptedEnrolment: records.filter((r) => r.status === "ACCEPTED" && (r.programmeCode === "AIDS" || r.programme.toLowerCase().includes("aids"))).length,
        readyToAccept: records.filter((r) => r.status === "READY_TO_ACCEPT" && (r.programmeCode === "AIDS" || r.programme.toLowerCase().includes("aids"))).length,
        anomaliesCount: records.filter((r) => (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") && (r.programmeCode === "AIDS" || r.programme.toLowerCase().includes("aids"))).length
      }
    ];

    // Compute utilisation per programme
    programmes.forEach((p) => {
      p.utilisation = Math.round((p.acceptedEnrolment / p.approvedIntake) * 100);
      p.isExceeded = p.acceptedEnrolment > p.approvedIntake;
    });

    // Category breakdown
    const categoryCounts = {
      GENERAL: records.filter((r) => r.category === "GENERAL" && r.status === "ACCEPTED").length,
      OBC: records.filter((r) => r.category === "OBC" && r.status === "ACCEPTED").length,
      SC: records.filter((r) => r.category === "SC" && r.status === "ACCEPTED").length,
      ST: records.filter((r) => r.category === "ST" && r.status === "ACCEPTED").length,
      EWS: records.filter((r) => r.category === "EWS" && r.status === "ACCEPTED").length,
      TFWS: records.filter((r) => r.category === "TFWS" && r.status === "ACCEPTED").length,
      NRI_FN: records.filter((r) => r.category === "NRI_FN" && r.status === "ACCEPTED").length,
      NRI_FN_LIMIT: 5 // Supernumerary limit for Computer Engineering
    };

    const overallUtilisation = Math.round((acceptedCount / approvedIntake) * 100);

    return {
      institutionName: "Pune Institute of Computer Technology (PICT)",
      institutionId: "INST-001",
      aicteId: "AICTE-1-1029384",
      approvedIntake,
      acceptedEnrolment: acceptedCount,
      readyToAccept: readyCount,
      utilisationPercentage: overallUtilisation,
      openAnomalies,
      overdueAnomalies,
      escalatedAnomalies,
      programmes,
      categoryCounts,
      currentBatchId: batch.batchId,
      currentBatchStatus: batch.status
    };
  },

  // Export Intake Report (CSV) with multi-institution isolation check
  async exportIntakeCSV(requestedInstitutionId = "INST-001") {
    const currentUser = getCurrentUser();
    // Security Guard: College can only download its own data
    if (currentUser?.role === "COLLEGE" && requestedInstitutionId !== "INST-001") {
      logAuditEvent({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorEmail: currentUser.email,
        actionType: "UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT",
        resourceType: "REPORT",
        resourceId: requestedInstitutionId,
        details: `Access Denied: PICT user attempted unauthorized download of ${requestedInstitutionId} intake data.`,
        changeSummary: "Request blocked by institutional data isolation policy",
        severity: "CRITICAL"
      });
      throw new Error("Access Denied: Institutions are strictly restricted from downloading other colleges' intake data.");
    }

    const batch = getActiveBatch();
    const records = batch.records || [];
    const headers = "Institution,Programme,Year,Approved Intake,Accepted Enrolment,Utilisation %,Category Counts\n";
    
    const rows = [
      `"PICT Pune","Computer Engineering","2026-27",120,${records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'COMP').length},"${Math.round((records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'COMP').length / 120) * 100)}%","GEN/OBC/SC/ST/EWS/NRI"`,
      `"PICT Pune","Information Technology","2026-27",120,${records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'IT').length},"${Math.round((records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'IT').length / 120) * 100)}%","GEN/OBC/SC/ST/EWS/NRI"`,
      `"PICT Pune","Electronics & Telecom","2026-27",120,${records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'ENTC').length},"${Math.round((records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'ENTC').length / 120) * 100)}%","GEN/OBC/SC/ST/EWS/NRI"`,
      `"PICT Pune","AI & Data Science","2026-27",60,${records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'AIDS').length},"${Math.round((records.filter(r => r.status === 'ACCEPTED' && r.programmeCode === 'AIDS').length / 60) * 100)}%","GEN/OBC/SC/ST/EWS/NRI"`
    ].join("\n");

    return headers + rows;
  },

  // Export Anomaly Report (CSV) with multi-institution isolation check
  async exportAnomaliesCSV(requestedInstitutionId = "INST-001") {
    const currentUser = getCurrentUser();
    if (currentUser?.role === "COLLEGE" && requestedInstitutionId !== "INST-001") {
      logAuditEvent({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorEmail: currentUser.email,
        actionType: "UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT",
        resourceType: "REPORT",
        resourceId: requestedInstitutionId,
        details: `Access Denied: PICT user attempted unauthorized download of ${requestedInstitutionId} anomaly logs.`,
        changeSummary: "Request blocked by institutional data isolation policy",
        severity: "CRITICAL"
      });
      throw new Error("Access Denied: Institutions are strictly restricted from downloading other colleges' anomaly reports.");
    }

    const batch = getActiveBatch();
    const records = batch.records || [];
    const headers = "Batch,Row,Student Name,PRN,APAAR ID,Issue Type,Severity,Reason,Owner,Status,Due Date\n";
    const anomalyRows = records
      .filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW")
      .map((r, idx) => `${batch.batchId},${idx + 1},"${r.studentName}",${r.studentId},${r.apaarId || "MISSING"},${r.issueType},${r.severity},"${r.reason}","${r.owner}",${r.status},${r.dueDate}`)
      .join("\n");

    return headers + anomalyRows;
  },

  // ─── Staging helpers ──────────────────────────────────────────────────────

  // Add one or more manually-entered or bulk-uploaded records to the active
  // batch staging area. Records land with status UPLOADED; they do NOT become
  // ACCEPTED until the college runs Validate Records and then accepts them.
  // source: "MANUAL_ENTRY" | "BULK_UPLOAD"
  async addStudentsToStaging(studentRecords, source = "MANUAL_ENTRY") {
    await new Promise((res) => setTimeout(res, 150));
    const currentUser = getCurrentUser();

    // Enforce institution isolation: a college can only add records for itself.
    if (currentUser?.role === "COLLEGE" && currentUser?.id && currentUser.id !== "INST-001") {
      logAuditEvent({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorEmail: currentUser.email,
        actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
        resourceType: "STAGING_AREA",
        resourceId: currentUser.id,
        details: `Institution ${currentUser.id} attempted to add records to a staging area it does not own.`,
        changeSummary: "Blocked by institution isolation policy",
        severity: "CRITICAL"
      });
      throw new Error("Access Denied: You can only add records for your own institution.");
    }

    const batch = getActiveBatch();
    const now = new Date().toISOString();
    const ownId = currentUser?.id || "INST-001";
    const ownName = currentUser?.institutionName || "Pune Institute of Computer Technology (PICT)";
    const foreign = studentRecords.find((s) => s.institutionId && s.institutionId !== ownId);
    if (foreign) {
      logAuditEvent({
        actorName: currentUser?.name,
        actorRole: currentUser?.role,
        actorEmail: currentUser?.email,
        actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
        resourceType: "STAGING_AREA",
        resourceId: foreign.institutionId,
        details: `Institution ${ownId} attempted to add records for ${foreign.institutionId}.`,
        changeSummary: "Blocked by institution isolation policy",
        severity: "CRITICAL"
      });
      throw new Error("Access Denied: You can only add records for your own institution.");
    }

    const newRecords = studentRecords.map((s, i) => ({
      // Default validation/issue fields — cleared on entry; set after validation
      id: `MANUAL-${Date.now()}-${i}`,
      source,
      institutionId: ownId,
      institutionName: ownName,
      // Student data from the form / CSV mapping (existing record shape only)
      studentId: (s.studentId || "").trim(),
      studentName: (s.studentName || "").trim(),
      apaarId: (s.apaarId || "").trim(),
      programme: (s.programme || "").trim(),
      programmeCode: _mapProgrammeCode(s.programme || ""),
      yearOfStudy: s.yearOfStudy || "FE",
      category: s.category || "GENERAL",
      gender: s.gender || "",
      admissionDate: s.admissionDate || now.slice(0, 10),
      // Status before validation
      status: "UPLOADED",
      issueType: null,
      issueTitle: null,
      issueStatus: "PENDING",
      severity: null,
      reason: "Awaiting validation.",
      evidence: "",
      owner: "Institution Data Officer",
      requiredAction: "Run Validate Records to check this student entry.",
      dueDate: "",
      dueDays: null,
      dueDateLabel: "",
      isOverdue: false,
      isEscalated: false,
      validationNote: "format-checked, not identity-verified",
      addedAt: now
    }));

    batch.records = [...(batch.records || []), ...newRecords];
    batch.totalRows = (batch.totalRows || 0) + newRecords.length;
    saveBatch(batch);

    logAuditEvent({
      actorName: currentUser?.name || "Dr. Arvind Kulkarni",
      actorRole: currentUser?.role || "COLLEGE",
      actorEmail: currentUser?.email || "pict.admin@college.edu",
      actionType: "STUDENT_RECORDS_ADDED",
      resourceType: "STAGING_AREA",
      resourceId: batch.batchId,
      details: `Added ${newRecords.length} student record(s) to staging. Source: ${source}. Institution: ${ownName} (${ownId}).`,
      changeSummary: `${newRecords.length} record(s) in UPLOADED status. Validation required before acceptance.`,
      severity: "INFO"
    });

    return { success: true, addedCount: newRecords.length, batchId: batch.batchId };
  },

  // Return all non-ACCEPTED records from the active batch (= the staging view).
  // Supports filtering by source, status, and free-text search.
  async getStagedRecords({ source = "ALL", status = "ALL", search = "" } = {}) {
    await new Promise((res) => setTimeout(res, 80));
    const batch = getActiveBatch();
    let records = [...(batch.records || [])];

    if (source !== "ALL") {
      records = records.filter((r) => (r.source || "BULK_UPLOAD") === source);
    }
    if (status !== "ALL") {
      records = records.filter((r) => r.status === status);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(
        (r) =>
          r.studentId?.toLowerCase().includes(q) ||
          r.studentName?.toLowerCase().includes(q) ||
          r.apaarId?.toLowerCase().includes(q)
      );
    }

    return {
      batchId: batch.batchId,
      totalRows: batch.totalRows,
      records
    };
  },

  // Run validation on a selected set of record IDs (or all staged records if
  // recordIds is null/empty). Reuses the same 7-check rules as fixAndRevalidate.
  // Writes a RECORDS_VALIDATED audit entry.
  async validateStagedRecords(recordIds = null) {
    await new Promise((res) => setTimeout(res, 300));
    const currentUser = getCurrentUser();
    const batch = getActiveBatch();
    if (currentUser?.role === "COLLEGE" && batch.institutionId && currentUser.id !== batch.institutionId) {
      logAuditEvent({
        actorName: currentUser.name,
        actorRole: currentUser.role,
        actorEmail: currentUser.email,
        actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
        resourceType: "BATCH",
        resourceId: batch.institutionId,
        details: `Institution ${currentUser.id} attempted to validate records for ${batch.institutionId}.`,
        changeSummary: "Blocked by institution isolation policy",
        severity: "CRITICAL"
      });
      throw new Error("Access Denied: You can only validate records for your own institution.");
    }

    const allRecords = batch.records || [];

    // Which records to validate: selected set or all non-ACCEPTED
    const toValidateIds = new Set(
      recordIds && recordIds.length > 0
        ? recordIds
        : allRecords.filter((r) => r.status !== "ACCEPTED").map((r) => r.id)
    );
    const toValidate = allRecords.filter((r) => toValidateIds.has(r.id));

    let passed = 0;
    let flagged = 0;
    let blocking = 0;
    let warnings = 0;

    const updatedRecords = allRecords.map((record) => {
      if (!toValidateIds.has(record.id)) return record;

      // Same 7-check engine as fixAndRevalidateRecord; selected set is the batch
      const result = applyValidationChecks(record, toValidate, {});
      if (result.validationPassed) {
        passed++;
      } else {
        flagged++;
        if (result.newStatus === "PENDING_REVIEW") warnings++;
        else blocking++;
      }
      return { ...record, ...result.updatedRecord };
    });

    batch.records = updatedRecords;
    // Recalculate batch-level stats
    batch.flaggedRowsCount = updatedRecords.filter(
      (r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW"
    ).length;
    batch.readyToAcceptCount = updatedRecords.filter((r) => r.status === "READY_TO_ACCEPT").length;
    batch.acceptedCount = updatedRecords.filter((r) => r.status === "ACCEPTED").length;
    batch.status =
      batch.flaggedRowsCount > 0
        ? "ACTION_REQUIRED"
        : batch.readyToAcceptCount > 0
        ? "READY_TO_ACCEPT"
        : "ACCEPTED";
    saveBatch(batch);

    logAuditEvent({
      actorName: currentUser?.name || "Dr. Arvind Kulkarni",
      actorRole: currentUser?.role || "COLLEGE",
      actorEmail: currentUser?.email || "pict.admin@college.edu",
      actionType: "RECORDS_VALIDATED",
      resourceType: "BATCH",
      resourceId: batch.batchId,
      details: `Validated ${toValidate.length} record(s). Institution: ${batch.institutionName || "PICT"} (${batch.institutionId || "INST-001"}). Passed: ${passed}, Flagged: ${flagged} (Blocking: ${blocking}, Warnings: ${warnings}).`,
      changeSummary: `${passed} record(s) → READY_TO_ACCEPT; ${flagged} record(s) remain flagged.`,
      severity: flagged > 0 ? "WARNING" : "INFO"
    });

    return {
      success: true,
      validated: toValidate.length,
      passed,
      flagged,
      blocking,
      warnings,
      records: batch.records.filter((r) => toValidateIds.has(r.id))
    };
  }
};

// ─── Private helpers ─────────────────────────────────────────────────────────

// Map a programme name string to a programme code used by the dashboard.
function _mapProgrammeCode(programme) {
  const p = programme.toLowerCase();
  if (p.includes("comp")) return "COMP";
  if (p.includes("info") || p.includes(" it") || p.startsWith("it")) return "IT";
  if (p.includes("entc") || p.includes("electronic")) return "ENTC";
  if (p.includes("aids") || p.includes("artificial") || p.includes("data science")) return "AIDS";
  return "OTHER";
}

// Shared 7-check engine used by fixAndRevalidateRecord and validateStagedRecords.
// comparisonRecords is the set treated as one batch for duplicate-in-batch.
function applyValidationChecks(currentRecord, comparisonRecords, updatedFields = {}) {
  const newApaar = updatedFields.apaarId !== undefined ? updatedFields.apaarId.trim() : currentRecord.apaarId;
  const newStudentId = updatedFields.studentId !== undefined ? updatedFields.studentId.trim() : currentRecord.studentId;
  const newProgramme = updatedFields.programme !== undefined ? updatedFields.programme : currentRecord.programme;
  const newCategory = updatedFields.category !== undefined ? updatedFields.category : currentRecord.category;
  const newYearOfStudy = updatedFields.yearOfStudy !== undefined ? updatedFields.yearOfStudy : currentRecord.yearOfStudy;
  const transferProof = updatedFields.transferProof;

  let validationPassed = true;
  let newStatus = "READY_TO_ACCEPT";
  let newIssueStatus = "RESOLVED";
  let newIssueType = null;
  let newReason = "All validation checks passed. Record revalidated automatically.";
  let newEvidence = "Corrected fields passed 12-digit format, course mapping, and seat limits.";
  let newAction = "Ready for institutional acceptance into central repository.";
  let newSeverity = "LOW";
  let newOwner = "System Auto-Validator";
  let isOverdue = false;
  let isEscalated = false;

  // Check 1: Empty APAAR
  if (!newApaar) {
    validationPassed = false;
    newStatus = "ACTION_REQUIRED";
    newIssueStatus = "OPEN";
    newIssueType = "MISSING_APAAR_ID";
    newReason = "APAAR ID field is still blank.";
    newEvidence = "Field 'apaarId' contains empty string.";
    newAction = "Provide a valid 12-digit numeric APAAR ID.";
    newSeverity = "HIGH";
    newOwner = "Institution Data Officer";
  }
  // Check 2: 12-digit numeric regex (format-checked, not identity-verified)
  else if (!/^\d{12}$/.test(newApaar)) {
    validationPassed = false;
    newStatus = "ACTION_REQUIRED";
    newIssueStatus = "OPEN";
    newIssueType = "WRONG_FORMAT";
    newReason = `APAAR ID '${newApaar}' is invalid. Must be exactly 12 numeric digits (format-checked, not identity-verified).`;
    newEvidence = "Non-numeric characters or invalid length detected.";
    newAction = "Correct to 12 digits.";
    newSeverity = "HIGH";
    newOwner = "Institution Data Officer";
  }
  // Check 3: Duplicate within the comparison batch (excluding self)
  else {
    const otherDuplicate = comparisonRecords.find((r) => r.id !== currentRecord.id && r.apaarId === newApaar);
    if (otherDuplicate) {
      validationPassed = false;
      newStatus = "ACTION_REQUIRED";
      newIssueStatus = "OPEN";
      newIssueType = "DUPLICATE_IN_BATCH";
      newReason = `APAAR '${newApaar}' is still shared with another student (${otherDuplicate.studentName}, PRN: ${otherDuplicate.studentId}) in this batch.`;
      newEvidence = `Duplicate with record ${otherDuplicate.id}.`;
      newAction = "Assign unique APAAR ID.";
      newSeverity = "HIGH";
      newOwner = "Institution Data Officer";
    }
  }

  // Check 4: Unapproved course mapping (e.g. Aeronautical)
  if (validationPassed && (newProgramme.toLowerCase().includes("aero") || newProgramme.toLowerCase().includes("aviation"))) {
    validationPassed = false;
    newStatus = "ACTION_REQUIRED";
    newIssueStatus = "OPEN";
    newIssueType = "COURSE_MAPPING_ERROR";
    newReason = `Programme '${newProgramme}' is not approved for this campus in AICTE Approval Master.`;
    newEvidence = "Approval Master sanction missing for Aeronautical Engineering.";
    newAction = "Reassign student to an approved department (Computer, IT, EnTC, or AI&DS).";
    newSeverity = "HIGH";
    newOwner = "Data Officer + Master-Data Admin";
  }

  // Check 5: Warnings (Cross-institution conflict)
  if (currentRecord.issueType === "CROSS_INSTITUTION_CONFLICT") {
    if (!transferProof && !updatedFields.verifiedResolution) {
      validationPassed = false;
      newStatus = "PENDING_REVIEW";
      newIssueStatus = "OPEN";
      newIssueType = "CROSS_INSTITUTION_CONFLICT";
      newReason = "Active enrolment conflict: student concurrently enrolled in COEP Tech. Flagged for review, not fraud.";
      newEvidence = "Requires transfer cancellation certificate or AICTE reviewer confirmation.";
      newAction = "AICTE Reviewer must adjudicate transfer documentation.";
      newOwner = "AICTE Central Reviewer";
      newSeverity = "HIGH";
      isEscalated = true;
    } else {
      validationPassed = true;
      newStatus = "READY_TO_ACCEPT";
      newIssueStatus = "RESOLVED";
      newIssueType = null;
      newReason = "Transfer documentation verified. Cross-institution conflict cleared.";
      newEvidence = `Clearance Certificate: ${transferProof || "NOC/TC Verified"}. AICTE flag resolved.`;
      newAction = "Ready for acceptance.";
      newOwner = "System Auto-Validator";
    }
  }

  // Check 6: Excess Intake warning
  if (currentRecord.issueType === "INTAKE_EXCEEDED") {
    if (!updatedFields.supernumeraryApproval) {
      validationPassed = false;
      newStatus = "PENDING_REVIEW";
      newIssueStatus = currentRecord.isOverdue ? "OVERDUE" : "OPEN";
      newIssueType = "INTAKE_EXCEEDED";
      newReason = "Potential excess intake flagged for review: Computer Engineering admissions reached 125 vs 120 approved intake.";
      newEvidence = "Approval Master approved seats: 120. Enrolled: 125. Over-enrolment threshold exceeded.";
      newOwner = "AICTE Central Reviewer";
      newAction = "AICTE Reviewer must verify supernumerary sanction or adjust allocation.";
      newSeverity = "HIGH";
      isOverdue = currentRecord.isOverdue;
      isEscalated = true;
    } else {
      validationPassed = true;
      newStatus = "READY_TO_ACCEPT";
      newIssueStatus = "RESOLVED";
      newIssueType = null;
      newReason = "Supernumerary sanction verified. Intake discrepancy reconciled.";
      newEvidence = "AICTE Sanction Ref: " + updatedFields.supernumeraryApproval;
      newAction = "Ready for acceptance.";
    }
  }

  // Check 7: Quota limits (NRI/FN)
  if (currentRecord.issueType === "SEAT_CATEGORY_LIMIT" && newCategory === "NRI_FN") {
    validationPassed = false;
    newStatus = "ACTION_REQUIRED";
    newIssueStatus = "OPEN";
    newIssueType = "SEAT_CATEGORY_LIMIT";
    newReason = "NRI/FN supernumerary quota remains exceeded (max 5 seats approved in Approval Master).";
    newEvidence = "Approval Master limit: 5 seats for Computer Engineering.";
    newAction = "Re-categorize student under eligible GENERAL pool or upload supernumerary approval letter.";
    newOwner = "Admissions Officer";
    newSeverity = "MEDIUM";
  }

  return {
    validationPassed,
    newStatus,
    newStudentId,
    updatedRecord: {
      apaarId: newApaar,
      studentId: newStudentId,
      programme: newProgramme,
      programmeCode: newProgramme.toUpperCase().includes("COMP") ? "COMP" : (newProgramme.toUpperCase().includes("IT") ? "IT" : "OTHER"),
      category: newCategory,
      yearOfStudy: newYearOfStudy,
      status: newStatus,
      issueStatus: newIssueStatus,
      issueType: newIssueType,
      reason: newReason,
      evidence: newEvidence,
      requiredAction: newAction,
      owner: newOwner,
      severity: newSeverity,
      isOverdue: validationPassed ? false : isOverdue,
      isEscalated: validationPassed ? false : isEscalated,
      lastRevalidatedAt: new Date().toISOString()
    }
  };
}
