// AICTE Central Bureau API
// Simulates REST endpoint /api/v1/aicte/*

import { APPROVAL_MASTER } from "../mocks/approvalMasterMock.js";
import { getStoredBatches, saveBatch, getCurrentUser } from "../mocks/mockStore.js";
import { getAuditLogs, logAuditEvent } from "../mocks/mockAuditLog.js";

export const aicteApi = {
  async getAcceptedRepository() {
    await new Promise((res) => setTimeout(res, 80));
    return Object.values(getStoredBatches()).flatMap((batch) =>
      (batch.records || [])
        .filter((record) => record.status === "ACCEPTED")
        .map((record) => ({ ...record, batchId: batch.batchId, institutionId: batch.institutionId, institutionName: batch.institutionName }))
    );
  },

  // AICTE National Dashboard Stats
  async getAicteDashboardStats(institutionFilter = "ALL") {
    await new Promise((res) => setTimeout(res, 80));
    const batches = getStoredBatches();

    const institutionsData = [
      {
        id: "INST-001",
        aicteId: "AICTE-1-1029384",
        name: "Pune Institute of Computer Technology (PICT)",
        shortName: "PICT Pune",
        state: "Maharashtra",
        campus: "Dhankawadi, Pune",
        approvedIntake: 420,
        batchId: "BATCH-2026-ENG-0402"
      },
      {
        id: "INST-002",
        aicteId: "AICTE-1-1099231",
        name: "College of Engineering Pune (COEP Technological University)",
        shortName: "COEP Tech",
        state: "Maharashtra",
        campus: "Shivajinagar, Pune",
        approvedIntake: 270,
        batchId: "BATCH-2026-COEP-0101"
      },
      {
        id: "INST-003",
        aicteId: "AICTE-1-1088421",
        name: "Veermata Jijabai Technological Institute (VJTI Mumbai)",
        shortName: "VJTI Mumbai",
        state: "Maharashtra",
        campus: "Matunga, Mumbai",
        approvedIntake: 120,
        batchId: "BATCH-2026-VJTI-0202"
      }
    ];

    // Compute metrics per institution from live batches
    const summaries = institutionsData.map((inst) => {
      const b = batches[inst.batchId] || {};
      const records = b.records || [];
      const accepted = records.filter((r) => r.status === "ACCEPTED").length + (b.acceptedCount || 0);
      const pendingReview = records.filter((r) => r.status === "PENDING_REVIEW").length;
      const openAnomalies = records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;
      const escalatedCount = records.filter((r) => r.isEscalated).length;
      const overdueCount = records.filter((r) => r.isOverdue).length;
      const utilisation = Math.round((accepted / inst.approvedIntake) * 100);

      return {
        ...inst,
        acceptedEnrolment: accepted,
        actualEnrolment: records.filter((r) => r.status === "ACCEPTED").length,
        pendingReview,
        openAnomalies,
        escalatedCount,
        overdueCount,
        utilisation,
        batchStatus: b.status || "READY_TO_ACCEPT"
      };
    });

    const filtered = institutionFilter === "ALL" ? summaries : summaries.filter((s) => s.id === institutionFilter);

    const totalApproved = filtered.reduce((acc, curr) => acc + curr.approvedIntake, 0);
    const totalAccepted = filtered.reduce((acc, curr) => acc + curr.acceptedEnrolment, 0);
    const totalPendingReview = filtered.reduce((acc, curr) => acc + curr.pendingReview, 0);
    const totalEscalated = filtered.reduce((acc, curr) => acc + curr.escalatedCount, 0);
    const totalOverdue = filtered.reduce((acc, curr) => acc + curr.overdueCount, 0);
    const totalOpen = filtered.reduce((acc, curr) => acc + curr.openAnomalies, 0);
    const overallUtilisation = totalApproved > 0 ? Math.round((totalAccepted / totalApproved) * 100) : 0;
    const acceptedRecords = filtered.flatMap((institution) =>
      (batches[institution.batchId]?.records || []).filter((record) => record.status === "ACCEPTED")
    );
    const uniqueStudents = new Set(acceptedRecords.map((record) => record.apaarId).filter(Boolean));
    const activeInstitutionsByApaar = new Map();
    Object.values(batches).forEach((batch) => {
      (batch.records || []).forEach((record) => {
        if (!record.apaarId || record.status === "REJECTED") return;
        const institutions = activeInstitutionsByApaar.get(record.apaarId) || new Set();
        institutions.add(batch.institutionId);
        activeInstitutionsByApaar.set(record.apaarId, institutions);
      });
    });
    const multipleActiveEnrolments = [...activeInstitutionsByApaar.values()]
      .filter((institutions) => institutions.size > 1).length;

    return {
      totalApprovedSeats: totalApproved,
      totalAcceptedEnrolment: totalAccepted,
      overallUtilisationPercentage: overallUtilisation,
      totalPendingReview,
      totalEscalated,
      totalOverdue,
      totalOpenAnomalies: totalOpen,
      totalAcceptedRecords: totalAccepted,
      uniqueStudentsByApaar: uniqueStudents.size,
      apaarIdsWithMultipleActiveEnrolments: multipleActiveEnrolments,
      institutions: filtered
    };
  },

  async getStudentJourney(apaarId) {
    await new Promise((res) => setTimeout(res, 80));
    const currentUser = getCurrentUser();
    const normalized = apaarId.trim();
    const records = Object.values(getStoredBatches()).flatMap((batch) =>
      (batch.records || [])
        .filter((record) => record.apaarId === normalized)
        .map((record) => ({
          ...record,
          batchId: batch.batchId,
          institutionId: batch.institutionId,
          institutionName: batch.institutionName
        }))
    );
    const activeInstitutions = new Set(
      records.filter((record) => record.status !== "REJECTED").map((record) => record.institutionId)
    );
    logAuditEvent({
      actorName: currentUser?.name || "AICTE Reviewer",
      actorRole: currentUser?.role || "AICTE",
      actorEmail: currentUser?.email || "aicte.central@gov.in",
      actionType: "APAAR_LOOKUP",
      resourceType: "APAAR_ID",
      resourceId: normalized,
      details: `APAAR lookup for ${normalized}. Institution: National (all AICTE institutions).`,
      changeSummary: `${records.length} record(s) returned.`,
      severity: "INFO"
    });
    return { records, allRecords: records, hasActiveElsewhere: activeInstitutions.size > 1 };
  },

  async createCollegeUser({ aicteNo, collegeName, email, issuingAuthority }) {
    if (!aicteNo || !collegeName || !email) {
      throw new Error("AICTE number, college name and email are required.");
    }
	const shortName = collegeName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 6) || "CLG";
    const suffix = String(aicteNo).slice(-4) || "0000";
    const username = `${shortName}${suffix}`.toLowerCase();
    const password = Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const operationId = `AUD-${Date.now().toString().slice(-8)}`;
    const issueAuthorityName = issuingAuthority || getCurrentUser()?.name || "AICTE Reviewer";

    logAuditEvent({
      actorName: issueAuthorityName,
      actorRole: "AICTE",
      actorEmail: getCurrentUser()?.email || "aicte.central@gov.in",
      actionType: "USER_CREATED",
      resourceType: "COLLEGE_ACCOUNT",
      resourceId: aicteNo,
      details: `College user created for ${collegeName} (${email}). Username generated as ${username}.`,
      changeSummary: `Credentials issued to ${collegeName} via self-service user generation.`,
      severity: "INFO",
      issuingAuthority: issueAuthorityName,
      operationId,
      actorId: getCurrentUser()?.id || "AICTE-CENTRAL"
    });

    return {
      username,
      password,
      email,
      collegeName,
      aicteNo,
      issuingAuthority: issueAuthorityName,
      operationId,
      delivered: true
    };
  },

  async notifyCollegeIssue({ institutionId, institutionName, issueTitle, issueType, message, batchId }) {
    const currentUser = getCurrentUser();
    const notice = {
      id: `AICTE-NOTICE-${Date.now()}`,
      title: "High-priority institutional review alert",
      body: message || `Please review and update the flagged ${issueTitle || issueType} data before revalidation.`,
      audience: "COLLEGE",
      category: "AICTE",
      institutionId,
      institutionName,
      issueId: issueType || "AICTE-NOTICE",
      href: `/college/workbench?batch=${encodeURIComponent(batchId || "")}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 1
    };

    const existing = JSON.parse(localStorage.getItem("apaar_notifications") || "[]");
    existing.unshift(notice);
    localStorage.setItem("apaar_notifications", JSON.stringify(existing));

    const batches = getStoredBatches();
    Object.values(batches).forEach((batch) => {
      if (batch.institutionId !== institutionId) return;
      (batch.records || []).forEach((record) => {
        const shouldExpose = record.status === "PENDING_REVIEW" || record.isEscalated || record.isOverdue || record.issueType === "CROSS_INSTITUTION_CONFLICT" || record.issueType === "INTAKE_EXCEEDED";
        if (shouldExpose) {
          record.visibleToCollege = true;
          record.collegeNotificationSent = true;
          record.notificationSentAt = new Date().toISOString();
          record.issueStatus = record.issueStatus || "OPEN";
        }
      });
      batch.records = batch.records || [];
      saveBatch(batch);
    });

    logAuditEvent({
      actorName: currentUser?.name || "AICTE Reviewer",
      actorRole: currentUser?.role || "AICTE",
      actorEmail: currentUser?.email || "aicte.central@gov.in",
      actionType: "AICTE_NOTIFICATION_SENT",
      resourceType: "COLLEGE_NOTICE",
      resourceId: institutionId,
      details: `High-priority AICTE alert sent to ${institutionName} for issue ${issueTitle || issueType}.`,
      changeSummary: `Institution notified to verify and correct the flagged records.`,
      severity: "HIGH",
      issuingAuthority: currentUser?.name || "AICTE Reviewer",
      operationId: `OPS-${Date.now().toString().slice(-8)}`,
      actorId: currentUser?.id || "AICTE-CENTRAL"
    });

    return notice;
  },

  // AICTE Review Queue: Escalated & Cross-Institution Cases across all institutions
  async getReviewQueue({ institutionId = "ALL", issueType = "ALL", search = "" } = {}) {
    await new Promise((res) => setTimeout(res, 80));
    const batches = getStoredBatches();
    let queue = [];

    Object.values(batches).forEach((batch) => {
      const records = batch.records || [];
      records.forEach((r) => {
        // Review queue includes: PENDING_REVIEW, Escalated, Overdue, or Cross-institution
        if (r.status === "PENDING_REVIEW" || r.isEscalated || r.isOverdue || r.issueType === "CROSS_INSTITUTION_CONFLICT") {
          queue.push({
            ...r,
            batchId: batch.batchId,
            institutionId: batch.institutionId,
            institutionName: batch.institutionName
          });
        }
      });
    });

    if (institutionId && institutionId !== "ALL") {
      queue = queue.filter((item) => item.institutionId === institutionId);
    }

    if (issueType && issueType !== "ALL") {
      queue = queue.filter((item) => item.issueType === issueType);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      queue = queue.filter((item) => 
        (item.studentName && item.studentName.toLowerCase().includes(q)) ||
        (item.apaarId && item.apaarId.toLowerCase().includes(q)) ||
        (item.studentId && item.studentId.toLowerCase().includes(q)) ||
        (item.institutionName && item.institutionName.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q))
      );
    }

    return queue;
  },

  // Reviewer Action: Evidence Confirmed
  async confirmReviewerEvidence(batchId, recordId, reviewerNote = "") {
    await new Promise((res) => setTimeout(res, 180));
    const batches = getStoredBatches();
    const batch = batches[batchId];
    if (!batch) throw new Error("Batch not found.");

    const recordIndex = batch.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) throw new Error("Record not found in batch.");

    const currentRecord = batch.records[recordIndex];

    const updatedRecord = {
      ...currentRecord,
      status: "READY_TO_ACCEPT",
      issueStatus: "RESOLVED",
      issueType: null,
      isEscalated: false,
      isOverdue: false,
      reason: `AICTE Central Reviewer confirmed evidence: ${reviewerNote || "Valid transfer/sanction proof verified."}`,
      evidence: `Adjudication signed by AICTE Reviewer. Ref: AICTE-ADJ-${Date.now().toString().slice(-4)}`,
      owner: "AICTE Central Reviewer",
      requiredAction: "Evidence verified. Ready for institutional acceptance into central repository."
    };

    batch.records[recordIndex] = updatedRecord;

    const remainingFlagged = batch.records.filter((r) => r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW").length;
    batch.flaggedRowsCount = remainingFlagged;
    batch.readyToAcceptCount = batch.records.filter((r) => r.status === "READY_TO_ACCEPT").length;
    saveBatch(batch);

    const currentUser = getCurrentUser();
    logAuditEvent({
      actorName: currentUser?.name || "Dr. M. Jagadesh Kumar",
      actorRole: "AICTE",
      actorEmail: currentUser?.email || "aicte.central@gov.in",
      actionType: "AICTE_EVIDENCE_CONFIRMED",
      resourceType: "STUDENT_RECORD",
      resourceId: recordId,
      details: `AICTE Reviewer confirmed evidence for ${currentRecord.studentName} (${currentRecord.studentId}). Note: "${reviewerNote || "Documentation verified"}".`,
      changeSummary: `Status transitioned from ${currentRecord.status} -> READY_TO_ACCEPT. Escalation cleared.`,
      severity: "INFO"
    });

    return updatedRecord;
  },

  // Reviewer Action: Send Back to College
  async sendBackToCollege(batchId, recordId, reviewerNote = "") {
    await new Promise((res) => setTimeout(res, 180));
    const batches = getStoredBatches();
    const batch = batches[batchId];
    if (!batch) throw new Error("Batch not found.");

    const recordIndex = batch.records.findIndex((r) => r.id === recordId);
    if (recordIndex === -1) throw new Error("Record not found in batch.");

    const currentRecord = batch.records[recordIndex];

    const updatedRecord = {
      ...currentRecord,
      status: "ACTION_REQUIRED",
      issueStatus: "OPEN",
      isEscalated: false,
      owner: "Institution Data Officer",
      requiredAction: `Returned by AICTE Reviewer: ${reviewerNote || "Additional documentation required."} Please correct and resubmit.`,
      lastReturnedAt: new Date().toISOString()
    };

    batch.records[recordIndex] = updatedRecord;
    saveBatch(batch);

    const currentUser = getCurrentUser();
    logAuditEvent({
      actorName: currentUser?.name || "Dr. M. Jagadesh Kumar",
      actorRole: "AICTE",
      actorEmail: currentUser?.email || "aicte.central@gov.in",
      actionType: "AICTE_SENT_BACK_TO_COLLEGE",
      resourceType: "STUDENT_RECORD",
      resourceId: recordId,
      details: `AICTE Reviewer returned ${currentRecord.studentName} (${currentRecord.studentId}) to institution. Note: "${reviewerNote || "Insufficient evidence"}".`,
      changeSummary: `Status changed to ACTION_REQUIRED. Reassigned to Institution Data Officer.`,
      severity: "WARNING"
    });

    return updatedRecord;
  },

  // Get AICTE Compliance Audit Trail
  async getAuditTrail() {
    await new Promise((res) => setTimeout(res, 80));
    return getAuditLogs();
  },

  // Export National Intake Report (CSV) — legacy, kept for backwards compat
  async exportNationalIntakeCSV() {
    const stats = await this.getAicteDashboardStats("ALL");
    const headers = "Institution Name,AICTE ID,Campus,Approved Intake,Accepted Enrolment,Utilisation %,Open Anomalies,Escalated Cases\n";
    const rows = stats.institutions.map((i) =>
      `"${i.name}","${i.aicteId}","${i.campus}",${i.approvedIntake},${i.acceptedEnrolment},"${i.utilisation}%",${i.openAnomalies},${i.escalatedCount}`
    ).join("\n");
    return headers + rows;
  },

  // Per-institution × per-programme intake rows for the Intake Report view.
  // Derives live accepted-enrolment numbers from the same batch data the
  // National Dashboard uses, so the two views always agree.
  async getIntakeReportRows() {
    await new Promise((res) => setTimeout(res, 80));
    const batches = getStoredBatches();
    const academicYear = APPROVAL_MASTER.academicYear;

    const rows = [];
    for (const inst of APPROVAL_MASTER.institutions) {
      // Find the batch that belongs to this institution
      const batch = Object.values(batches).find(
        (b) => b.institutionId === inst.id || b.aicteId === inst.aicteId
      ) || {};
      const records = batch.records || [];

      for (const prog of inst.programmes) {
        // Only ACCEPTED records count toward enrolment (per spec §3-B)
        const accepted = records.filter(
          (r) => r.status === "ACCEPTED" && r.programme === prog.name
        ).length;
        // Also include batch-level acceptedCount attributed to this programme
        // (clean batches store counts without per-record breakdown)
        const batchAccepted = accepted > 0 ? accepted : (
          prog.approvedIntake > 0
            ? Math.round((batch.acceptedCount || 0) * (prog.approvedIntake / inst.programmes.reduce((a, p) => a + p.approvedIntake, 0)))
            : 0
        );
        const openAnomalies = records.filter(
          (r) =>
            (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") &&
            r.programme === prog.name
        ).length;
        const escalated = records.filter(
          (r) => r.isEscalated && r.programme === prog.name
        ).length;
        const utilisation =
          prog.approvedIntake > 0
            ? Math.round((batchAccepted / prog.approvedIntake) * 100)
            : 0;

        rows.push({
          institution: inst.shortName || inst.name,
          institutionFull: inst.name,
          institutionId: inst.id,
          programme: `${prog.name} (${prog.degree})`,
          programmeName: prog.name,
          year: academicYear,
          approvedIntake: prog.approvedIntake,
          acceptedEnrolment: batchAccepted,
          utilisation,
          openAnomalies,
          escalated
        });
      }
    }
    return rows;
  },

  // Write a REPORT_DOWNLOADED audit entry (called after each CSV download)
  logReportDownload({ reportName, rowCount, filtersActive }) {
    const user = getCurrentUser();
    logAuditEvent({
      actorName: user?.name || "AICTE Reviewer",
      actorRole: user?.role || "AICTE",
      actorEmail: user?.email || "aicte.central@gov.in",
      actionType: "REPORT_DOWNLOADED",
      resourceType: "REPORT",
      resourceId: reportName,
      details: `Downloaded "${reportName}" with ${rowCount} row(s). Filters applied: ${filtersActive ? "Yes" : "No"}.`,
      changeSummary: `${rowCount} record(s) exported to CSV`,
      severity: "INFO"
    });
  }
};
