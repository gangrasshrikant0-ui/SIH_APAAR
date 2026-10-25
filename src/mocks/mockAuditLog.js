// Mock Audit Log for AICTE Compliance and Activity Tracking
// Records: who, what, when, change

// In-memory fallback if running in Node.js test environment without window.localStorage
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
  }
};

export const INITIAL_AUDIT_LOGS = [
  {
    id: "AUDIT-1001",
    timestamp: "2026-10-24T09:30:15Z",
    actorName: "Dr. Arvind Kulkarni",
    actorRole: "COLLEGE",
    actorEmail: "pict.admin@college.edu",
    actionType: "BATCH_UPLOAD",
    resourceType: "BATCH",
    resourceId: "BATCH-2026-ENG-0402",
    details: "Uploaded admissions batch: PICT_Engg_Admissions_Batch_2026_Faulty.csv with 25 records.",
    changeSummary: "Status set to VALIDATING, 7 anomalies detected",
    severity: "INFO"
  },
  {
    id: "AUDIT-1002",
    timestamp: "2026-10-24T09:30:22Z",
    actorName: "System Auto-Validator",
    actorRole: "SYSTEM",
    actorEmail: "validator@aicte-india.org",
    actionType: "VALIDATION_RUN",
    resourceType: "BATCH",
    resourceId: "BATCH-2026-ENG-0402",
    details: "Automated validation engine flagged 7 records: 1 Missing APAAR, 1 Format Error, 2 Batch Duplicates, 1 Cross-Institute, 1 Intake Overflow, 1 Quota Overflow, 1 Course Mismatch.",
    changeSummary: "Batch status changed from VALIDATING -> ACTION_REQUIRED",
    severity: "WARNING"
  },
  {
    id: "AUDIT-1003",
    timestamp: "2026-10-24T11:15:40Z",
    actorName: "Admissions Office PICT",
    actorRole: "COLLEGE",
    actorEmail: "pict.admin@college.edu",
    actionType: "WORKBENCH_ACCESS",
    resourceType: "WORKBENCH",
    resourceId: "BATCH-2026-ENG-0402",
    details: "Institution opened Issue Workbench to review flagged anomalies.",
    changeSummary: "Filtered view: Computer Engineering, High Severity",
    severity: "INFO"
  }
];

export function logAuditEvent(entry) {
  try {
    const existingStr = storageAdapter.getItem("apaar_audit_logs");
    const logs = existingStr ? JSON.parse(existingStr) : [...INITIAL_AUDIT_LOGS];
    const newEntry = {
      id: `AUDIT-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    logs.unshift(newEntry);
    storageAdapter.setItem("apaar_audit_logs", JSON.stringify(logs));
    return newEntry;
  } catch (e) {
    console.error("Failed to write to mock audit log", e);
    return null;
  }
}

export function getAuditLogs() {
  try {
    const existingStr = storageAdapter.getItem("apaar_audit_logs");
    if (!existingStr) {
      storageAdapter.setItem("apaar_audit_logs", JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(existingStr);
  } catch (e) {
    return INITIAL_AUDIT_LOGS;
  }
}
