// AICTE Central Bureau API
// Simulates REST endpoint /api/v1/aicte/*

import { APPROVAL_MASTER } from "../mocks/approvalMasterMock.js";
import { getStoredBatches, saveBatch, getCurrentUser } from "../mocks/mockStore.js";
import { getAuditLogs, logAuditEvent } from "../mocks/mockAuditLog.js";

export const aicteApi = {
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
        campus: "Dhankawadi, Pune",
        approvedIntake: 420,
        batchId: "BATCH-2026-ENG-0402"
      },
      {
        id: "INST-002",
        aicteId: "AICTE-1-1099231",
        name: "College of Engineering Pune (COEP Technological University)",
        shortName: "COEP Tech",
        campus: "Shivajinagar, Pune",
        approvedIntake: 270,
        batchId: "BATCH-2026-COEP-0101"
      },
      {
        id: "INST-003",
        aicteId: "AICTE-1-1088421",
        name: "Veermata Jijabai Technological Institute (VJTI Mumbai)",
        shortName: "VJTI Mumbai",
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

    return {
      totalApprovedSeats: totalApproved,
      totalAcceptedEnrolment: totalAccepted,
      overallUtilisationPercentage: overallUtilisation,
      totalPendingReview,
      totalEscalated,
      totalOverdue,
      totalOpenAnomalies: totalOpen,
      institutions: filtered
    };
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

  // Export National Intake Report (CSV)
  async exportNationalIntakeCSV() {
    const stats = await this.getAicteDashboardStats("ALL");
    const headers = "Institution Name,AICTE ID,Campus,Approved Intake,Accepted Enrolment,Utilisation %,Open Anomalies,Escalated Cases\n";
    const rows = stats.institutions.map((i) => 
      `"${i.name}","${i.aicteId}","${i.campus}",${i.approvedIntake},${i.acceptedEnrolment},"${i.utilisation}%",${i.openAnomalies},${i.escalatedCount}`
    ).join("\n");
    return headers + rows;
  }
};
