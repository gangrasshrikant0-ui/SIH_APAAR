// LocalStorage-backed reactive Mock Store for APAAR Platform
import { FAULTY_MOCK_BATCH, CLEAN_MOCK_BATCH, COEP_MOCK_BATCH, VJTI_MOCK_BATCH } from "./mockBatches.js";
import { logAuditEvent } from "./mockAuditLog.js";
import { DEMO_ACCOUNTS as CENTRAL_DEMO_ACCOUNTS, DEMO_DATA_NOTICE, DEMO_INSTITUTIONS } from "./demoReference.js";

// In-memory fallback if running in Node.js test environment
const memoryStorage = {};
const storageAdapter = {
  getItem: (key) => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  },
  setItem: (key, val) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, val);
    } else {
      memoryStorage[key] = val;
    }
  },
  removeItem: (key) => {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    } else {
      delete memoryStorage[key];
    }
  }
};

const STORAGE_KEYS = {
  CURRENT_USER: "apaar_current_user",
  BATCHES: "apaar_batches",
  CURRENT_BATCH_ID: "apaar_current_batch_id",
  STUDENT_CONSENT: "apaar_student_consent",
  FONT_SCALE: "apaar_font_scale",
  SETTINGS: "apaar_prototype_settings",
  COLLEGE_NOTICE_READS: "apaar_college_notice_reads",
  NOTIFICATIONS: "apaar_notifications",
  COLLEGE_CONSENT: "apaar_college_consent"
};

export const DEMO_ACCOUNTS = CENTRAL_DEMO_ACCOUNTS;
export { DEMO_DATA_NOTICE };

export const DEFAULT_SETTINGS = {
  dueDaysSetting: 7, // Configurable setting: default 7 days, labelled "prototype setting"
  autoEscalateDays: 7
};

// Initialize Mock Store
export function initializeStore() {
  if (!storageAdapter.getItem(STORAGE_KEYS.BATCHES)) {
    const initialBatches = {
      [FAULTY_MOCK_BATCH.batchId]: JSON.parse(JSON.stringify(FAULTY_MOCK_BATCH)),
      [CLEAN_MOCK_BATCH.batchId]: JSON.parse(JSON.stringify(CLEAN_MOCK_BATCH)),
      [COEP_MOCK_BATCH.batchId]: JSON.parse(JSON.stringify(COEP_MOCK_BATCH)),
      [VJTI_MOCK_BATCH.batchId]: JSON.parse(JSON.stringify(VJTI_MOCK_BATCH))
    };
    storageAdapter.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(initialBatches));
    storageAdapter.setItem(STORAGE_KEYS.CURRENT_BATCH_ID, FAULTY_MOCK_BATCH.batchId);
  } else {
    const storedBatches = JSON.parse(storageAdapter.getItem(STORAGE_KEYS.BATCHES) || "{}");
    const pictBatch = storedBatches[FAULTY_MOCK_BATCH.batchId];
    if (pictBatch && (
      !(pictBatch.records || []).some((record) => String(record.id).startsWith("PICT-ACCEPTED-")) ||
      !(pictBatch.records || []).some((record) => record.apaarId === "984251638019") ||
      !(pictBatch.records || []).some((record) => record.studentName === "Ananya Patil" && record.dob === "2006-08-12")
    )) {
      storedBatches[FAULTY_MOCK_BATCH.batchId] = JSON.parse(JSON.stringify(FAULTY_MOCK_BATCH));
      storageAdapter.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(storedBatches));
    }
  }

  if (!storageAdapter.getItem(STORAGE_KEYS.SETTINGS)) {
    storageAdapter.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  }

  if (!storageAdapter.getItem(STORAGE_KEYS.STUDENT_CONSENT)) {
    storageAdapter.setItem(STORAGE_KEYS.STUDENT_CONSENT, JSON.stringify({
      granted: true,
      lastUpdated: new Date().toISOString()
    }));
  }
}

// User Auth Management
export function getCurrentUser() {
  try {
    const raw = storageAdapter.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user) {
  if (user) {
    storageAdapter.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    logAuditEvent({
      actorName: user.name,
      actorRole: user.role,
      actorEmail: user.email,
      actionType: "LOGIN",
      resourceType: "AUTH_SESSION",
      resourceId: user.id || user.apaarId || "SESSION",
      details: `User logged in successfully as ${user.role}.`,
      changeSummary: `Session initialized for role ${user.role}`,
      severity: "INFO"
    });
  } else {
    const existing = getCurrentUser();
    if (existing) {
      logAuditEvent({
        actorName: existing.name,
        actorRole: existing.role,
        actorEmail: existing.email,
        actionType: "LOGOUT",
        resourceType: "AUTH_SESSION",
        resourceId: "SESSION",
        details: `User logged out cleanly.`,
        changeSummary: "Session terminated",
        severity: "INFO"
      });
    }
    storageAdapter.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

// Prototype Settings
export function getPrototypeSettings() {
  initializeStore();
  try {
    const raw = storageAdapter.getItem(STORAGE_KEYS.SETTINGS);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function updatePrototypeSettings(newSettings) {
  const current = getPrototypeSettings();
  const updated = { ...current, ...newSettings };
  storageAdapter.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

// Batches & Records Management
export function getStoredBatches() {
  initializeStore();
  try {
    const batches = JSON.parse(storageAdapter.getItem(STORAGE_KEYS.BATCHES) || "{}");
    let changed = false;
    Object.values(batches).forEach((batch) => {
      const records = batch.records || [];
      const actualEnrolment = records.filter((record) => record.status === "ACCEPTED").length;
      const approvedIntake = batch.approvedIntake ?? (
        batch.institutionId === "INST-002" ? 270 :
        batch.institutionId === "INST-003" ? 120 : 420
      );
      if (batch.approvedIntake !== approvedIntake) {
        batch.approvedIntake = approvedIntake;
        changed = true;
      }
      if (batch.actualEnrolment !== actualEnrolment) {
        batch.actualEnrolment = actualEnrolment;
        changed = true;
      }
      batch.records = records.map((record) => {
        const normalized = {
          ...record,
          ociStatus: record.ociStatus ?? (record.category === "NRI_FN" ? "NOT_RECORDED" : "NOT_APPLICABLE"),
          foreignNationalStatus: record.foreignNationalStatus ?? (record.category === "NRI_FN" ? "NOT_RECORDED" : "NOT_APPLICABLE"),
          supernumerarySeats: record.supernumerarySeats ?? (record.category === "NRI_FN" ? 1 : 0)
        };
        if (
          normalized.ociStatus !== record.ociStatus ||
          normalized.foreignNationalStatus !== record.foreignNationalStatus ||
          normalized.supernumerarySeats !== record.supernumerarySeats
        ) changed = true;
        return normalized;
      });
    });
    if (changed) storageAdapter.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
    return batches;
  } catch (e) {
    return {};
  }
}

export function getBatchesForInstitution(institutionId) {
  return Object.values(getStoredBatches()).filter((batch) => batch.institutionId === institutionId);
}

export function getActiveBatch() {
  initializeStore();
  const batches = getStoredBatches();
  const currentUser = getCurrentUser();
  const currentBatchId = storageAdapter.getItem(STORAGE_KEYS.CURRENT_BATCH_ID);
  const requested = currentBatchId ? batches[currentBatchId] : null;
  if (currentUser?.role === "COLLEGE") {
    if (requested && requested.institutionId === currentUser.id) return requested;
    const own = getBatchesForInstitution(currentUser.id);
    return own.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)))[0] || requested || null;
  }
  return requested || batches[FAULTY_MOCK_BATCH.batchId];
}

export function setActiveBatchId(batchId) {
  storageAdapter.setItem(STORAGE_KEYS.CURRENT_BATCH_ID, batchId);
}

export function saveBatch(batch) {
  const batches = getStoredBatches();
  batches[batch.batchId] = batch;
  storageAdapter.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
}

// Simulate 8 days passing (escalates any open issue past due date)
export function simulateDaysPassing(days = 8) {
  initializeStore();
  const batches = getStoredBatches();
  const activeBatchId = storageAdapter.getItem(STORAGE_KEYS.CURRENT_BATCH_ID) || FAULTY_MOCK_BATCH.batchId;
  const batch = batches[activeBatchId];
  if (!batch || !batch.records) return null;

  let escalatedCount = 0;
  batch.records = batch.records.map((r) => {
    // Only escalate open or pending issues that haven't been resolved/accepted
    if (r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW") {
      escalatedCount++;
      const issueLedger = Array.isArray(r.issueLedger)
        ? r.issueLedger.map((issue) => {
            if (issue.issueStatus === "RESOLVED") return issue;
            return {
              ...issue,
              issueStatus: "ESCALATED",
              owner: "AICTE Central Reviewer",
              requiredAction: `Escalated to AICTE Reviewer: Institutional response overdue past deadline. Reviewer adjudication required.`,
              history: [
                ...(issue.history || []),
                {
                  at: new Date().toISOString(),
                  action: "ESCALATED",
                  details: `Simulated ${days} days elapsed (prototype setting).`
                }
              ]
            };
          })
        : r.issueLedger;
      return {
        ...r,
        isOverdue: true,
        isEscalated: true,
        issueStatus: "ESCALATED",
        owner: "AICTE Central Reviewer",
        dueDateLabel: `Overdue (Escalated after ${days} days - prototype setting)`,
        requiredAction: `Escalated to AICTE Reviewer: Institutional response overdue past deadline. Reviewer adjudication required.`,
        issueLedger
      };
    }
    return r;
  });

  saveBatch(batch);

  logAuditEvent({
    actorName: "Simulation Controller",
    actorRole: "SYSTEM",
    actorEmail: "system.simulator@aicte-india.org",
    actionType: "AUTO_ESCALATION",
    resourceType: "BATCH",
    resourceId: batch.batchId,
    details: `Simulated ${days} days passing. Auto-escalated ${escalatedCount} overdue anomalies to AICTE Central Reviewer.`,
    changeSummary: `${escalatedCount} records updated: owner reassigned to AICTE Reviewer; badges updated to OVERDUE & ESCALATED`,
    severity: "CRITICAL"
  });

  return { batch, escalatedCount };
}

// Reset store to pristine prototype state
export function resetDemoState() {
  storageAdapter.removeItem(STORAGE_KEYS.BATCHES);
  storageAdapter.removeItem(STORAGE_KEYS.CURRENT_BATCH_ID);
  storageAdapter.removeItem(STORAGE_KEYS.STUDENT_CONSENT);
  storageAdapter.removeItem(STORAGE_KEYS.SETTINGS);
  storageAdapter.removeItem("apaar_audit_logs");
  storageAdapter.removeItem(STORAGE_KEYS.COLLEGE_NOTICE_READS);
  storageAdapter.removeItem(STORAGE_KEYS.NOTIFICATIONS);
  storageAdapter.removeItem(STORAGE_KEYS.COLLEGE_CONSENT);
  initializeStore();
  logAuditEvent({
    actorName: "System Administrator",
    actorRole: "SYSTEM",
    actorEmail: "admin@aicte-india.org",
    actionType: "DEMO_STATE_RESET",
    resourceType: "APPLICATION_DATA",
    resourceId: "ALL",
    details: "Reset all mock batches, anomalies, and logs to initial SIH prototype state.",
    changeSummary: "Restored 7 planted faults and clean batches",
    severity: "WARNING"
  });
}

export function getCollegeNoticeReads() {
  try {
    const raw = storageAdapter.getItem(STORAGE_KEYS.COLLEGE_NOTICE_READS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function markCollegeNoticeRead(noticeId) {
  const reads = getCollegeNoticeReads();
  reads[noticeId] = new Date().toISOString();
  storageAdapter.setItem(STORAGE_KEYS.COLLEGE_NOTICE_READS, JSON.stringify(reads));
  return reads;
}

export function getStoredNotifications() {
  initializeStore();
  try {
    return JSON.parse(storageAdapter.getItem(STORAGE_KEYS.NOTIFICATIONS) || "[]");
  } catch (e) {
    return [];
  }
}

export function upsertNotification(notice) {
  if (!notice?.id) return getStoredNotifications();
  const notices = getStoredNotifications();
  const index = notices.findIndex((item) => item.id === notice.id);
  const next = {
    synthetic: true,
    createdAt: new Date().toISOString(),
    ...notice
  };
  if (index === -1) notices.unshift(next);
  else notices[index] = { ...notices[index], ...next };
  storageAdapter.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notices));
  return notices;
}

export function getCollegeConsentMap() {
  try {
    return JSON.parse(storageAdapter.getItem(STORAGE_KEYS.COLLEGE_CONSENT) || "{}");
  } catch (e) {
    return {};
  }
}

export function hasCollegeConsent(userId) {
  if (!userId) return false;
  return Boolean(getCollegeConsentMap()[userId]?.accepted);
}

export function setCollegeConsent(userId, accepted) {
  const map = getCollegeConsentMap();
  if (!userId) return map;
  if (accepted) {
    map[userId] = { accepted: true, acceptedAt: new Date().toISOString(), synthetic: true };
  } else {
    delete map[userId];
  }
  storageAdapter.setItem(STORAGE_KEYS.COLLEGE_CONSENT, JSON.stringify(map));
  return map;
}

export function emitNotification(notice) {
  if (!notice?.id) return getStoredNotifications();
  return upsertNotification({
    synthetic: true,
    demoLabel: "SYNTHETIC / DEMO",
    createdAt: new Date().toISOString(),
    read: false,
    ...notice
  });
}

export function listNotificationsForUser(user = getCurrentUser()) {
  const stored = getStoredNotifications();
  if (!user) return [];
  return stored.filter((notice) => {
    if (user.role === "AICTE") return notice.audience === "AICTE" || notice.audience === "BOTH";
    if (user.role === "COLLEGE") {
      return (notice.audience === "COLLEGE" || notice.audience === "BOTH") && notice.institutionId === user.id;
    }
    return false;
  });
}

export function markStoredNotificationRead(noticeId) {
  const notices = getStoredNotifications().map((notice) =>
    notice.id === noticeId ? { ...notice, read: true, readAt: new Date().toISOString() } : notice
  );
  storageAdapter.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notices));
  markCollegeNoticeRead(noticeId);
  return notices;
}

export function getInstitutionMaster(institutionId) {
  return DEMO_INSTITUTIONS.find((item) => item.id === institutionId) || DEMO_INSTITUTIONS[0];
}

export function findStoredRecord(recordId) {
  for (const batch of Object.values(getStoredBatches())) {
    const record = (batch.records || []).find((item) => item.id === recordId);
    if (record) return { batch, record };
  }
  return null;
}
