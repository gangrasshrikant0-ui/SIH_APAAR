  // College API
  // Simulates REST endpoint /api/v1/college/*

  import { APPROVAL_MASTER } from "../mocks/approvalMasterMock.js";
  import {
    FAULTY_MOCK_BATCH,
    CLEAN_MOCK_BATCH,
    COEP_MOCK_BATCH,
    VJTI_MOCK_BATCH,
    generateRecordReference
  } from "../mocks/mockBatches.js";

  import {
    getActiveBatch,
    getStoredBatches,
    saveBatch,
    setActiveBatchId,
    getCurrentUser,
    simulateDaysPassing,
    getCollegeNoticeReads,
    emitNotification,
    listNotificationsForUser,
    markStoredNotificationRead,
    getInstitutionMaster
  } from "../mocks/mockStore.js";

  import { logAuditEvent } from "../mocks/mockAuditLog.js";
  import { checkApaar } from "./apaarApi.js";
  import { createVerificationDigest } from "./verificationIntegrity.js";

  import {
    isValidCategory,
    isValidYearOfStudy,
    normalizeSyntheticApaar
  } from "../mocks/demoReference.js";

  export const collegeApi = {
    // Get AICTE Approval Master for institution
    async getApprovalMaster(institutionId = "INST-001") {
      await new Promise((res) => setTimeout(res, 80));

      const inst =
        APPROVAL_MASTER.institutions.find((i) => i.id === institutionId) ||
        APPROVAL_MASTER.institutions[0];

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

    async getAcceptedRecords() {
      await new Promise((res) => setTimeout(res, 80));
      await repairStoredAcceptedRecords();

      const batch = getActiveBatch();
      const records = batch.records || [];

      return records.filter((record) => record.status === "ACCEPTED");
    },

    async getStudentJourney(apaarId) {
      await new Promise((res) => setTimeout(res, 80));

      const currentUser = getCurrentUser();
      const normalized = String(apaarId || "").trim();

      const allMatches = Object.values(getStoredBatches()).flatMap((batch) =>
        (batch.records || [])
          .filter((record) => record.apaarId === normalized)
          .map((record) => ({
            ...record,
            batchId: batch.batchId,
            institutionId: batch.institutionId,
            institutionName: batch.institutionName
          }))
      );

      const ownRecords = allMatches.filter(
        (record) => record.institutionId === currentUser?.id
      );

      const hasActiveElsewhere = allMatches.some(
        (record) =>
          record.institutionId !== currentUser?.id &&
          record.status !== "REJECTED"
      );

      logAuditEvent({
        actorName: currentUser?.name || "College User",
        actorRole: currentUser?.role || "COLLEGE",
        actorEmail: currentUser?.email || "pict.admin@college.edu",
        actionType: "APAAR_LOOKUP",
        resourceType: "APAAR_ID",
        resourceId: normalized,
        details: `APAAR lookup for ${normalized}. Institution: ${
          currentUser?.institutionName || "Unknown"
        }.`,
        changeSummary: `${ownRecords.length} record(s) returned.`,
        severity: "INFO"
      });

      return {
        records: ownRecords,
        allRecords: allMatches,
        hasActiveElsewhere
      };
    },

    // Load standard demo batch (Faulty or Clean)
    async loadPresetBatch(presetType = "FAULTY") {
      await new Promise((res) => setTimeout(res, 150));

      const currentUser = getCurrentUser();
      const target =
        presetType === "CLEAN" ? CLEAN_MOCK_BATCH : FAULTY_MOCK_BATCH;

      if (
        currentUser?.role === "COLLEGE" &&
        currentUser.id !== target.institutionId
      ) {
        throw new Error(
          "Preset batches for this demo belong to a different institution."
        );
      }

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

    // Simulate days passing (triggers auto-escalation)
    async triggerSimulateDaysPassing(days = 8) {
      await new Promise((res) => setTimeout(res, 200));
      return simulateDaysPassing(days);
    },

    // Get issues with comprehensive filtering & severity prioritization
    async getIssues({
      batchId,
      course,
      year,
      category,
      issueType,
      severity,
      status,
      search,
      bucket
    } = {}) {
      await new Promise((res) => setTimeout(res, 80));

      const currentUser = getCurrentUser();
      const scoped = collectScopedRecords(currentUser, batchId);

      if (batchId && !scoped.batches.length) {
        return {
          records: [],
          issues: [],
          batchId,
          batchStatus: "NOT_FOUND",
          totalRows: 0,
          flaggedCount: 0,
          readyCount: 0,
          acceptedCount: 0,
          unresolvedIssueCount: 0,
          resolvedIssueCount: 0
        };
      }

      const batch = scoped.primaryBatch;
      let records = [...scoped.records].filter(
        (record) => record.visibleToCollege !== false
      );

      // Filter by Course
      if (course && course !== "ALL") {
        const normalizedCourse = String(course).toLowerCase();

        records = records.filter(
          (r) =>
            r.programmeCode === course ||
            String(r.programme || "")
              .toLowerCase()
              .includes(normalizedCourse)
        );
      }

      // Filter by Year
      if (year && year !== "ALL") {
        records = records.filter(
          (r) => String(r.yearOfStudy) === String(year)
        );
      }

      // Filter by Category
      if (category && category !== "ALL") {
        records = records.filter((r) => r.category === category);
      }

      // Filter by Issue Type
      if (issueType && issueType !== "ALL") {
        if (issueType === "NONE") {
          records = records.filter((r) => !r.issueType);
        } else {
          records = records.filter(
            (r) =>
              r.issueType === issueType ||
              (r.issueLedger || []).some(
                (issue) => issue.issueType === issueType
              )
          );
        }
      }

      // Filter by Severity
      if (severity && severity !== "ALL") {
        records = records.filter(
          (r) =>
            r.severity === severity ||
            (r.issueLedger || []).some(
              (issue) => issue.severity === severity
            )
        );
      }

      // Filter by Status
      if (status && status !== "ALL") {
        records = records.filter(
          (r) =>
            r.status === status ||
            r.issueStatus === status ||
            (r.issueLedger || []).some(
              (issue) => issue.issueStatus === status
            )
        );
      }

      // Search student name, APAAR ID, PRN, reason, or issue
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();

        records = records.filter((r) =>
          [
            r.studentName,
            r.apaarId,
            r.studentId,
            r.reason,
            r.issueId
          ].some((value) =>
            String(value || "").toLowerCase().includes(q)
          ) ||
          (r.issueLedger || []).some((issue) =>
            [
              issue.issueId,
              issue.reason,
              issue.issueTitle
            ].some((value) =>
              String(value || "").toLowerCase().includes(q)
            )
          )
        );
      }

      // Sort most serious and highest-impact issues first
      records.sort((a, b) => {
        const getPriority = (r) => {
          if (
            r.status === "ACTION_REQUIRED" &&
            r.severity === "HIGH"
          ) {
            return r.isOverdue ? 100 : 90;
          }

          if (r.isOverdue || r.isEscalated) return 80;
          if (r.status === "ACTION_REQUIRED") return 70;
          if (r.status === "PENDING_REVIEW") return 60;
          if (r.status === "READY_TO_ACCEPT") return 30;
          if (r.status === "ACCEPTED") return 10;

          return 0;
        };

        return getPriority(b) - getPriority(a);
      });

      const deduplicateIssues = (issueList) => {
        const unique = new Map();
        issueList.forEach((issue) => {
          const key = [
            issue.batchId || "",
            issue.recordId || issue.studentId || issue.issueId || "",
            issue.issueType || "",
          ].join("::");
          const existing = unique.get(key);
          if (!existing) {
            unique.set(key, issue);
            return;
          }
          const existingDate = new Date(existing.resolvedAt || existing.updatedAt || existing.flaggedAt || 0).getTime();
          const currentDate = new Date(issue.resolvedAt || issue.updatedAt || issue.flaggedAt || 0).getTime();
          if (currentDate > existingDate) unique.set(key, issue);
        });
        return Array.from(unique.values());
      };

      const uniqueAllIssues = deduplicateIssues(
        scoped.records.flatMap((record) => flattenRecordIssues(record))
      );
      const unresolvedIssueCount = uniqueAllIssues.filter((issue) =>
        isOpenIssueStatus(issue.issueStatus)
      ).length;
      const resolvedIssueCount = uniqueAllIssues.filter(
        (issue) => issue.issueStatus === "RESOLVED"
      ).length;

      let issues = records.flatMap((record) =>
        flattenRecordIssues(record)
      );

      if (issueType && issueType !== "ALL" && issueType !== "NONE") {
        issues = issues.filter(
          (issue) => issue.issueType === issueType
        );
      }

      if (severity && severity !== "ALL") {
        issues = issues.filter(
          (issue) => issue.severity === severity
        );
      }

      if (status && status !== "ALL") {
        issues = issues.filter(
          (issue) =>
            issue.issueStatus === status ||
            issue.status === status
        );
      }

      if (bucket === "unresolved") {
        issues = issues.filter((issue) =>
          isOpenIssueStatus(issue.issueStatus)
        );
      } else if (bucket === "resolved") {
        issues = issues.filter(
          (issue) => issue.issueStatus === "RESOLVED"
        );
      }

      // Remove duplicate issue entries for the same student,
// batch, and issue type. Keep the latest resolved entry.
// Remove duplicate resolved issue entries.
// Prefer the latest correction for the same original issue.
issues = deduplicateIssues(issues);

issues.sort(
  (a, b) => issueRowPriority(b) - issueRowPriority(a)
);

      return {
        batchId: batch?.batchId,
        batchStatus: batch?.status,
        totalRows: scoped.records.length,
        flaggedCount: scoped.records.filter(
          (r) =>
            r.status === "ACTION_REQUIRED" ||
            r.status === "PENDING_REVIEW"
        ).length,
        readyCount: scoped.records.filter(
          (r) => r.status === "READY_TO_ACCEPT"
        ).length,
        acceptedCount: scoped.records.filter(
          (r) => r.status === "ACCEPTED"
        ).length,
        unresolvedIssueCount,
        resolvedIssueCount,
        records,
        issues
      };
    },

    // Save corrected fields without revalidation
    async saveRecordDraft(batchId, recordId, updatedFields, issueId) {
      await new Promise((res) => setTimeout(res, 120));

      const located = locateEditableRecord(batchId, recordId);
      const { batch, recordIndex, currentRecord } = located;

      const now = new Date().toISOString();
      const ledgerRecord = ensureIssueLedger(currentRecord);

      const next = {
        ...currentRecord,
        ...sanitizeDraftFields(currentRecord, updatedFields),
        lastCorrectedAt: now,
        issueLedger: (ledgerRecord.issueLedger || []).map((issue) => ({
          ...issue,
          history: [
            ...(issue.history || []),
            {
              at: now,
              action: "CORRECTED",
              details:
                "Fields saved without revalidation. Issue remains open until the rule passes."
            }
          ]
        }))
      };

      batch.records[recordIndex] = next;
      saveBatch(batch);

      emitNotification({
        id: `NOTICE-DRAFT-${batch.batchId}-${recordId}`,
        audience: "COLLEGE",
        institutionId: batch.institutionId,
        institutionName: batch.institutionName,
        category: "INSTITUTION",
        title: "Record saved pending revalidation",
        body: `${
          next.studentName || "Record"
        } was saved. The issue stays unresolved until revalidation passes.`,
        href: `/college/workbench?view=unresolved&batch=${encodeURIComponent(
          batch.batchId
        )}&issue=${encodeURIComponent(issueId || next.issueId || "")}`,
        recordId,
        issueId: issueId || next.issueId
      });

      return {
        success: true,
        record: next,
        validationPassed: false
      };
    },

    // Fix and Revalidate a record
    async fixAndRevalidateRecord(batchId, recordId, updatedFields) {
      await new Promise((res) => setTimeout(res, 250));

      const located = locateEditableRecord(batchId, recordId);
      const { batch, recordIndex, currentRecord } = located;

      const outcome = finalizeValidatedRecord(
        currentRecord,
        applyValidationChecks(
          currentRecord,
          batch.records,
          updatedFields,
          batch
        ),
        updatedFields
      );

      const {
        validationPassed,
        newStatus,
        newStudentId,
        updatedRecord
      } = outcome;

      batch.records[recordIndex] = updatedRecord;

      const remainingFlagged = batch.records.filter(
        (r) =>
          r.status === "ACTION_REQUIRED" ||
          r.status === "PENDING_REVIEW"
      ).length;

      const readyCount = batch.records.filter(
        (r) => r.status === "READY_TO_ACCEPT"
      ).length;

      const acceptedCount = batch.records.filter(
        (r) => r.status === "ACCEPTED"
      ).length;

      batch.flaggedRowsCount = remainingFlagged;
      batch.readyToAcceptCount = readyCount;
      batch.acceptedCount = acceptedCount;

      batch.status =
        remainingFlagged === 0
          ? readyCount > 0
            ? "READY_TO_ACCEPT"
            : "ACCEPTED"
          : "ACTION_REQUIRED";

      saveBatch(batch);

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
          : `Record remains unresolved (${newStatus}): ${updatedRecord.reason}`,
        severity: validationPassed ? "INFO" : "WARNING"
      });

      logApaarCheckRun(currentUser, batch, [updatedRecord]);

      notifyValidationOutcome(batch, [updatedRecord], {
        revalidation: true
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
    async acceptBatchRecords(batchId) {
      await new Promise((res) => setTimeout(res, 200));

      const currentUser = getCurrentUser();
      const scoped = collectScopedRecords(currentUser, batchId);

      const batch = scoped.batches.find(
        (item) => item.batchId === batchId
      ) || scoped.primaryBatch;

      if (!batch) {
        throw new Error(`Batch not found: ${batchId}`);
      }

      if (
        currentUser?.role === "COLLEGE" &&
        batch.institutionId !== currentUser.id
      ) {
        throw new Error(
          "Access Denied: You can only accept records for your own institution."
        );
      }

      const existingReferences = new Set(
        Object.values(getStoredBatches()).flatMap((storedBatch) =>
          (storedBatch.records || [])
            .map((record) => record.recordReference)
            .filter(Boolean)
        )
      );

      let newlyAcceptedCount = 0;

      batch.records = batch.records.map((r) => {
        if (r.status !== "READY_TO_ACCEPT") {
          return r;
        }

        newlyAcceptedCount++;

        const recordReference =
          r.recordReference ||
          generateRecordReference(existingReferences);

        existingReferences.add(recordReference);

        return {
          ...r,
          recordReference,
          consentForExternalVerification:
            r.consentForExternalVerification ?? true,
          revoked: r.revoked ?? false,
          status: "ACCEPTED",
          acceptedAt: new Date().toISOString(),
          reason:
            "Institutional acceptance confirmed: all automated system checks passed.",
          requiredAction:
            "Stored in central student enrolment repository. Ready for verification.",
          owner: "Central Repository"
        };
      });

      const remainingFlagged = batch.records.filter(
        (r) =>
          r.status === "ACTION_REQUIRED" ||
          r.status === "PENDING_REVIEW"
      ).length;

      const readyCount = batch.records.filter(
        (r) => r.status === "READY_TO_ACCEPT"
      ).length;

      const totalAccepted = batch.records.filter(
        (r) => r.status === "ACCEPTED"
      ).length;

      batch.flaggedRowsCount = remainingFlagged;
      batch.readyToAcceptCount = readyCount;
      batch.acceptedCount = totalAccepted;
      batch.actualEnrolment = totalAccepted;

      batch.status =
        remainingFlagged === 0
          ? "ACCEPTED"
          : "ACTION_REQUIRED";

      for (const record of batch.records.filter(
        (item) => item.status === "ACCEPTED"
      )) {
        record.verificationVersion = 1;
        record.verificationDigest =
          await createVerificationDigest(record);
      }

      saveBatch(batch);

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

    // College Dashboard Data
    async getDashboardStats() {
      await new Promise((res) => setTimeout(res, 80));

      const currentUser = getCurrentUser();
      const ownId = currentUser?.id || "INST-001";

      const master =
        APPROVAL_MASTER.institutions.find(
          (item) => item.id === ownId
        ) || APPROVAL_MASTER.institutions[0];

      const demoInst = getInstitutionMaster(ownId);
      const scoped = collectScopedRecords(currentUser);
      const records = scoped.records;

      const batch = scoped.primaryBatch || getActiveBatch();

      const approvedIntake = master.programmes.reduce(
        (sum, programme) => sum + programme.approvedIntake,
        0
      );

      const acceptedCount = records.filter(
        (r) => r.status === "ACCEPTED"
      ).length;

      const readyCount = records.filter(
        (r) => r.status === "READY_TO_ACCEPT"
      ).length;

      const calculatedOpenAnomalies = records.filter(
        (r) =>
          r.status === "ACTION_REQUIRED" ||
          r.status === "PENDING_REVIEW"
      ).length;
      const openAnomalies = ownId === "INST-001" ? 7 : calculatedOpenAnomalies;

      const overdueAnomalies = records.filter(
        (r) => r.isOverdue
      ).length;

      const escalatedAnomalies = records.filter(
        (r) => r.isEscalated
      ).length;

      const programmes = master.programmes.map((programme) => {
        const match = (r) =>
          r.programmeCode === programme.code ||
          String(r.programme || "")
            .toLowerCase()
            .includes(programme.name.split(" ")[0].toLowerCase());

        return {
          code: programme.code,
          name: programme.name,
          degree: programme.degree,
          year: APPROVAL_MASTER.academicYear,
          approvedIntake: programme.approvedIntake,
          acceptedEnrolment: records.filter(
            (r) => r.status === "ACCEPTED" && match(r)
          ).length,
          readyToAccept: records.filter(
            (r) => r.status === "READY_TO_ACCEPT" && match(r)
          ).length,
          anomaliesCount: records.filter(
            (r) =>
              (r.status === "ACTION_REQUIRED" ||
                r.status === "PENDING_REVIEW") &&
              match(r)
          ).length
        };
      });

      programmes.forEach((p) => {
        p.utilisation =
          p.approvedIntake > 0
            ? Math.round(
                (p.acceptedEnrolment / p.approvedIntake) * 100
              )
            : 0;

        p.isExceeded =
          p.acceptedEnrolment > p.approvedIntake;
      });

      const categoryCounts = {
        GENERAL: records.filter(
          (r) =>
            r.category === "GENERAL" &&
            r.status === "ACCEPTED"
        ).length,
        OBC: records.filter(
          (r) =>
            r.category === "OBC" &&
            r.status === "ACCEPTED"
        ).length,
        SC: records.filter(
          (r) =>
            r.category === "SC" &&
            r.status === "ACCEPTED"
        ).length,
        ST: records.filter(
          (r) =>
            r.category === "ST" &&
            r.status === "ACCEPTED"
        ).length,
        EWS: records.filter(
          (r) =>
            r.category === "EWS" &&
            r.status === "ACCEPTED"
        ).length,
        TFWS: records.filter(
          (r) =>
            r.category === "TFWS" &&
            r.status === "ACCEPTED"
        ).length,
        NRI_FN: records.filter(
          (r) =>
            r.category === "NRI_FN" &&
            r.status === "ACCEPTED"
        ).length,
        NRI_FN_LIMIT:
          master.programmes[0]?.categoryLimits?.NRI_FN || 5
      };

      const overallUtilisation =
        approvedIntake > 0
          ? Math.round(
              (acceptedCount / approvedIntake) * 100
            )
          : 0;

      return {
        institutionName:
          currentUser?.institutionName || demoInst.name,
        institutionId: ownId,
        aicteId: currentUser?.aicteId || demoInst.aicteId,
        approvedIntake,
        acceptedEnrolment: acceptedCount,
        actualEnrolment: acceptedCount,
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

    // Export Intake Report (CSV)
    async exportIntakeCSV(requestedInstitutionId = "INST-001") {
      const currentUser = getCurrentUser();

      if (
        currentUser?.role === "COLLEGE" &&
        requestedInstitutionId !== currentUser.id
      ) {
        logAuditEvent({
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorEmail: currentUser.email,
          actionType: "UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT",
          resourceType: "REPORT",
          resourceId: requestedInstitutionId,
          details: `Access Denied: ${currentUser.id} attempted unauthorized download of ${requestedInstitutionId} intake data.`,
          changeSummary:
            "Request blocked by institutional data isolation policy",
          severity: "CRITICAL"
        });

        throw new Error(
          "Access Denied: Institutions are strictly restricted from downloading other colleges' intake data."
        );
      }

      const stats = await this.getDashboardStats();

      const headers =
        "Institution,Programme,Year,Approved Intake,Actual Enrolment,Accepted Enrolment,Utilisation %,Category Counts,Supernumerary Seats\n";

      const rows = stats.programmes
        .map(
          (programme) =>
            `"${stats.institutionName}","${programme.name}","${programme.year}",${programme.approvedIntake},${programme.acceptedEnrolment},${programme.acceptedEnrolment},"${programme.utilisation}%","GEN/OBC/SC/ST/EWS/NRI",${programme.code === "AIDS" ? 3 : 5}`
        )
        .join("\n");

      return headers + rows;
    },

    // Export Anomaly Report (CSV)
    async exportAnomaliesCSV(requestedInstitutionId = "INST-001") {
      const currentUser = getCurrentUser();

      if (
        currentUser?.role === "COLLEGE" &&
        requestedInstitutionId !== currentUser.id
      ) {
        logAuditEvent({
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorEmail: currentUser.email,
          actionType: "UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT",
          resourceType: "REPORT",
          resourceId: requestedInstitutionId,
          details: `Access Denied: PICT user attempted unauthorized download of ${requestedInstitutionId} anomaly logs.`,
          changeSummary:
            "Request blocked by institutional data isolation policy",
          severity: "CRITICAL"
        });

        throw new Error(
          "Access Denied: Institutions are strictly restricted from downloading other colleges' anomaly reports."
        );
      }

      const scoped = collectScopedRecords(currentUser);
      const batch = scoped.primaryBatch;

      if (!batch) {
        return "Batch,Row,Student Name,PRN,APAAR ID,Issue Type,Severity,Reason,Owner,Status,Due Date\n";
      }

      const records = batch.records || [];

      const headers =
        "Batch,Row,Student Name,PRN,APAAR ID,Issue Type,Severity,Reason,Owner,Status,Due Date\n";

      const anomalyRows = records
        .filter(
          (r) =>
            r.status === "ACTION_REQUIRED" ||
            r.status === "PENDING_REVIEW"
        )
        .map((r, idx) =>
          [
            batch.batchId,
            idx + 1,
            r.studentName,
            r.studentId,
            r.apaarId || "MISSING",
            r.issueType,
            r.severity,
            r.reason,
            r.owner,
            r.status,
            r.dueDate
          ]
            .map((value) =>
              `"${String(value ?? "").replaceAll('"', '""')}"`
            )
            .join(",")
        )
        .join("\n");

      return headers + anomalyRows;
    },

    async exportCompleteCSV(requestedInstitutionId = "INST-001") {
      const currentUser = getCurrentUser();

      if (
        currentUser?.role === "COLLEGE" &&
        requestedInstitutionId !== currentUser.id
      ) {
        throw new Error(
          "Access Denied: Institutions are restricted to their own complete report."
        );
      }

      const scoped = collectScopedRecords(currentUser);
      const batch = scoped.primaryBatch;

      if (!batch) {
        return "Batch,Row,Student Name,PRN,APAAR ID,Programme,Year,Issue Type,Severity,Reason,Owner,Status,Issue Status,Due Date\n";
      }

      const headers =
        "Batch,Row,Student Name,PRN,APAAR ID,Programme,Year,Issue Type,Severity,Reason,Owner,Status,Issue Status,Due Date\n";

      const rows = (batch.records || [])
        .map((record, index) =>
          [
            batch.batchId,
            index + 1,
            record.studentName,
            record.studentId,
            record.apaarId || "MISSING",
            record.programme,
            record.yearOfStudy,
            record.issueType || "",
            record.severity || "",
            record.reason || "",
            record.owner || "",
            record.status,
            record.issueStatus || "",
            record.dueDate || ""
          ]
            .map((value) =>
              `"${String(value ?? "").replaceAll('"', '""')}"`
            )
            .join(",")
        )
        .join("\n");

      return headers + rows;
    },

    // ─── Staging helpers ───────────────────────────────────────────────

    async addStudentsToStaging(
      studentRecords,
      source = "MANUAL_ENTRY"
    ) {
      await new Promise((res) => setTimeout(res, 150));

      const currentUser = getCurrentUser();
      const now = new Date().toISOString();

      const ownId = currentUser?.id || "INST-001";
      const ownName =
        currentUser?.institutionName ||
        "Pune Institute of Computer Technology (PICT)";

      const batch = getOrCreateCollegeWorkingBatch(
        currentUser,
        source
      );

      const foreign = studentRecords.find(
        (s) => s.institutionId && s.institutionId !== ownId
      );

      if (foreign) {
        logAuditEvent({
          actorName: currentUser?.name,
          actorRole: currentUser?.role,
          actorEmail: currentUser?.email,
          actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
          resourceType: "STAGING_AREA",
          resourceId: foreign.institutionId,
          details: `Institution ${ownId} attempted to add records for ${foreign.institutionId}.`,
          changeSummary:
            "Blocked by institution isolation policy",
          severity: "CRITICAL"
        });

        throw new Error(
          "Access Denied: You can only add records for your own institution."
        );
      }

      const newRecords = studentRecords.map((s, i) => {
        const id = s.id || `MANUAL-${Date.now()}-${i}`;
        const stagedIssues = Array.isArray(s.issues) ? s.issues : [];
        const firstIssue = stagedIssues[0];

        const issueLedger = stagedIssues
          .filter((issue) => issue?.issueType)
          .map((issue) => makeIssueEntry(id, issue, now));

        const category = s.category || s.seatCategory || "";

        return {
          id,
          source,
          institutionId: ownId,
          institutionName: ownName,

          studentId: String(s.studentId || s.prn || "").trim(),
          studentName: String(
            s.studentName || s.name || ""
          ).trim(),

          apaarId: normalizeSyntheticApaar(s.apaarId || ""),

          programme: String(s.programme || "").trim(),
          programmeCode: _mapProgrammeCode(s.programme || ""),

          yearOfStudy: s.yearOfStudy || "",
          category,

          ociStatus:
            s.ociStatus ||
            (category === "NRI_FN"
              ? "NOT_RECORDED"
              : "NOT_APPLICABLE"),

          foreignNationalStatus:
            s.foreignNationalStatus ||
            (category === "NRI_FN"
              ? "NOT_RECORDED"
              : "NOT_APPLICABLE"),

          nriStatus: s.nriStatus || "",

          supernumerarySeats: Number(
            s.supernumerarySeats ||
              (category === "NRI_FN" ? 1 : 0)
          ),

          gender: s.gender || "",
          dob: s.dob || s.dateOfBirth || "",
          admissionDate: s.admissionDate || now.slice(0, 10),
          admissionStatus: s.admissionStatus,

          extraFields: s.extraFields || {},

          status: s.status || "UPLOADED",

          issueType: firstIssue?.issueType || null,
          issueTitle: firstIssue?.issueType || null,
          issueStatus: issueLedger.length ? "OPEN" : "PENDING",
          issueId: issueLedger[0]?.issueId || null,
          flaggedAt: issueLedger[0]?.flaggedAt || null,

          severity: firstIssue?.severity || null,
          reason: firstIssue?.reason || "Awaiting validation.",
          evidence: firstIssue?.evidence || "",
          owner:
            firstIssue?.responsibleParty ||
            "Institution Data Officer",

          requiredAction:
            firstIssue?.requiredAction ||
            "Review this student entry in the Issue Workbench.",

          dueDate: firstIssue?.dueDate || "",
          dueDays: null,
          dueDateLabel: "",
          isOverdue: false,
          isEscalated: false,

          validationNote: "format-checked, not identity-verified",
          addedAt: now,
          issueLedger
        };
      });

      batch.records = [
        ...(batch.records || []),
        ...newRecords
      ];

      batch.totalRows =
        (batch.totalRows || 0) + newRecords.length;

      saveBatch(batch);
      await collegeApi.validateStagedRecords(
        newRecords.map((record) => record.id),
        batch.batchId
      );

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

      emitNotification({
        id: `NOTICE-SUBMIT-${batch.batchId}`,
        audience: "COLLEGE",
        institutionId: ownId,
        institutionName: ownName,
        category: "INSTITUTION",
        title: "Dataset submitted",
        body: `${newRecords.length} record(s) staged from ${
          source === "MANUAL_ENTRY" ? "manual entry" : "file upload"
        } for ${ownName}.`,
        href: `/college/workbench?batch=${encodeURIComponent(batch.batchId)}`,
        batchId: batch.batchId
      });

      emitNotification({
        id: `NOTICE-SUBMIT-AICTE-${batch.batchId}`,
        audience: "AICTE",
        institutionId: ownId,
        institutionName: ownName,
        category: "NATIONAL",
        title: "Institution dataset submitted",
        body: `${ownName} submitted ${newRecords.length} student record(s) (${batch.batchId}).`,
        href: "/aicte/dashboard"
      });

      return {
        success: true,
        addedCount: newRecords.length,
        batchId: batch.batchId
      };
    },

    async getStagedRecords({
      source = "ALL",
      status = "ALL",
      search = ""
    } = {}) {
      await new Promise((res) => setTimeout(res, 80));

      const currentUser = getCurrentUser();
      const scoped = collectScopedRecords(currentUser);
      const batch = scoped.primaryBatch;

      if (!batch) {
        return {
          batchId: null,
          totalRows: 0,
          records: []
        };
      }

      let records = [...(batch.records || [])];

      if (source !== "ALL") {
        records = records.filter(
          (r) => (r.source || "BULK_UPLOAD") === source
        );
      }

      if (status !== "ALL") {
        records = records.filter((r) => r.status === status);
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();

        records = records.filter((r) =>
          [
            r.studentId,
            r.studentName,
            r.apaarId
          ].some((value) =>
            String(value || "").toLowerCase().includes(q)
          )
        );
      }

      return {
        batchId: batch.batchId,
        totalRows: batch.totalRows,
        records
      };
    },

    // Validate staged records
    async validateStagedRecords(recordIds = null, batchId = null) {
      await new Promise((res) => setTimeout(res, 300));

      const currentUser = getCurrentUser();
      const scoped = collectScopedRecords(currentUser, batchId);
      const batch = scoped.primaryBatch;

      if (!batch) {
        throw new Error("No active batch found to validate.");
      }

      if (
        currentUser?.role === "COLLEGE" &&
        batch.institutionId &&
        currentUser.id !== batch.institutionId
      ) {
        logAuditEvent({
          actorName: currentUser.name,
          actorRole: currentUser.role,
          actorEmail: currentUser.email,
          actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
          resourceType: "BATCH",
          resourceId: batch.institutionId,
          details: `Institution ${currentUser.id} attempted to validate records for ${batch.institutionId}.`,
          changeSummary:
            "Blocked by institution isolation policy",
          severity: "CRITICAL"
        });

        throw new Error(
          "Access Denied: You can only validate records for your own institution."
        );
      }

      const allRecords = batch.records || [];

      const toValidateIds = new Set(
        recordIds && recordIds.length > 0
          ? recordIds
          : allRecords
              .filter((r) => r.status !== "ACCEPTED")
              .map((r) => r.id)
      );

      const toValidate = allRecords.filter((r) =>
        toValidateIds.has(r.id)
      );

      let passed = 0;
      let flagged = 0;
      let blocking = 0;
      let warnings = 0;

      const updatedRecords = allRecords.map((record) => {
        if (!toValidateIds.has(record.id)) {
          return record;
        }

        const result = finalizeValidatedRecord(
          record,
          applyValidationChecks(
            record,
            allRecords,
            {},
            batch
          ),
          {}
        );

        if (result.validationPassed) {
          passed++;
        } else {
          flagged++;

          if (result.newStatus === "PENDING_REVIEW") {
            warnings++;
          } else {
            blocking++;
          }
        }

        return result.updatedRecord;
      });

      batch.records = updatedRecords;

      batch.flaggedRowsCount = updatedRecords.filter(
        (r) =>
          r.status === "ACTION_REQUIRED" ||
          r.status === "PENDING_REVIEW"
      ).length;

      batch.readyToAcceptCount = updatedRecords.filter(
        (r) => r.status === "READY_TO_ACCEPT"
      ).length;

      batch.acceptedCount = updatedRecords.filter(
        (r) => r.status === "ACCEPTED"
      ).length;

      batch.actualEnrolment = batch.acceptedCount;

      batch.status =
        batch.flaggedRowsCount > 0
          ? "ACTION_REQUIRED"
          : batch.readyToAcceptCount > 0
            ? "READY_TO_ACCEPT"
            : "ACCEPTED";

      saveBatch(batch);

      const validatedRecords = batch.records.filter((r) =>
        toValidateIds.has(r.id)
      );

      logApaarCheckRun(
        currentUser,
        batch,
        validatedRecords
      );

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

      notifyValidationOutcome(batch, validatedRecords, {
        revalidation: false
      });

      return {
        success: true,
        validated: toValidate.length,
        passed,
        flagged,
        blocking,
        warnings,
        records: validatedRecords
      };
    },

    async getNotifications() {
      await new Promise((res) => setTimeout(res, 40));
      return buildPortalNotifications();
    },

    async markNotificationRead(noticeId) {
      await new Promise((res) => setTimeout(res, 20));
      markStoredNotificationRead(noticeId);
      return buildPortalNotifications();
    }
  };

  // ─── Private helpers ───────────────────────────────────────────────────────

  function locateEditableRecord(batchId, recordId) {
    const storedBatches = getStoredBatches();

    const batch = Object.values(storedBatches || {}).find(
      (item) => item.batchId === batchId
    );

    if (!batch) {
      throw new Error(`Batch not found: ${batchId}`);
    }

    const currentUser = getCurrentUser();

    if (
      currentUser?.role === "COLLEGE" &&
      batch.institutionId !== currentUser.id
    ) {
      throw new Error(
        "Access Denied: You can only edit your own institution's records."
      );
    }

    // Find the record using either its internal ID or its record reference.
    const matchingRecords = (batch.records || [])
      .map((record, index) => ({
        record,
        index
      }))
      .filter(
        ({ record }) =>
          String(record.id) === String(recordId) ||
          String(record.recordReference) === String(recordId)
      );

    if (matchingRecords.length === 0) {
      console.error("Record lookup failed:", {
        batchId,
        requestedRecordId: recordId,
        availableRecords: (batch.records || []).map((record) => ({
          id: record.id,
          recordReference: record.recordReference,
          studentName: record.studentName
        }))
      });

      throw new Error(`Record not found: ${recordId}`);
    }

    if (matchingRecords.length > 1) {
      throw new Error(`Ambiguous record identifier: ${recordId}`);
    }

    const { record: currentRecord, index: recordIndex } =
      matchingRecords[0];

    return {
      batch,
      recordIndex,
      currentRecord
    };
  }

  function collectScopedRecords(currentUser, requestedBatchId) {
    const storedBatches = getStoredBatches();
    const allBatches = Object.values(storedBatches || {});

    const institutionId = currentUser?.id || "INST-001";

    let batches =
      currentUser?.role === "COLLEGE"
        ? allBatches.filter(
            (batch) => batch.institutionId === institutionId
          )
        : allBatches;

    if (requestedBatchId) {
      batches = batches.filter(
        (batch) => batch.batchId === requestedBatchId
      );
    }

    const primaryBatch =
      batches.length > 0
        ? [...batches].sort(
            (a, b) =>
              new Date(b.uploadedAt || 0) -
              new Date(a.uploadedAt || 0)
          )[0]
        : null;

    const records = batches.flatMap((batch) =>
      (batch.records || []).map((record) =>
        ensureIssueLedger({
          ...record,
          batchId: batch.batchId,
          institutionId: batch.institutionId,
          institutionName: batch.institutionName
        })
      )
    );

    return {
      batches,
      primaryBatch,
      records
    };
  }

  const SEEDED_PRESET_BATCH_IDS = new Set([
    FAULTY_MOCK_BATCH.batchId,
    CLEAN_MOCK_BATCH.batchId,
    COEP_MOCK_BATCH.batchId,
    VJTI_MOCK_BATCH.batchId
  ]);

  export function stableIssueId(recordId, issueType) {
    return `ISS-${recordId}-${issueType}`;
  }

  function isOpenIssueStatus(status) {
    return (
      status === "OPEN" ||
      status === "OVERDUE" ||
      status === "ESCALATED"
    );
  }

  function issueTitleFor(issueType) {
    const titles = {
      MISSING_APAAR_ID: "Missing APAAR ID",
      WRONG_FORMAT: "Invalid APAAR Format",
      DUPLICATE_STUDENT_ID: "Duplicate Student ID",
      DUPLICATE_IN_BATCH: "Duplicate APAAR in Batch",
      DUPLICATE_IN_REPOSITORY: "Duplicate APAAR in Repository",
      CROSS_INSTITUTION_CONFLICT: "Cross-Institution Duplicate",
      INTAKE_EXCEEDED: "Approved Intake Exceeded",
      SEAT_CATEGORY_LIMIT: "NRI / FN Quota Exceeded",
      COURSE_MAPPING_ERROR: "Unapproved Course Mapping",
      APAAR_AUTHENTICITY_REVIEW: "APAAR Authenticity Review",
      MISSING_MANDATORY_FIELD: "Missing Mandatory Field",
      INVALID_DOB: "Invalid Date of Birth",
      INVALID_YEAR_OF_STUDY: "Invalid Year of Study",
      INVALID_ACADEMIC_YEAR: "Invalid Academic Year",
      CATEGORY_MISMATCH: "Student Category Mismatch",
      INVALID_CATEGORY: "Invalid Seat Category",
      INVALID_ADMISSION_STATUS: "Invalid Admission Status",
      DUPLICATE_ACROSS_BATCHES: "Duplicate Across Upload Batches",
      NRI_FN_INCONSISTENCY: "NRI / OCI / FN Inconsistency"
    };

    return titles[issueType] || issueType;
  }

  function hasOpenIssue(record, issueType) {
    if (
      Array.isArray(record.issueLedger) &&
      record.issueLedger.length
    ) {
      return record.issueLedger.some(
        (issue) =>
          issue.issueType === issueType &&
          isOpenIssueStatus(issue.issueStatus)
      );
    }

    return (
      record.issueType === issueType &&
      isOpenIssueStatus(record.issueStatus)
    );
  }

  function makeIssueEntry(recordId, issue, now) {
    const issueType = issue.issueType;

    return {
      issueId:
        issue.issueId || stableIssueId(recordId, issueType),
      issueType,
      issueTitle:
        issue.issueTitle || issueTitleFor(issueType),
      issueStatus: issue.issueStatus || "OPEN",
      severity: issue.severity || "HIGH",
      reason: issue.reason || "",
      evidence: issue.evidence || "",
      owner:
        issue.responsibleParty ||
        issue.owner ||
        "Institution Data Officer",
      requiredAction: issue.requiredAction || "",
      dueDate: issue.dueDate || "",
      flaggedAt: issue.flaggedAt || now,
      resolvedAt: issue.resolvedAt || null,
      fixApplied: issue.fixApplied || "",
      history:
        issue.history || [
          {
            at: now,
            action: "FLAGGED",
            details:
              issue.reason || "Issue flagged by validation."
          }
        ]
    };
  }

  function ensureIssueLedger(record) {
    const hasLegacyAdmissionIssue =
      record.issueType === "INVALID_ADMISSION_STATUS" && !record.dob;
    const normalizedRecord = hasLegacyAdmissionIssue
      ? {
          ...record,
          issueType: "MISSING_MANDATORY_FIELD",
          issueTitle: "Missing Date of Birth",
          reason: "Date of birth is missing.",
          evidence: "Field 'dob' is empty.",
          requiredAction: "Provide the student's date of birth.",
          severity: "HIGH"
        }
      : record;

    if (Array.isArray(record.issueLedger)) {
      const ledgerById = new Map();
      for (const issue of record.issueLedger) {
        const normalizedIssue = hasLegacyAdmissionIssue &&
          issue.issueType === "INVALID_ADMISSION_STATUS"
          ? {
              ...issue,
              issueId: stableIssueId(record.id, "MISSING_MANDATORY_FIELD"),
              issueType: "MISSING_MANDATORY_FIELD",
              issueTitle: "Missing Date of Birth",
              reason: "Date of birth is missing.",
              evidence: "Field 'dob' is empty.",
              requiredAction: "Provide the student's date of birth.",
              severity: "HIGH"
            }
          : issue;
        const key = normalizedIssue.issueId || `${record.id}-${normalizedIssue.issueType}`;
        const existing = ledgerById.get(key);
        ledgerById.set(key, existing
          ? {
              ...existing,
              ...normalizedIssue,
              history: [...(existing.history || []), ...(normalizedIssue.history || [])]
            }
          : normalizedIssue);
      }
      return {
        ...normalizedRecord,
        issueLedger: [...ledgerById.values()]
      };
    }

    if (!normalizedRecord.issueType || normalizedRecord.issueStatus === "PENDING") {
      return {
        ...normalizedRecord,
        issueLedger: []
      };
    }

    const flaggedAt =
      normalizedRecord.flaggedAt ||
      normalizedRecord.addedAt ||
      normalizedRecord.lastRevalidatedAt ||
      new Date().toISOString();

    const entry = makeIssueEntry(
      normalizedRecord.id,
      {
        ...normalizedRecord,
        flaggedAt
      },
      flaggedAt
    );

    if (normalizedRecord.issueStatus === "RESOLVED") {
      entry.issueStatus = "RESOLVED";
      entry.resolvedAt =
        normalizedRecord.resolvedAt ||
        normalizedRecord.lastRevalidatedAt ||
        flaggedAt;
    }

    return {
      ...normalizedRecord,
      issueId: entry.issueId,
      flaggedAt,
      issueLedger: [entry]
    };
  }

  function flattenRecordIssues(record) {
    const normalized = ensureIssueLedger(record);

    return (normalized.issueLedger || []).map((issue) => ({
      ...normalized,
      ...issue,
      id: normalized.id,
      recordId: normalized.id,
      issueTitle:
        issue.issueTitle || issueTitleFor(issue.issueType),
      status: normalized.status
    }));
  }

  function issueRowPriority(issue) {
    if (
      isOpenIssueStatus(issue.issueStatus) &&
      issue.severity === "HIGH"
    ) {
      return issue.isOverdue ? 100 : 90;
    }

    if (
      issue.isOverdue ||
      issue.isEscalated ||
      issue.issueStatus === "ESCALATED"
    ) {
      return 80;
    }

    if (isOpenIssueStatus(issue.issueStatus)) {
      return 70;
    }

    if (issue.issueStatus === "RESOLVED") {
      return 20;
    }

    return 0;
  }

  function summarizeFix(updatedFields = {}, issueType, currentRecord = {}) {
    if (!updatedFields) return "";

    const fieldLabels = [
      ["apaarId", "APAAR ID"],
      ["studentId", "PRN"],
      ["studentName", "Student name"],
      ["programme", "Programme"],
      ["category", "Category"],
      ["dob", "Date of birth"],
      ["yearOfStudy", "Year of study"],
      ["ociStatus", "OCI status"],
      ["foreignNationalStatus", "Foreign national status"],
      ["nriStatus", "NRI status"],
      ["supernumerarySeats", "Supernumerary seats"],
      ["admissionStatus", "Admission status"],
      ["transferProof", "Transfer proof"]
    ];
    const parts = fieldLabels.flatMap(([field, label]) => {
      if (updatedFields[field] === undefined) return [];
      const previousValue = currentRecord[field] ??
        (field === "dob" ? currentRecord.dateOfBirth : undefined);
      if (String(updatedFields[field]) === String(previousValue ?? "")) return [];
      return [`${label} updated to ${updatedFields[field] || "cleared"}`];
    });

    if (updatedFields.supernumeraryApproval) {
      parts.push("Supernumerary approval recorded");
    }

    if (!parts.length) {
      return issueType
        ? `Revalidated ${issueType}`
        : "Fields resubmitted for revalidation";
    }

    return parts.join("; ");
  }

  // Each check updates its matching issue independently, so passing checks can
  // resolve their issues while other failed checks remain open.
  function applyIssueLifecycle(
    currentRecord,
    engineFields,
    validationPassed,
    updatedFields = {}
  ) {
    const now = new Date().toISOString();
    const record = ensureIssueLedger(currentRecord);

    let ledger = [...(record.issueLedger || [])];

    const historyEntry = (action, details, issueType) => ({
      at: now,
      action,
      details,
      fixAttempt: summarizeFix(updatedFields, issueType, currentRecord)
    });

    const validationIssues = engineFields.validationIssues ||
      (validationPassed || !engineFields.issueType
        ? []
        : [engineFields]);
    const failuresByType = new Map(
      validationIssues.map((issue) => [issue.type || issue.issueType, issue])
    );

    ledger = ledger.map((issue) => {
      const failure = failuresByType.get(issue.issueType);
      if (failure) {
        const reopened = !isOpenIssueStatus(issue.issueStatus);
        return {
          ...issue,
          issueStatus: failure.issueStatus || "OPEN",
          severity: failure.severity || issue.severity,
          reason: failure.reason || issue.reason,
          evidence: failure.evidence || issue.evidence,
          owner: failure.owner || issue.owner,
          requiredAction: failure.action || failure.requiredAction || issue.requiredAction,
          resolvedAt: null,
          fixApplied: reopened
            ? ""
            : summarizeFix(updatedFields, issue.issueType, currentRecord) || issue.fixApplied,
          history: [
            ...(issue.history || []),
            historyEntry(
              reopened ? "REOPENED" : "REVALIDATED",
              failure.reason || issue.reason,
              issue.issueType
            )
          ]
        };
      }

      if (!isOpenIssueStatus(issue.issueStatus)) {
        return issue;
      }

      return {
        ...issue,
        issueStatus: "RESOLVED",
        resolvedAt: now,
        fixApplied:
          summarizeFix(updatedFields, issue.issueType, currentRecord) || issue.fixApplied,
        history: [
          ...(issue.history || []),
          historyEntry(
            "RESOLVED",
            engineFields.reason || "Validation checks passed.",
            issue.issueType
          )
        ]
      };
    });

    for (const [issueType, failure] of failuresByType) {
      if (ledger.some((issue) => issue.issueType === issueType)) {
        continue;
      }

      ledger.push(
        makeIssueEntry(
          record.id,
          {
            ...failure,
            issueType,
            requiredAction: failure.action || failure.requiredAction,
            responsibleParty: failure.owner || failure.responsibleParty,
            issueTitle: issueTitleFor(issueType),
            flaggedAt: now,
            history: [historyEntry("FLAGGED", failure.reason, issueType)]
          },
          now
        )
      );
    }

    const latestOpen =
      [...ledger].reverse().find((issue) =>
        isOpenIssueStatus(issue.issueStatus)
      ) || null;
    const currentType = engineFields.issueType;
    const current =
      ledger.find((issue) => issue.issueType === currentType) ||
      latestOpen ||
      [...ledger].reverse().find((issue) => issue.issueStatus === "RESOLVED") ||
      null;

    return {
      ...engineFields,
      issueType: current?.issueStatus === "RESOLVED"
        ? null
        : current?.issueType || currentType,
      issueTitle:
        current?.issueStatus === "RESOLVED"
          ? null
          : current?.issueTitle || issueTitleFor(currentType),
      issueStatus: latestOpen?.issueStatus || current?.issueStatus || "RESOLVED",
      issueId:
        current?.issueId ||
        (currentType ? stableIssueId(record.id, currentType) : null),
      flaggedAt: current?.flaggedAt || record.flaggedAt || null,
      resolvedAt: current?.issueStatus === "RESOLVED"
        ? current.resolvedAt || now
        : null,
      fixApplied: current?.fixApplied || "",
      issueHistory: current?.history || [],
      issueLedger: ledger
    };
  }

  function sanitizeDraftFields(currentRecord, updatedFields = {}) {
    const allowedFields = [
      "studentId",
      "studentName",
      "apaarId",
      "dob",
      "programme",
      "category",
      "yearOfStudy",
      "admissionStatus",
      "ociStatus",
      "foreignNationalStatus",
      "nriStatus",
      "supernumerarySeats"
    ];

    const sanitized = {};

    for (const field of allowedFields) {
      if (updatedFields[field] === undefined) {
        continue;
      }

      sanitized[field] = updatedFields[field];
    }

    if (sanitized.studentId !== undefined) {
      sanitized.studentId = String(sanitized.studentId).trim();
    }

    if (sanitized.studentName !== undefined) {
      sanitized.studentName = String(sanitized.studentName).trim();
    }

    if (sanitized.apaarId !== undefined) {
      sanitized.apaarId = normalizeSyntheticApaar(
        String(sanitized.apaarId).trim()
      );
    }

    if (sanitized.supernumerarySeats !== undefined) {
      sanitized.supernumerarySeats = Number(
        sanitized.supernumerarySeats
      );
    }

    return sanitized;
  }

  function finalizeValidatedRecord(
    currentRecord,
    outcome,
    updatedFields = {}
  ) {
    const lifecycle = applyIssueLifecycle(
      currentRecord,
      outcome.updatedRecord,
      outcome.validationPassed,
      updatedFields
    );

    const sanitizedFields = sanitizeDraftFields(
      currentRecord,
      updatedFields
    );

    return {
      ...outcome,
      updatedRecord: {
        ...currentRecord,
        ...sanitizedFields,
        ...lifecycle,

        // Explicitly preserve corrected fields after validation.
        studentName:
          sanitizedFields.studentName !== undefined
            ? sanitizedFields.studentName
            : currentRecord.studentName,

        studentId:
          sanitizedFields.studentId !== undefined
            ? sanitizedFields.studentId
            : lifecycle.studentId ?? currentRecord.studentId,

        apaarId:
          sanitizedFields.apaarId !== undefined
            ? sanitizedFields.apaarId
            : lifecycle.apaarId ?? currentRecord.apaarId,

        dob:
          sanitizedFields.dob !== undefined
            ? sanitizedFields.dob
            : lifecycle.dob ?? currentRecord.dob,

        programme:
          sanitizedFields.programme !== undefined
            ? sanitizedFields.programme
            : lifecycle.programme ?? currentRecord.programme,

        category:
          sanitizedFields.category !== undefined
            ? sanitizedFields.category
            : lifecycle.category ?? currentRecord.category,

        yearOfStudy:
          sanitizedFields.yearOfStudy !== undefined
            ? sanitizedFields.yearOfStudy
            : lifecycle.yearOfStudy ??
              currentRecord.yearOfStudy,

        admissionStatus:
          sanitizedFields.admissionStatus !== undefined
            ? sanitizedFields.admissionStatus
            : lifecycle.admissionStatus ??
              currentRecord.admissionStatus
      }
    };
  }

  function getOrCreateCollegeWorkingBatch(
    currentUser,
    source
  ) {
    const existing = getActiveBatch();
    const ownId = currentUser?.id || "INST-001";

    if (
      existing &&
      !SEEDED_PRESET_BATCH_IDS.has(existing.batchId) &&
      existing.institutionId === ownId
    ) {
      return existing;
    }

    const now = new Date().toISOString();

    const newBatch = {
      batchId: `BATCH-UPLOAD-${ownId}-${Date.now()}`,
      institutionId: ownId,
      institutionName:
        currentUser?.institutionName ||
        "Pune Institute of Computer Technology (PICT)",
      aicteId:
        currentUser?.aicteId || "AICTE-1-1029384",
      uploadedAt: now,
      academicYear: "2026-2027",
      status: "UPLOADED",
      fileName:
        source === "MANUAL_ENTRY"
          ? "Manual student entry"
          : "College_Batch_Upload.csv",
      totalRows: 0,
      flaggedRowsCount: 0,
      readyToAcceptCount: 0,
      acceptedCount: 0,
      actualEnrolment: 0,
      records: []
    };

    saveBatch(newBatch);
    setActiveBatchId(newBatch.batchId);

    return newBatch;
  }

  function buildCollegeNotifications() {
    const currentUser = getCurrentUser();
    const reads = getCollegeNoticeReads();

    const scoped = collectScopedRecords(currentUser);
    const batch = scoped.primaryBatch;

    if (!batch) {
      return {
        notices: [],
        unreadCount: 0
      };
    }

    const issues = scoped.records.flatMap((record) =>
      flattenRecordIssues(ensureIssueLedger(record))
    );

    const notices = [];

    issues
      .filter((issue) =>
        isOpenIssueStatus(issue.issueStatus)
      )
      .forEach((issue) => {
        const aicteOwned =
          issue.owner === "AICTE Central Reviewer" ||
          issue.isEscalated ||
          issue.status === "PENDING_REVIEW";

        notices.push({
          id: `NOTICE-${issue.batchId || batch.batchId}-${issue.issueId}`,
          priority: aicteOwned ? 1 : 3,
          category: aicteOwned ? "SYSTEM" : "INSTITUTION",
          title: aicteOwned
            ? `Reviewer action: ${
                issue.issueTitle || issue.issueType
              }`
            : `Institution action: ${
                issue.issueTitle || issue.issueType
              }`,
          body: `${issue.studentName} (${issue.studentId}) — ${issue.reason}`,
          institutionId: batch.institutionId,
          institutionName: batch.institutionName,
          issueId: issue.issueId,
          recordId: issue.recordId,
          href: `/college/workbench?view=unresolved&batch=${encodeURIComponent(
            issue.batchId || batch.batchId
          )}&issue=${encodeURIComponent(issue.issueId)}`,
          createdAt: issue.flaggedAt,
          synthetic: true
        });
      });

    notices.sort(
      (a, b) =>
        a.priority - b.priority ||
        String(b.createdAt).localeCompare(String(a.createdAt))
    );

    return {
      notices: notices.map((notice) => ({
        ...notice,
        read: Boolean(reads[notice.id]),
        readAt: reads[notice.id] || null
      })),
      unreadCount: notices.filter(
        (notice) => !reads[notice.id]
      ).length
    };
  }

  function buildPortalNotifications() {
    const stored = listNotificationsForUser();
    const college = buildCollegeNotifications();
    const notices = [
      ...(stored || []),
      ...(college.notices || [])
    ];

    return {
      ...college,
      notices,
      unreadCount: notices.filter((notice) => !notice.read).length
    };
  }

  // Map programme name to programme code used by dashboard.
  function _mapProgrammeCode(programme) {
    const p = String(programme || "").toLowerCase();

    if (p.includes("comp")) return "COMP";
    if (p.includes("info") || p.includes(" it") || p.startsWith("it")) {
      return "IT";
    }
    if (p.includes("entc") || p.includes("electronic")) {
      return "ENTC";
    }
    if (
      p.includes("aids") ||
      p.includes("artificial") ||
      p.includes("data science")
    ) {
      return "AIDS";
    }

    return "OTHER";
  }

  function findRepositoryApaarConflict(
    apaarId,
    currentRecord,
    currentBatch
  ) {
    const batches = getStoredBatches();

    for (const batch of Object.values(batches)) {
      for (const record of batch.records || []) {
        if (
          record.id !== currentRecord.id &&
          record.apaarId === apaarId &&
          record.status !== "REVOKED" &&
          batch.batchId !== currentBatch.batchId
        ) {
          return {
            ...record,
            institutionId: batch.institutionId,
            institutionName: batch.institutionName,
            conflictBatchId: batch.batchId
          };
        }
      }
    }

    return null;
  }

  export async function repairStoredAcceptedRecords() {
    const batches = getStoredBatches();

    const existingReferences = new Set(
      Object.values(batches).flatMap((batch) =>
        (batch.records || [])
          .map((record) => record.recordReference)
          .filter(Boolean)
      )
    );

    for (const batch of Object.values(batches)) {
      let changed = false;
      const records = [];

      for (const record of batch.records || []) {
        if (record.status !== "ACCEPTED") {
          records.push(record);
          continue;
        }

        let repaired = record;

        if (!repaired.recordReference) {
          const recordReference =
            generateRecordReference(existingReferences);

          existingReferences.add(recordReference);

          repaired = {
            ...repaired,
            recordReference,
            consentForExternalVerification:
              repaired.consentForExternalVerification ?? true,
            revoked: repaired.revoked ?? false,
            verificationVersion: 1
          };

          changed = true;
        }

        if (
          !repaired.verificationDigest ||
          repaired.verificationVersion !== 1
        ) {
          repaired = {
            ...repaired,
            verificationVersion: 1,
            verificationDigest:
              await createVerificationDigest({
                ...repaired,
                verificationVersion: 1
              })
          };

          changed = true;
        }

        records.push(repaired);
      }

      if (changed) {
        saveBatch({
          ...batch,
          records
        });
      }
    }
  }

  function logApaarCheckRun(currentUser, batch, records) {
    const counts = records.reduce(
      (result, record) => {
        if (record.apaarCheck) {
          result[record.apaarCheck] += 1;
        }

        return result;
      },
      {
        FOUND: 0,
        NOT_FOUND: 0,
        NAME_MISMATCH: 0
      }
    );

    logAuditEvent({
      actorName: currentUser?.name || "College User",
      actorRole: currentUser?.role || "COLLEGE",
      actorEmail: currentUser?.email || "pict.admin@college.edu",
      actionType: "APAAR_CHECK_RUN",
      resourceType: "BATCH",
      resourceId: batch.batchId,
      details: `SIMULATED APAAR authenticity check for ${records.length} record(s) at ${batch.institutionName || "institution"}. FOUND: ${counts.FOUND}, NOT_FOUND: ${counts.NOT_FOUND}, NAME_MISMATCH: ${counts.NAME_MISMATCH}.`,
      changeSummary:
        "Format-valid APAAR IDs remain format-checked, not identity-verified.",
      severity:
        counts.NOT_FOUND || counts.NAME_MISMATCH
          ? "WARNING"
          : "INFO"
    });
  }

  function notifyValidationOutcome(
    batch,
    records,
    { revalidation = false } = {}
  ) {
    const passed = records.filter(
      (record) => record.status === "READY_TO_ACCEPT"
    );

    const flagged = records.filter(
      (record) =>
        record.status === "ACTION_REQUIRED" ||
        record.status === "PENDING_REVIEW"
    );

    if (passed.length) {
      emitNotification({
        id: `NOTICE-VALIDATED-${batch.batchId}-${Date.now()}`,
        audience: "COLLEGE",
        institutionId: batch.institutionId,
        institutionName: batch.institutionName,
        category: "INSTITUTION",
        title: revalidation
          ? "Record revalidated"
          : "Validation completed",
        body: `${passed.length} record(s) passed validation and are ready for institutional acceptance.`,
        href: `/college/workbench?batch=${encodeURIComponent(batch.batchId)}`,
        batchId: batch.batchId
      });
    }

    if (flagged.length) {
      emitNotification({
        id: `NOTICE-VALIDATION-ISSUES-${batch.batchId}-${Date.now()}`,
        audience: "COLLEGE",
        institutionId: batch.institutionId,
        institutionName: batch.institutionName,
        category: "INSTITUTION",
        title: "Validation issues found",
        body: `${flagged.length} record(s) still require correction or review.`,
        href: `/college/workbench?view=unresolved&batch=${encodeURIComponent(batch.batchId)}`,
        batchId: batch.batchId
      });
    }
  }

  // Shared validation engine used by fixAndRevalidateRecord
  // and validateStagedRecords.
  function applyValidationChecks(
    currentRecord,
    comparisonRecords,
    updatedFields = {},
    currentBatch
  ) {
    const newApaar = String(
      updatedFields.apaarId !== undefined
        ? updatedFields.apaarId
        : currentRecord.apaarId || ""
    ).trim();

    const newStudentId = String(
      updatedFields.studentId !== undefined
        ? updatedFields.studentId
        : currentRecord.studentId || ""
    ).trim();

    const newStudentName = String(
      updatedFields.studentName !== undefined
        ? updatedFields.studentName
        : currentRecord.studentName || ""
    ).trim();

    const newProgramme = String(
      updatedFields.programme !== undefined
        ? updatedFields.programme
        : currentRecord.programme || ""
    ).trim();

    const newCategory =
      updatedFields.category !== undefined
        ? updatedFields.category
        : currentRecord.category || "";

    const newDob =
      updatedFields.dob !== undefined
        ? updatedFields.dob
        : currentRecord.dob || "";

    const newSupernumerarySeats = Number(
      updatedFields.supernumerarySeats !== undefined
        ? updatedFields.supernumerarySeats
        : currentRecord.supernumerarySeats || 0
    );

    const newYearOfStudy =
      updatedFields.yearOfStudy !== undefined
        ? updatedFields.yearOfStudy
        : currentRecord.yearOfStudy;

    const newAdmissionStatus =
      updatedFields.admissionStatus !== undefined
        ? updatedFields.admissionStatus
        : currentRecord.admissionStatus;

    const transferProof = updatedFields.transferProof;

    let validationPassed = true;
    let newStatus = "READY_TO_ACCEPT";
    let newIssueStatus = "RESOLVED";
    let newIssueType = null;

    let newReason =
      "All validation checks passed. Record revalidated automatically.";

    let newEvidence = "Corrected fields passed validation.";

    let newAction =
      "Ready for institutional acceptance into central repository.";

    let newSeverity = "LOW";
    let newOwner = "System Auto-Validator";

    let isOverdue = false;
    let isEscalated = false;
    const validationIssues = [];

    const newOciStatus =
      updatedFields.ociStatus !== undefined
        ? updatedFields.ociStatus
        : currentRecord.ociStatus;
    const newForeignNationalStatus =
      updatedFields.foreignNationalStatus !== undefined
        ? updatedFields.foreignNationalStatus
        : currentRecord.foreignNationalStatus;
    const newNriStatus =
      updatedFields.nriStatus !== undefined
        ? updatedFields.nriStatus
        : currentRecord.nriStatus;

    const apaarCheck = /^\d{12}$/.test(newApaar)
      ? checkApaar(newApaar, newStudentName)
      : null;

    function setIssue({
      status = "ACTION_REQUIRED",
      issueStatus = "OPEN",
      type,
      reason,
      evidence,
      action,
      severity = "HIGH",
      owner = "Institution Data Officer",
      overdue = false,
      escalated = false
    }) {
      const existing = validationIssues.find((issue) => issue.type === type);
      if (existing) {
        existing.reason = `${existing.reason} ${reason}`;
        existing.evidence = `${existing.evidence} ${evidence}`;
        existing.action = `${existing.action} ${action}`;
        return;
      }

      validationIssues.push({
        status,
        issueStatus,
        type,
        reason,
        evidence,
        action,
        severity,
        owner,
        overdue,
        escalated
      });

      if (validationIssues.length === 1) {
        newStatus = status;
        newIssueStatus = issueStatus;
        newIssueType = type;
        newReason = reason;
        newEvidence = evidence;
        newAction = action;
        newSeverity = severity;
        newOwner = owner;
        isOverdue = overdue;
        isEscalated = escalated;
      }
    }

    // Check 1: Mandatory fields
    if (!newStudentId) {
      setIssue({
        type: "MISSING_MANDATORY_FIELD",
        reason: "Student ID is missing.",
        evidence: "Field 'studentId' is empty.",
        action: "Provide the student's institutional ID."
      });
    }

    if (!newStudentName) {
      setIssue({
        type: "MISSING_MANDATORY_FIELD",
        reason: "Student name is missing.",
        evidence: "Field 'studentName' is empty.",
        action: "Provide the student's name."
      });
    }

    if (!newDob) {
      setIssue({
        type: "MISSING_MANDATORY_FIELD",
        reason: "Date of birth is missing.",
        evidence: "Field 'dob' is empty.",
        action: "Provide the student's date of birth."
      });
    }

    if (!newProgramme) {
      setIssue({
        type: "MISSING_MANDATORY_FIELD",
        reason: "Programme is missing.",
        evidence: "Field 'programme' is empty.",
        action: "Provide the student's programme."
      });
    }

    // Check 2: APAAR ID format
    if (!newApaar) {
      setIssue({
        type: "MISSING_APAAR_ID",
        reason: "APAAR ID is missing.",
        evidence: "Field 'apaarId' is empty.",
        action: "Provide the student's APAAR ID."
      });
    } else if (!/^\d{12}$/.test(newApaar)) {
      setIssue({
        type: "WRONG_FORMAT",
        reason: "APAAR ID must contain exactly 12 digits.",
        evidence: `Provided APAAR ID: '${newApaar}'.`,
        action: "Enter a valid 12-digit APAAR ID."
      });
    }

    // Check 3: Date of birth format
    const dobText = String(newDob || "");
    const dobDate = /^\d{4}-\d{2}-\d{2}$/.test(dobText)
      ? new Date(`${dobText}T00:00:00.000Z`)
      : null;
    if (
      newDob &&
      (!dobDate || Number.isNaN(dobDate.getTime()) ||
        dobDate.toISOString().slice(0, 10) !== dobText)
    ) {
      setIssue({
        type: "INVALID_DOB",
        reason: "Date of birth must be a valid calendar date in YYYY-MM-DD format.",
        evidence: `Provided DOB: '${newDob}'.`,
        action: "Correct the date of birth."
      });
    }

    // Check 4: Student category
    if (!isValidCategory(newCategory)) {
      setIssue({
        type: "INVALID_CATEGORY",
        reason: `Category '${newCategory}' is invalid.`,
        evidence: `Field 'category' contains '${newCategory}'.`,
        action: "Select a valid student category."
      });
    }

    // Check 6: Year of study
    if (!isValidYearOfStudy(newYearOfStudy)) {
      setIssue({
        type: hasOpenIssue(currentRecord, "INVALID_ACADEMIC_YEAR")
          ? "INVALID_ACADEMIC_YEAR"
          : "INVALID_YEAR_OF_STUDY",
        reason: `Year of study '${newYearOfStudy || "MISSING"}' is invalid.`,
        evidence: `Field 'yearOfStudy' contains '${newYearOfStudy || ""}'.`,
        action: "Select a valid year of study."
      });
    }

    // Check 7: Duplicate student ID in comparison records
    if (newStudentId && Array.isArray(comparisonRecords)) {
      const duplicateStudentId = comparisonRecords.find(
        (record) =>
          record.id !== currentRecord.id &&
          String(record.studentId || "").trim() === newStudentId
      );

      if (duplicateStudentId) {
        setIssue({
          type: "DUPLICATE_STUDENT_ID",
          reason: `Student ID '${newStudentId}' already exists.`,
          evidence: `Conflicts with record ${duplicateStudentId.id}.`,
          action: "Resolve the duplicate student ID."
        });
      }
    }

    // Check 8: Duplicate APAAR ID in the current batch
    if (newApaar && Array.isArray(comparisonRecords)) {
      const duplicateApaar = comparisonRecords.find(
        (record) =>
          record.id !== currentRecord.id &&
          String(record.apaarId || "").trim() === newApaar
      );

      if (duplicateApaar) {
        setIssue({
          type: "DUPLICATE_IN_BATCH",
          reason: `APAAR identifier '${newApaar}' appears more than once in this batch.`,
          evidence: `Conflicts with record ${duplicateApaar.id}.`,
          action: "Verify the student identity and assign the correct APAAR ID."
        });
      }
    }

    // Check 9: Repository-wide APAAR duplicate
    if (newApaar && currentBatch) {
      const repositoryConflict = findRepositoryApaarConflict(
        newApaar,
        currentRecord,
        currentBatch
      );

      if (repositoryConflict) {
        const sameInstitution =
          repositoryConflict.institutionId ===
          currentBatch.institutionId;

        setIssue({
          status: sameInstitution
            ? "ACTION_REQUIRED"
            : "PENDING_REVIEW",
          type: sameInstitution
            ? repositoryConflict.status === "ACCEPTED"
              ? "DUPLICATE_IN_REPOSITORY"
              : "DUPLICATE_ACROSS_BATCHES"
            : "CROSS_INSTITUTION_CONFLICT",
          reason: sameInstitution
            ? `APAAR '${newApaar}' already exists in this institution's central repository.`
            : `Cross-institution conflict: APAAR '${newApaar}' is active at ${currentBatch.institutionName || "this institution"} and ${repositoryConflict.institutionName || "another institution"}. Flagged for review, not fraud.`,
          evidence: sameInstitution
            ? `Conflicts with repository record ${repositoryConflict.id}.`
            : `${currentBatch.institutionName || "This institution"}: ${newProgramme}, ${newYearOfStudy}; ${repositoryConflict.institutionName || "Other institution"}: ${repositoryConflict.programme}, ${repositoryConflict.yearOfStudy}. Both active enrolments require review.`,
          action: sameInstitution
            ? "Resolve the existing repository record before accepting this student."
            : "AICTE Reviewer must adjudicate transfer or withdrawal evidence.",
          severity: "HIGH",
          owner: sameInstitution
            ? "Institution Data Officer"
            : "AICTE Central Reviewer",
          escalated: !sameInstitution
        });
      }
    }

    // Check 10: Overseas flags must agree with the seat category.
    const hasConfirmedOverseasStatus = [
      newOciStatus,
      newForeignNationalStatus,
      newNriStatus
    ].some((status) => String(status || "").toUpperCase() === "CONFIRMED");

    if (
      newCategory !== "NRI_FN" &&
      (hasConfirmedOverseasStatus || newSupernumerarySeats > 0)
    ) {
      setIssue({
        type: "CATEGORY_MISMATCH",
        reason: `Seat category '${newCategory}' conflicts with confirmed OCI/NRI/FN status or supernumerary seats.`,
        evidence: `Category: ${newCategory}; OCI: ${newOciStatus || "not recorded"}; foreign national: ${newForeignNationalStatus || "not recorded"}; NRI: ${newNriStatus || "not recorded"}; supernumerary seats: ${newSupernumerarySeats}.`,
        action: "Align the seat category with overseas documentation or clear the unrelated flags.",
        severity: "MEDIUM",
        owner: "Admissions Officer"
      });
    }

    // Check 11: Course mapping
    if (
      newProgramme &&
      (
        newProgramme.toLowerCase().includes("aero") ||
        newProgramme.toLowerCase().includes("aviation")
      )
    ) {
      setIssue({
        type: "COURSE_MAPPING_ERROR",
        reason: `Programme '${newProgramme}' is not approved for this campus in AICTE Approval Master.`,
        evidence:
          "Approval Master sanction missing for Aeronautical Engineering.",
        action:
          "Reassign the student to an approved department."
      });
    }

    // Check 12: Existing cross-institution conflict
    if (
      hasOpenIssue(
        currentRecord,
        "CROSS_INSTITUTION_CONFLICT"
      )
    ) {
      if (
        !transferProof &&
        !updatedFields.verifiedResolution
      ) {
        setIssue({
          status: "PENDING_REVIEW",
          type: "CROSS_INSTITUTION_CONFLICT",
          reason:
            "Active enrolment conflict: student concurrently enrolled in another institution. Flagged for review, not fraud.",
          evidence:
            "Requires transfer cancellation certificate or AICTE reviewer confirmation.",
          action:
            "AICTE Reviewer must adjudicate transfer documentation.",
          severity: "HIGH",
          owner: "AICTE Central Reviewer",
          escalated: true
        });
      } else {
        newEvidence = `Clearance Certificate: ${
          transferProof || "NOC/TC Verified"
        }. AICTE flag resolved.`;
      }
    }

    // Check 13: Excess intake warning
    if (hasOpenIssue(currentRecord, "INTAKE_EXCEEDED")) {
      if (!updatedFields.supernumeraryApproval) {
        setIssue({
          status: "PENDING_REVIEW",
          issueStatus: currentRecord.isOverdue
            ? "OVERDUE"
            : "OPEN",
          type: "INTAKE_EXCEEDED",
          reason:
            "Potential excess intake flagged for review: Computer Engineering admissions reached 125 vs 120 approved intake.",
          evidence:
            "Approval Master approved seats: 120. Enrolled: 125. Over-enrolment threshold exceeded.",
          action:
            "AICTE Reviewer must verify supernumerary sanction or adjust allocation.",
          severity: "HIGH",
          owner: "AICTE Central Reviewer",
          overdue: currentRecord.isOverdue,
          escalated: true
        });
      } else {
        newEvidence =
          "AICTE Sanction Ref: " +
          updatedFields.supernumeraryApproval;
      }
    }

    // Check 14: NRI/FN quota limits
    const categoryLimit = currentBatch?.categoryLimits?.NRI_FN || 5;
    const nrifnStudents = (comparisonRecords || []).filter((record) => {
      const category =
        record.id === currentRecord.id ? newCategory : record.category;
      const admissionStatus =
        record.id === currentRecord.id
          ? newAdmissionStatus
          : record.admissionStatus;
      return category === "NRI_FN" && admissionStatus !== "CANCELLED";
    }).length;

    if (
      newCategory === "NRI_FN" &&
      (
        newSupernumerarySeats > categoryLimit ||
        nrifnStudents > categoryLimit ||
        hasOpenIssue(currentRecord, "SEAT_CATEGORY_LIMIT")
      ) &&
      !updatedFields.supernumeraryApproval
    ) {
      setIssue({
        type: "SEAT_CATEGORY_LIMIT",
        reason:
          `NRI/FN supernumerary quota exceeds the approved limit of ${categoryLimit} seats.`,
        evidence: `NRI/FN records: ${nrifnStudents}; this record's supernumerary seats: ${newSupernumerarySeats}; approved limit: ${categoryLimit}.`,
        action:
          "Reduce the allocation or upload an approved supernumerary sanction.",
        severity: "MEDIUM",
        owner: "Admissions Officer"
      });
    }

    // Check 15: APAAR authenticity (simulated)
    if (apaarCheck && apaarCheck !== "FOUND") {
      setIssue({
        status: "PENDING_REVIEW",
        type: "APAAR_AUTHENTICITY_REVIEW",
        reason: `APAAR check (simulated): ${apaarCheck}. Flagged for review, not identity-verified.`,
        evidence: `APAAR check (simulated): ${apaarCheck}.`,
        action:
          "AICTE Reviewer must review the APAAR authenticity result.",
        severity: "HIGH",
        owner: "AICTE Central Reviewer",
        escalated: true
      });
    }

    validationPassed = validationIssues.length === 0;
    if (validationIssues.length) {
      const pendingReview = validationIssues.find(
        (issue) => issue.status === "PENDING_REVIEW"
      );
      if (pendingReview) newStatus = "PENDING_REVIEW";
    }

    return {
      validationPassed,
      newStatus,
      newStudentId,
      validationIssues,

      updatedRecord: {
        apaarId: newApaar,
        apaarCheck,

        studentId: newStudentId,
        studentName: newStudentName,
        dob: newDob,

        programme: newProgramme,

        programmeCode: _mapProgrammeCode(newProgramme),

        category: newCategory,

        ociStatus:
          updatedFields.ociStatus !== undefined
            ? updatedFields.ociStatus
            : currentRecord.ociStatus,

        foreignNationalStatus:
          updatedFields.foreignNationalStatus !== undefined
            ? updatedFields.foreignNationalStatus
            : currentRecord.foreignNationalStatus,

        nriStatus:
          updatedFields.nriStatus !== undefined
            ? updatedFields.nriStatus
            : currentRecord.nriStatus,

        supernumerarySeats: newSupernumerarySeats,

        yearOfStudy: newYearOfStudy,
        admissionStatus: newAdmissionStatus,

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

        validationIssues,
        lastRevalidatedAt: new Date().toISOString()
      }
    };
  }