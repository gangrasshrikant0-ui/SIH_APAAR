import { getCurrentUser, getStoredBatches, saveBatch } from "../mocks/mockStore.js";
import { logAuditEvent } from "../mocks/mockAuditLog.js";
import { hasValidVerificationDigest, createVerificationDigest } from "./verificationIntegrity.js";

const HISTORY_KEY = "apaar_external_verification_history";
const memoryHistory = [];

function readHistory() {
  try {
    if (typeof localStorage !== "undefined") {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    }
    return [...memoryHistory];
  } catch (error) {
    console.error("Failed to read external verification history", error);
    return [];
  }
}

function writeHistory(history) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } else {
      memoryHistory.splice(0, memoryHistory.length, ...history);
    }
  } catch (error) {
    console.error("Failed to write external verification history", error);
  }
}

export const verificationApi = {
  async verifyToken(reference, { purpose } = {}) {
    await new Promise((res) => setTimeout(res, 200));
    let result;
    const normalizedReference = normalizeReference(reference);
    const record = await findRecord(normalizedReference);
    if (record?.revoked === true || record?.status === "REVOKED") {
      result = {
        status: "REVOKED",
        message: "This record has been revoked."
      };
    } else if (record?.consentForExternalVerification === false) {
      result = {
        status: "CONSENT_MISSING",
        message: "The student's consent for external verification is not recorded. Details cannot be shown."
      };
    } else if (record) {
      result = {
        status: "VALID",
        studentName: record.studentName,
        apaarId: formatApaarId(record.apaarId),
        institutionName: record.institutionName,
        programme: record.programme,
        academicYear: record.academicYear,
        recordStatus: record.status
      };
    } else {
      result = {
        status: "NOT_FOUND",
        message: "No record matches this reference."
      };
    }

    const user = getCurrentUser();
    const historyEntry = {
      id: `VERIFICATION-${Date.now()}`,
      timestamp: new Date().toISOString(),
      verifierId: user?.id || "VERIFIER-UNKNOWN",
      verifierEmail: user?.email || "unknown@unauthenticated.local",
      reference: normalizedReference,
      purpose,
      result: result.status
    };
    const history = readHistory();
    history.unshift(historyEntry);
    writeHistory(history);
    logAuditEvent({
      actorName: user?.name || "Anonymous Guest",
      actorRole: user?.role || "GUEST",
      actorEmail: user?.email || "guest@unauthenticated.local",
      actionType: "RECORD_VERIFICATION_REQUESTED",
      resourceType: "STUDENT_RECORD",
      resourceId: normalizedReference,
      details: `External verification requested for reference '${normalizedReference}' for purpose '${purpose}'. Result: ${result.status}.`,
      changeSummary: `Single-record verification result: ${result.status}`,
      severity: "INFO"
    });

    return result;
  },

  getVerificationHistory(user = getCurrentUser()) {
    const verifierId = user?.id;
    const verifierEmail = user?.email;
    return readHistory().filter((entry) =>
      (verifierId && entry.verifierId === verifierId) ||
      (verifierEmail && entry.verifierEmail === verifierEmail)
    );
  }
};

async function findRecord(reference) {
  for (const batch of Object.values(getStoredBatches())) {
    let record = (batch.records || []).find((candidate) =>
      candidate.recordReference?.toUpperCase() === reference
    );
    if (record) {
      if (!record.verificationDigest) {
        record = { ...record, verificationVersion: 1, verificationDigest: await createVerificationDigest({ ...record, verificationVersion: 1 }) };
        batch.records = (batch.records || []).map((candidate) => candidate.id === record.id ? record : candidate);
        saveBatch(batch);
      }
      if (!await hasValidVerificationDigest(record)) return null;
      return {
        ...record,
        institutionName: record.institutionName || batch.institutionName,
        academicYear: record.academicYear || batch.academicYear
      };
    }
  }
  return null;
}

function normalizeReference(reference) {
  return String(reference || "").trim().toUpperCase();
}

function formatApaarId(apaarId) {
  if (!apaarId) return apaarId;
  return apaarId.replace(/^(\d{4})(\d{4})(\d{4})$/, "$1 $2 $3");
}
