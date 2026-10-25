// LocalStorage-backed reactive Mock Store for APAAR Platform
import { FAULTY_MOCK_BATCH, CLEAN_MOCK_BATCH, COEP_MOCK_BATCH, VJTI_MOCK_BATCH } from "./mockBatches.js";
import { logAuditEvent } from "./mockAuditLog.js";

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
  SETTINGS: "apaar_prototype_settings"
};

// Demo user profiles
export const DEMO_ACCOUNTS = {
  COLLEGE: {
    role: "COLLEGE",
    id: "INST-001",
    name: "Dr. Arvind Kulkarni",
    title: "Registrar / Institutional Nodal Officer",
    institutionName: "Pune Institute of Computer Technology (PICT)",
    aicteId: "AICTE-1-1029384",
    email: "pict.admin@college.edu",
    avatar: "PICT",
    username: "pict_admin",
    passwordHint: "demo123"
  },
  AICTE: {
    role: "AICTE",
    id: "AICTE-HQ",
    name: "Dr. M. Jagadesh Kumar",
    title: "AICTE Central Review Bureau Chief",
    institutionName: "All India Council for Technical Education (HQ New Delhi)",
    aicteId: "AICTE-HQ-CENTRAL",
    email: "aicte.central@gov.in",
    avatar: "AICTE",
    username: "aicte_officer",
    passwordHint: "demo123"
  },
  STUDENT: {
    role: "STUDENT",
    id: "STU-001",
    name: "Aarav Sharma",
    title: "Enrolled Student",
    apaarId: "111122223333",
    studentId: "SE-COMP-001",
    institutionName: "Pune Institute of Computer Technology (PICT)",
    aicteId: "AICTE-1-1029384",
    programme: "Computer Engineering (B.Tech)",
    yearOfStudy: "SE",
    email: "aarav.sharma@student.pict.edu",
    demoOtp: "7492"
  }
};

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
    return JSON.parse(storageAdapter.getItem(STORAGE_KEYS.BATCHES) || "{}");
  } catch (e) {
    return {};
  }
}

export function getActiveBatch() {
  initializeStore();
  const batches = getStoredBatches();
  const currentBatchId = storageAdapter.getItem(STORAGE_KEYS.CURRENT_BATCH_ID) || FAULTY_MOCK_BATCH.batchId;
  return batches[currentBatchId] || batches[FAULTY_MOCK_BATCH.batchId];
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
      return {
        ...r,
        isOverdue: true,
        isEscalated: true,
        issueStatus: "ESCALATED",
        owner: "AICTE Central Reviewer",
        dueDateLabel: `Overdue (Escalated after ${days} days - prototype setting)`,
        requiredAction: `Escalated to AICTE Reviewer: Institutional response overdue past deadline. Reviewer adjudication required.`
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
