import express from "express";
import cors from "cors";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import { createDatabase } from "./db.js";
import {
  businessIssues,
  normalizeStudent,
  validateStorageFields,
  validateStudent
} from "./validation.js";

const FIELD_ALIASES = {
  studentId: ["studentId", "PRN", "Roll No", "RollNumber", "StudentID", "Registration No", "Institutional Student ID / PRN"],
  studentName: ["studentName", "Name", "Candidate Name", "StudentName", "Student Full Name"],
  apaarId: ["apaarId", "APAAR", "APAAR_ID", "ApaarNumber", "National Student ID", "APAAR ID (12 Digits)"],
  programme: ["programme", "Course", "Branch", "Programme", "Department", "Degree & Programme"],
  yearOfStudy: ["yearOfStudy", "Year", "Class", "Semester", "YearOfStudy", "Academic Year of Study"],
  dateOfBirth: ["dateOfBirth", "dob", "Date of Birth", "DOB", "Birth Date", "Birthdate"],
  admissionStatus: ["admissionStatus", "Admission Status", "Enrolment Status", "Enrollment Status", "Status"],
  category: ["category", "Category", "Quota", "Admission Category", "SeatType", "Seat Category"],
  ociStatus: ["ociStatus", "OCI", "OCI Status", "OCI Flag"],
  foreignNationalStatus: ["foreignNationalStatus", "FN", "Foreign National", "FN Status", "Foreign National Status", "Foreign National Flag"],
  nriStatus: ["nriStatus", "NRI", "NRI Flag"],
  supernumerarySeats: ["supernumerarySeats", "Supernumerary", "Supernumerary Seats"],
  admissionDate: ["admissionDate", "AdmissionDate", "DOA", "JoiningDate", "Date of Admission"],
  gender: ["gender", "Gender", "Sex"],
  institutionId: ["institutionId", "institution_id", "Institution ID", "College ID"]
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function audit(db, actionType, institutionId, source, details, counts = {}, request) {
  db.prepare(`
    INSERT INTO audit_log (action_type, institution_id, source, actor, role, details, counts_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(actionType, institutionId || null, source || null, request?.get("x-actor") || "Unknown", request?.get("x-role") || "UNKNOWN", details, JSON.stringify(counts), new Date().toISOString());
}

function requireInstitution(request, response, db) {
  const institutionId = request.get("x-institution-id");
  if (!institutionId) {
    audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", null, null, "Ingestion request missing X-Institution-Id header.", {}, request);
    response.status(400).json({ total: 0, storedClean: 0, storedFlagged: 0, rejected: 0, records: [], issues: [], errors: [{ row: 0, field: "X-Institution-Id", message: "X-Institution-Id header is required." }] });
    return null;
  }
  return institutionId.trim();
}

function publicIssue(issue) {
  return {
    issueType: issue.issueType,
    severity: issue.severity,
    reason: issue.publicReason || issue.reason,
    field: issue.field,
    responsibleParty: issue.responsibleParty,
    requiredAction: issue.requiredAction,
    dueDate: issue.dueDate
  };
}

function duplicateSameInstitution(db, student, institutionId) {
  return db.prepare(`
    SELECT id, student_id, apaar_id FROM students
    WHERE institution_id = ? AND (student_id = ? OR (apaar_id <> '' AND apaar_id = ?))
    LIMIT 1
  `).get(institutionId, student.studentId, student.apaarId);
}

function otherInstitutionMatch(db, student, institutionId) {
  if (!student.apaarId) return null;
  return db.prepare(`
    SELECT institution_id, student_id, student_name, programme, year_of_study
    FROM students WHERE apaar_id = ? AND institution_id <> ? LIMIT 1
  `).get(student.apaarId, institutionId);
}

function enrichIssues(db, student, institutionId, existingIssues, seenApaarIds) {
  const issues = [...existingIssues];
  if (student.apaarId && seenApaarIds.has(student.apaarId)) {
    issues.push({
      issueType: "DUPLICATE_IN_BATCH",
      severity: "HIGH",
      reason: `APAAR '${student.apaarId}' is shared with another student in this batch.`,
      field: "apaarId",
      responsibleParty: "Institution Data Officer",
      requiredAction: "Assign a unique APAAR ID.",
      evidence: "The APAAR ID occurs more than once in this upload."
    });
  }
  const sameInstitution = duplicateSameInstitution(db, student, institutionId);
  if (sameInstitution && sameInstitution.student_id !== student.studentId && student.apaarId && sameInstitution.apaar_id === student.apaarId) {
    issues.push({
      issueType: "DUPLICATE_IN_REPOSITORY",
      severity: "HIGH",
      reason: `APAAR '${student.apaarId}' already exists in this institution's central repository.`,
      field: "apaarId",
      responsibleParty: "Institution Data Officer",
      requiredAction: "Resolve the existing repository record before accepting this student.",
      evidence: `Conflicts with repository record ${sameInstitution.id}.`
    });
  }
  const otherInstitution = otherInstitutionMatch(db, student, institutionId);
  if (otherInstitution) {
    issues.push({
      issueType: "CROSS_INSTITUTION_CONFLICT",
      severity: "HIGH",
      publicReason: "Active enrolment at another institution. AICTE review required.",
      reason: "Active enrolment conflict flagged for review, not fraud.",
      field: "apaarId",
      responsibleParty: "AICTE Central Reviewer",
      requiredAction: "AICTE Reviewer must adjudicate transfer or withdrawal evidence.",
      evidence: `AICTE-only evidence: ${otherInstitution.institution_id}, ${otherInstitution.programme}, ${otherInstitution.year_of_study}.`
    });
  }
  return issues;
}

function issueDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function nextBatchId(db) {
  const row = db.prepare("SELECT batch_id FROM batches ORDER BY rowid DESC LIMIT 1").get();
  const number = row ? Number(String(row.batch_id).replace("BATCH-", "")) + 1 : 1;
  return `BATCH-${String(number).padStart(4, "0")}`;
}

function createBatch(db, institutionId, source, fileName = null) {
  const batchId = nextBatchId(db);
  db.prepare(`
    INSERT INTO batches (batch_id, institution_id, source, file_name, uploaded_at, status)
    VALUES (?, ?, ?, ?, ?, 'UPLOADED')
  `).run(batchId, institutionId, source, fileName, new Date().toISOString());
  return batchId;
}

function updateBatch(db, batchId, values) {
  db.prepare(`
    UPDATE batches SET status = ?, total_rows = ?, stored_clean = ?, stored_flagged = ?, rejected = ?
    WHERE batch_id = ?
  `).run(values.status, values.total, values.storedClean, values.storedFlagged, values.rejected, batchId);
}

function validUploadType(file) {
  const extension = String(file.originalname || "").toLowerCase().split(".").pop();
  const buffer = file.buffer;
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isCsv = !isZip && !buffer.includes(0);
  if (extension === "xlsx" && isZip) return "xlsx";
  if (extension === "csv" && isCsv) return "csv";
  return null;
}

async function parseUpload(file, mapping = null) {
  const type = validUploadType(file);
  if (!type) throw new Error("Unsupported or invalid file content. Upload a valid CSV or XLSX file.");
  if (type === "xlsx") {
    const sheetRows = await readSheet(file.buffer);
    if (sheetRows.length <= 1) throw new Error("The spreadsheet is empty or contains only a header row.");
    const headers = sheetRows[0].map((header) => String(header ?? "").trim());
    const rows = sheetRows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
    if (mapping) {
      const missing = Object.entries(mapping).filter(([, column]) => column && !Object.prototype.hasOwnProperty.call(rows[0], column)).map(([field, column]) => `${field} (${column})`);
      if (missing.length) throw new Error(`Mapping refers to column(s) missing from the file: ${missing.join(", ")}.`);
    }
    return { rows, type };
  }
  const text = file.buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows = parse(text, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: false, trim: true });
  if (!rows.length) throw new Error("The CSV is empty or contains only a header row.");
  if (mapping) {
    const missing = Object.entries(mapping).filter(([, column]) => column && !Object.prototype.hasOwnProperty.call(rows[0], column)).map(([field, column]) => `${field} (${column})`);
    if (missing.length) throw new Error(`Mapping refers to column(s) missing from the file: ${missing.join(", ")}.`);
  }
  return { rows, type };
}

function approvalFor(db, institutionId, programme) {
  return db.prepare(`
    SELECT * FROM approval_master
    WHERE institution_id = ? AND lower(programme_name) = lower(?)
    LIMIT 1
  `).get(institutionId, programme);
}

function ruleIssues(db, student, institutionId, excludeId = null) {
  const issues = [];
  const approval = approvalFor(db, institutionId, student.programme);
  if (approval && student.admissionDate && Number.isNaN(Date.parse(student.admissionDate))) {
    issues.push({
      issueType: "INCONSISTENT_DATE", severity: "HIGH",
      reason: "Admission date is not a valid calendar date.",
      field: "admissionDate", responsibleParty: "Institution Data Officer",
      requiredAction: "Correct the admission date and revalidate the record.",
      evidence: `Invalid date: ${student.admissionDate}.`
    });
  }
  if (approval) {
    const accepted = db.prepare(`
      SELECT COUNT(*) AS count FROM students
      WHERE institution_id = ? AND lower(programme) = lower(?) AND status = 'ACCEPTED'
      AND (? IS NULL OR id <> ?)
    `).get(institutionId, student.programme, excludeId, excludeId).count;
    if (accepted >= approval.approved_intake) {
      issues.push({
        issueType: "INTAKE_EXCEEDED", severity: "HIGH",
        reason: `Potential excess enrolment, flagged for review: ${accepted + 1} admissions exceed the approved intake of ${approval.approved_intake}.`,
        field: "programme", responsibleParty: "AICTE Central Reviewer",
        requiredAction: "AICTE Reviewer must verify supernumerary sanction or adjust allocation.",
        evidence: `Approval Master approved seats: ${approval.approved_intake}. Accepted enrolment: ${accepted + 1}.`
      });
    }
    const categoryLimits = JSON.parse(approval.category_limits_json || "{}");
    const category = student.category || "GENERAL";
    const limit = categoryLimits[category];
    if (Number.isFinite(limit)) {
      const count = db.prepare(`
        SELECT COUNT(*) AS count FROM students
        WHERE institution_id = ? AND lower(programme) = lower(?) AND category = ? AND status = 'ACCEPTED'
        AND (? IS NULL OR id <> ?)
      `).get(institutionId, student.programme, category, excludeId, excludeId).count;
      if (count >= limit) {
        issues.push({
          issueType: "SEAT_CATEGORY_LIMIT", severity: "MEDIUM",
          reason: `${category} seat-category allocation exceeds the approved limit of ${limit}.`,
          field: "category", responsibleParty: "Admissions Officer",
          requiredAction: "Re-categorize the student or upload an approved supernumerary sanction.",
          evidence: `Approval Master limit: ${limit}. Accepted category count after this record: ${count + 1}.`
        });
      }
    }
  }
  return issues;
}

function aggregateData(db, institutionId = null) {
  const approvals = db.prepare(`
    SELECT * FROM approval_master ${institutionId ? "WHERE institution_id = ?" : ""}
    ORDER BY institution_id, programme_code
  `).all(...(institutionId ? [institutionId] : []));
  const rows = approvals.map((approval) => {
    const records = db.prepare(`
      SELECT * FROM students
      WHERE institution_id = ? AND lower(programme) = lower(?)
    `).all(approval.institution_id, approval.programme_name);
    const accepted = records.filter((row) => row.status === "ACCEPTED").length;
    const openRecords = records.filter((row) => ["ACTION_REQUIRED", "PENDING_REVIEW"].includes(row.status));
    const issueRows = openRecords.flatMap((row) => issuesFor(db, row.id));
    const overdue = issueRows.filter((issue) => issue.dueDate && issue.dueDate < new Date().toISOString().slice(0, 10)).length;
    return {
      institutionId: approval.institution_id,
      institution: approval.institution_name,
      institutionFull: approval.institution_name,
      aicteId: approval.aicte_id,
      campus: approval.campus,
      shortName: approval.institution_name,
      programmeCode: approval.programme_code,
      code: approval.programme_code,
      programmeName: approval.programme_name,
      programme: `${approval.programme_name} (${approval.degree})`,
      degree: approval.degree,
      year: approval.academic_year,
      approvedIntake: approval.approved_intake,
      acceptedEnrolment: accepted,
      actualEnrolment: accepted,
      readyToAccept: records.filter((row) => row.status === "READY_TO_ACCEPT").length,
      openAnomalies: openRecords.length,
      anomaliesCount: openRecords.length,
      escalated: records.filter((row) => openRecords.includes(row) && issueRows.some((issue) => issue.issueType === "CROSS_INSTITUTION_CONFLICT")).length,
      overdue,
      utilisation: approval.approved_intake ? Math.round((accepted / approval.approved_intake) * 100) : 0
    };
  });
  const allRecords = db.prepare(`SELECT * FROM students ${institutionId ? "WHERE institution_id = ?" : ""}`).all(...(institutionId ? [institutionId] : []));
  const open = allRecords.filter((row) => ["ACTION_REQUIRED", "PENDING_REVIEW"].includes(row.status));
  const accepted = allRecords.filter((row) => row.status === "ACCEPTED");
  const totalApprovedSeats = rows.reduce((sum, row) => sum + row.approvedIntake, 0);
  const totalAcceptedEnrolment = accepted.length;
  const issueRows = open.flatMap((row) => issuesFor(db, row.id));
  return {
    rows,
    totals: {
      totalApprovedSeats,
      totalAcceptedEnrolment,
      overallUtilisationPercentage: totalApprovedSeats ? Math.round(totalAcceptedEnrolment / totalApprovedSeats * 100) : 0,
      totalPendingReview: allRecords.filter((row) => row.status === "PENDING_REVIEW").length,
      totalOpenAnomalies: open.length,
      totalOverdue: issueRows.filter((issue) => issue.dueDate && issue.dueDate < new Date().toISOString().slice(0, 10)).length,
      totalEscalated: issueRows.filter((issue) => issue.issueType === "CROSS_INSTITUTION_CONFLICT").length,
      totalAcceptedRecords: accepted.length,
      uniqueStudentsByApaar: new Set(accepted.map((row) => row.apaar_id).filter(Boolean)).size
    },
    issueSummary: Object.values(open.flatMap((row) => issuesFor(db, row.id)).reduce((result, issue) => {
      const key = `${issue.issueType}:${issue.severity}`;
      result[key] = result[key] || { issueType: issue.issueType, severity: issue.severity, count: 0 };
      result[key].count += 1;
      return result;
    }, {})),
    reviewQueueCount: allRecords.filter((row) => ["ACTION_REQUIRED", "PENDING_REVIEW"].includes(row.status)).length
  };
}

function insertStudent(db, student, institutionId, source, issues, batchId) {
  const now = new Date().toISOString();
  const status = issues.some((issue) => issue.issueType === "CROSS_INSTITUTION_CONFLICT") ? "PENDING_REVIEW" : issues.length ? "ACTION_REQUIRED" : "UPLOADED";
  const result = db.prepare(`
    INSERT INTO students (
      institution_id, student_id, student_name, apaar_id, programme, year_of_study,
      dob, admission_status, category, oci_status, foreign_national_status, nri_status,
      supernumerary_seats, gender, admission_date, source, status, created_at, batch_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    institutionId, student.studentId, student.studentName, student.apaarId,
    student.programme, student.yearOfStudy, student.dob, student.admissionStatus,
    student.category, String(student.ociStatus),
    String(student.foreignNationalStatus), String(student.nriStatus), student.supernumerarySeats, student.gender,
    student.admissionDate, source, status, now, batchId
  );
  const record = { id: `INGEST-${result.lastInsertRowid}`, ...student, institutionId, source, status, createdAt: now };
  const dueDate = issueDueDate();
  const storedIssues = issues.map((issue) => ({ ...issue, dueDate }));
  const insertIssue = db.prepare(`
    INSERT INTO student_issues (student_id, issue_type, severity, reason, field, responsible_party, required_action, due_date, evidence, batch_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const issue of storedIssues) {
    insertIssue.run(result.lastInsertRowid, issue.issueType, issue.severity, issue.reason, issue.field, issue.responsibleParty, issue.requiredAction, dueDate, issue.evidence, batchId);
  }
  return { record, issues: storedIssues.map(publicIssue), storedIssueRows: storedIssues };
}

function recordBatch(db, institutionId, source, total, storedClean, storedFlagged, rejected, request) {
  db.prepare(`
    INSERT INTO ingestion_batches (institution_id, source, total, accepted, rejected, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(institutionId, source, total, storedClean + storedFlagged, rejected, new Date().toISOString());
  audit(db, "STUDENT_RECORDS_ADDED", institutionId, source, `Ingestion stored ${storedClean} clean and ${storedFlagged} flagged record(s).`, { total, storedClean, storedFlagged, rejected }, request);
}

function mapCsvRow(row, mapping = null) {
  const mapped = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (mapping && Object.prototype.hasOwnProperty.call(mapping, field)) {
      mapped[field] = row[mapping[field]] ?? "";
      continue;
    }
    const header = Object.keys(row).find((key) => aliases.some((alias) =>
      alias.toLowerCase().replace(/[^a-z0-9]/g, "") === key.toLowerCase().replace(/[^a-z0-9]/g, "")
    ));
    mapped[field] = header ? row[header] : "";
  }
  return normalizeStudent(mapped);
}

function validateMapping(mapping) {
  if (!mapping) return;
  const required = ["studentId", "studentName", "apaarId", "programme", "yearOfStudy", "category"];
  const missing = required.filter((field) => !mapping[field]);
  if (missing.length) throw new Error(`Mapping is missing required field(s): ${missing.join(", ")}.`);
}

function mismatchInstitution(student, institutionId) {
  return student.institutionId && student.institutionId !== institutionId;
}

function requireRole(request, response, db, role) {
  if (request.get("x-role") !== role) {
    audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", request.get("x-institution-id"), null, `Role ${request.get("x-role") || "UNKNOWN"} attempted to access an ${role} endpoint.`, {}, request);
    response.status(403).json({ message: `X-Role ${role} is required.` });
    return false;
  }
  return true;
}

function issuesFor(db, studentId) {
  return db.prepare("SELECT issue_type AS issueType, severity, reason, field, responsible_party AS responsibleParty, required_action AS requiredAction, due_date AS dueDate, evidence FROM student_issues WHERE student_id = ?").all(studentId);
}

function backendRecord(db, row) {
  const isConfirmed = (value) =>
    value === true || value === 1 || String(value).toLowerCase() === "true";
  const institution = db.prepare(
    "SELECT institution_name FROM approval_master WHERE institution_id = ? LIMIT 1"
  ).get(row.institution_id);

  return {
    id: `INGEST-${row.id}`,
    studentId: row.student_id,
    studentName: row.student_name,
    apaarId: row.apaar_id,
    programme: row.programme,
    yearOfStudy: row.year_of_study,
    dob: row.dob || "",
    admissionStatus: row.admission_status || "",
    category: row.category,
    ociStatus: isConfirmed(row.oci_status) ? "CONFIRMED" : "NOT_APPLICABLE",
    foreignNationalStatus: isConfirmed(row.foreign_national_status) ? "CONFIRMED" : "NOT_APPLICABLE",
    nriStatus: isConfirmed(row.nri_status) ? "CONFIRMED" : "NOT_APPLICABLE",
    supernumerarySeats: row.supernumerary_seats,
    gender: row.gender || "",
    admissionDate: row.admission_date || "",
    status: row.status,
    source: row.source,
    institutionId: row.institution_id,
    institutionName: institution?.institution_name || row.institution_id,
    batchId: row.batch_id,
    recordReference: row.record_reference,
    consentForExternalVerification: Boolean(row.consent_for_external_verification),
    revoked: Boolean(row.revoked),
    issues: issuesFor(db, row.id)
  };
}

function dbIdFromPublicId(id) {
  const match = String(id || "").match(/^INGEST-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function ownStudent(db, request, id) {
  const dbId = dbIdFromPublicId(id);
  if (!dbId) return null;
  return db.prepare("SELECT * FROM students WHERE id = ? AND institution_id = ?").get(dbId, request.get("x-institution-id"));
}

function replaceIssues(db, studentId, issues) {
  db.prepare("DELETE FROM student_issues WHERE student_id = ?").run(studentId);
  const dueDate = issueDueDate();
  const insert = db.prepare(`
    INSERT INTO student_issues (student_id, issue_type, severity, reason, field, responsible_party, required_action, due_date, evidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const issue of issues || []) {
    insert.run(studentId, issue.issueType || issue.type, issue.severity || "HIGH", issue.reason || "", issue.field || null,
      issue.responsibleParty || issue.owner || "Institution Data Officer", issue.requiredAction || "", issue.dueDate || dueDate, issue.evidence || "");
  }
}

function recomputeIssues(db, student, institutionId) {
  const normalized = normalizeStudent(student);
  const issues = businessIssues(normalized);
  const existing = duplicateSameInstitution(db, normalized, institutionId);
  if (existing && existing.id !== student.id && existing.apaar_id === normalized.apaarId) {
    issues.push({ issueType: "DUPLICATE_IN_REPOSITORY", severity: "HIGH", reason: `APAAR '${normalized.apaarId}' already exists in this institution's central repository.`, field: "apaarId", responsibleParty: "Institution Data Officer", requiredAction: "Resolve the existing repository record before accepting this student.", evidence: `Conflicts with repository record ${existing.id}.` });
  }
  const other = otherInstitutionMatch(db, normalized, institutionId);
  if (other) {
    issues.push({ issueType: "CROSS_INSTITUTION_CONFLICT", severity: "HIGH", publicReason: "Active enrolment at another institution. AICTE review required.", reason: "Active enrolment conflict flagged for review, not fraud.", field: "apaarId", responsibleParty: "AICTE Central Reviewer", requiredAction: "AICTE Reviewer must adjudicate transfer or withdrawal evidence.", evidence: `AICTE-only evidence: ${other.institution_id}, ${other.programme}, ${other.year_of_study}.` });
  }
  return issues;
}

function hasIssueType(issues, type) {
  return (issues || []).some((issue) => (issue.issueType || issue.type) === type);
}

export function createApp({ db = createDatabase() } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/students", (request, response) => {
    const institutionId = requireInstitution(request, response, db);
    if (!institutionId) return;
    let student;
    try {
      student = normalizeStudent(request.body);
    } catch (error) {
      return response.status(400).json({ total: 1, storedClean: 0, storedFlagged: 0, rejected: 1, records: [], issues: [], errors: [{ row: 1, field: "student", message: error.message }] });
    }
    if (mismatchInstitution(student, institutionId)) {
      audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", institutionId, "MANUAL_ENTRY", "Body institution does not match authenticated institution.", {}, request);
      return response.status(403).json({ total: 1, storedClean: 0, storedFlagged: 0, rejected: 1, records: [], issues: [], errors: [{ row: 1, field: "institutionId", message: "Institution does not match X-Institution-Id." }] });
    }
    const storageErrors = validateStudent(student);
    const duplicate = duplicateSameInstitution(db, student, institutionId);
    if (duplicate?.student_id === student.studentId) {
      audit(db, "STUDENT_RECORDS_ADDED", institutionId, "MANUAL_ENTRY", "Duplicate Student ID rejected.", { total: 1, storedClean: 0, storedFlagged: 0, rejected: 1 }, request);
      return response.status(409).json({ total: 1, storedClean: 0, storedFlagged: 0, rejected: 1, records: [], issues: [], errors: [{ row: 1, field: "studentId", message: "Student ID / PRN already exists for this institution." }] });
    }
    if (storageErrors.length) return response.status(400).json({ total: 1, storedClean: 0, storedFlagged: 0, rejected: 1, records: [], issues: [], errors: storageErrors.map((error) => ({ row: 1, ...error })) });
    const issues = [
      ...enrichIssues(db, student, institutionId, businessIssues(student), new Set()),
      ...ruleIssues(db, student, institutionId)
    ];
    const batchId = createBatch(db, institutionId, "MANUAL_ENTRY");
    const stored = insertStudent(db, student, institutionId, "MANUAL_ENTRY", issues, batchId);
    updateBatch(db, batchId, { status: "DONE", total: 1, storedClean: issues.length ? 0 : 1, storedFlagged: issues.length ? 1 : 0, rejected: 0 });
    recordBatch(db, institutionId, "MANUAL_ENTRY", 1, issues.length ? 0 : 1, issues.length ? 1 : 0, 0, request);
    return response.status(201).json({ batchId, total: 1, storedClean: issues.length ? 0 : 1, storedFlagged: issues.length ? 1 : 0, rejected: 0, records: [{ ...stored.record, batchId, issues: stored.issues }], issues: stored.issues, errors: [] });
  });

  app.post("/api/students/bulk", upload.single("file"), async (request, response) => {
    const institutionId = requireInstitution(request, response, db);
    if (!institutionId) return;
    if (!request.file || !/\.(csv|xlsx)$/i.test(request.file.originalname)) {
      return response.status(400).json({ total: 0, storedClean: 0, storedFlagged: 0, rejected: 0, records: [], issues: [], errors: [{ row: 0, field: "file", message: "A valid CSV or XLSX file is required." }] });
    }
    let rows;
    let mapping = null;
    try {
      mapping = request.body.mapping ? JSON.parse(request.body.mapping) : null;
      validateMapping(mapping);
      rows = (await parseUpload(request.file, mapping)).rows;
    } catch (error) {
      return response.status(400).json({ total: 0, storedClean: 0, storedFlagged: 0, rejected: 0, records: [], issues: [], errors: [{ row: 0, field: "file", message: `Invalid upload: ${error.message}` }] });
    }

    const seenStudentIds = new Set();
    const apaarCounts = new Map();
    const batchId = createBatch(db, institutionId, "BULK_UPLOAD", request.file.originalname);
    const parsedRows = rows.map((row) => mapCsvRow(row, mapping));
    const mismatchedRow = parsedRows.findIndex((student) => mismatchInstitution(student, institutionId));
    if (mismatchedRow >= 0) {
      audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", institutionId, "BULK_UPLOAD", `CSV row ${mismatchedRow + 2} contains a different institution.`, { row: mismatchedRow + 2 }, request);
      return response.status(403).json({
        total: rows.length, storedClean: 0, storedFlagged: 0, rejected: rows.length,
        records: [], issues: [], errors: [{ row: mismatchedRow + 2, field: "institutionId", message: "Institution does not match X-Institution-Id." }]
      });
    }
    for (const student of parsedRows) if (student.apaarId) apaarCounts.set(student.apaarId, (apaarCounts.get(student.apaarId) || 0) + 1);
    const acceptedRecords = [];
    const allIssues = [];
    const errors = [];
    let storedClean = 0;
    let storedFlagged = 0;
    const insertMany = db.transaction(() => {
      parsedRows.forEach((student, index) => {
        const rowNumber = index + 2;
        let storageErrors;
        try {
          storageErrors = validateStorageFields(student);
          validateStudent(student).filter((error) => error.field === "supernumerarySeats").forEach((error) => storageErrors.push(error));
        } catch (error) {
          errors.push({ row: rowNumber, field: "flags", message: error.message });
          return;
        }
        const duplicate = duplicateSameInstitution(db, student, institutionId);
        if (duplicate?.student_id === student.studentId || seenStudentIds.has(student.studentId)) {
          errors.push({ row: rowNumber, field: "studentId", message: "Student ID / PRN already exists or is duplicated for this institution." });
          return;
        }
        if (storageErrors.length) {
          errors.push(...storageErrors.map((error) => ({ row: rowNumber, ...error })));
          return;
        }
        const issues = [...businessIssues(student), ...ruleIssues(db, student, institutionId)];
        if (student.apaarId && apaarCounts.get(student.apaarId) > 1) {
          issues.push({ issueType: "DUPLICATE_IN_BATCH", severity: "HIGH", reason: `APAAR '${student.apaarId}' is shared with another student in this batch.`, field: "apaarId", responsibleParty: "Institution Data Officer", requiredAction: "Assign a unique APAAR ID.", evidence: "The APAAR ID occurs more than once in this upload." });
        }
        if (student.apaarId && duplicate?.apaar_id === student.apaarId) {
          issues.push({ issueType: "DUPLICATE_IN_REPOSITORY", severity: "HIGH", reason: `APAAR '${student.apaarId}' already exists in this institution's central repository.`, field: "apaarId", responsibleParty: "Institution Data Officer", requiredAction: "Resolve the existing repository record before accepting this student.", evidence: `Conflicts with repository record ${duplicate.id}.` });
        }
        const otherInstitution = otherInstitutionMatch(db, student, institutionId);
        if (otherInstitution) {
          issues.push({ issueType: "CROSS_INSTITUTION_CONFLICT", severity: "HIGH", publicReason: "Active enrolment at another institution. AICTE review required.", reason: "Active enrolment conflict flagged for review, not fraud.", field: "apaarId", responsibleParty: "AICTE Central Reviewer", requiredAction: "AICTE Reviewer must adjudicate transfer or withdrawal evidence.", evidence: `AICTE-only evidence: ${otherInstitution.institution_id}, ${otherInstitution.programme}, ${otherInstitution.year_of_study}.` });
        }
        const stored = insertStudent(db, student, institutionId, "BULK_UPLOAD", issues, batchId);
        seenStudentIds.add(student.studentId);
        acceptedRecords.push({ ...stored.record, batchId, issues: stored.issues });
        allIssues.push(...stored.issues.map((issue) => ({ row: rowNumber, ...issue })));
        if (issues.length) storedFlagged++;
        else storedClean++;
      });
    });
    insertMany();
    updateBatch(db, batchId, { status: "DONE", total: rows.length, storedClean, storedFlagged, rejected: errors.length });
    recordBatch(db, institutionId, "BULK_UPLOAD", rows.length, storedClean, storedFlagged, errors.length, request);
    return response.json({ batchId, total: rows.length, storedClean, storedFlagged, rejected: errors.length, records: acceptedRecords, issues: allIssues, errors });
  });

  app.get("/api/batches/:id", (request, response) => {
    const institutionId = request.get("x-institution-id");
    if (!institutionId) return response.status(400).json({ message: "X-Institution-Id header is required." });
    const batch = db.prepare("SELECT * FROM batches WHERE batch_id = ?").get(request.params.id);
    if (!batch) return response.status(404).json({ message: "Batch not found." });
    if (batch.institution_id !== institutionId) {
      audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", institutionId, null, "Attempted to access another institution's batch.", { batchId: request.params.id }, request);
      return response.status(403).json({ message: "Batch belongs to another institution." });
    }
    return response.json({ batchId: batch.batch_id, institutionId: batch.institution_id, source: batch.source, fileName: batch.file_name, uploadedAt: batch.uploaded_at, status: batch.status, total: batch.total_rows, storedClean: batch.stored_clean, storedFlagged: batch.stored_flagged, rejected: batch.rejected });
  });

  app.get("/api/batches/:id/issues", (request, response) => {
    const institutionId = request.get("x-institution-id");
    if (!institutionId) return response.status(400).json({ message: "X-Institution-Id header is required." });
    const batch = db.prepare("SELECT * FROM batches WHERE batch_id = ?").get(request.params.id);
    if (!batch) return response.status(404).json({ message: "Batch not found." });
    if (batch.institution_id !== institutionId) {
      audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", institutionId, null, "Attempted to access another institution's batch issues.", { batchId: request.params.id }, request);
      return response.status(403).json({ message: "Batch belongs to another institution." });
    }
    const issues = db.prepare(`
      SELECT si.*, s.student_id, s.student_name
      FROM student_issues si JOIN students s ON s.id = si.student_id
      WHERE si.batch_id = ? ORDER BY si.id
    `).all(request.params.id);
    return response.json({ batchId: request.params.id, issues });
  });

  app.get("/api/aicte/review-queue", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const filter = request.query.institution;
    const rows = db.prepare(`
      SELECT * FROM students
      WHERE status IN ('PENDING_REVIEW', 'ACTION_REQUIRED')
      ${filter ? "AND institution_id = ?" : ""}
      ORDER BY id DESC
    `).all(...(filter ? [filter] : []));
    const queue = rows.flatMap((row) => {
      const issues = issuesFor(db, row.id);
      return (issues.length ? issues : [{ issueType: null, severity: "HIGH", reason: "Record requires review.", field: null, responsibleParty: "AICTE Central Reviewer", requiredAction: "Review this record.", dueDate: null, evidence: "" }])
        .map((issue) => ({ ...backendRecord(db, row), ...issue, batchId: `INGESTION-${row.id}` }));
    });
    return response.json({ records: queue });
  });

  app.get("/api/aicte/students/by-apaar/:apaarId", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const apaarId = request.params.apaarId;
    if (!/^\d{12}$/.test(apaarId)) return response.status(400).json({ message: "APAAR ID must contain exactly 12 numeric digits." });
    const rows = db.prepare("SELECT * FROM students WHERE apaar_id = ? ORDER BY id").all(apaarId);
    const records = rows.map((row) => ({ ...backendRecord(db, row), openIssues: issuesFor(db, row.id) }));
    audit(db, "APAAR_LOOKUP", null, null, `APAAR lookup for ${apaarId}.`, { resultCount: records.length }, request);
    return response.json({ records, hasActiveElsewhere: new Set(records.filter((row) => row.status !== "REJECTED").map((row) => row.institutionId)).size > 1 });
  });

  app.get("/api/students/by-apaar/:apaarId", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const institutionId = request.get("x-institution-id");
    if (!institutionId) return response.status(400).json({ message: "X-Institution-Id header is required." });
    const apaarId = request.params.apaarId;
    if (!/^\d{12}$/.test(apaarId)) return response.status(400).json({ message: "APAAR ID must contain exactly 12 numeric digits." });
    const rows = db.prepare("SELECT * FROM students WHERE apaar_id = ? AND institution_id = ? ORDER BY id").all(apaarId, institutionId);
    const allRows = db.prepare("SELECT institution_id, status FROM students WHERE apaar_id = ?").all(apaarId);
    const records = rows.map((row) => ({ ...backendRecord(db, row), openIssues: issuesFor(db, row.id) }));
    audit(db, "APAAR_LOOKUP", institutionId, null, `APAAR lookup for ${apaarId}.`, { resultCount: records.length }, request);
    return response.json({ records, activeElsewhere: allRows.some((row) => row.institution_id !== institutionId && row.status !== "REJECTED") });
  });

  app.get("/api/aicte/audit", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const conditions = [];
    const values = [];
    if (request.query.actor) { conditions.push("actor LIKE ?"); values.push(`%${request.query.actor}%`); }
    if (request.query.action) { conditions.push("action_type = ?"); values.push(request.query.action); }
    if (request.query.from) { conditions.push("created_at >= ?"); values.push(request.query.from); }
    if (request.query.to) { conditions.push("created_at <= ?"); values.push(request.query.to); }
    const rows = db.prepare(`SELECT id, created_at AS timestamp, actor AS actorName, role AS actorRole, action_type AS actionType, institution_id AS resourceId, details, counts_json FROM audit_log ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY created_at DESC`).all(...values);
    return response.json({ records: rows.map((row) => ({ ...row, severity: row.actionType === "UNAUTHORIZED_ACCESS_ATTEMPT" ? "CRITICAL" : "INFO", actorEmail: "", changeSummary: row.details })) });
  });

  app.patch("/api/students/:id", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const row = ownStudent(db, request, request.params.id);
    if (!row) {
      audit(db, "UNAUTHORIZED_ACCESS_ATTEMPT", request.get("x-institution-id"), "MANUAL_ENTRY", "Institution attempted to patch a record it does not own.", {}, request);
      return response.status(403).json({ message: "Record does not belong to this institution." });
    }
    if (["ACCEPTED", "REJECTED"].includes(row.status)) {
      return response.status(409).json({ message: `Cannot correct a ${row.status} record.` });
    }
    let student;
    try {
      student = normalizeStudent({ ...row, ...request.body, institutionId: row.institution_id });
    } catch (error) {
      return response.status(400).json({ message: error.message });
    }
    const storageErrors = validateStudent(student);
    if (storageErrors.length) return response.status(400).json({ errors: storageErrors });
    const duplicateStudent = db.prepare("SELECT id FROM students WHERE institution_id = ? AND student_id = ? AND id <> ?").get(row.institution_id, student.studentId, row.id);
    if (duplicateStudent) return response.status(409).json({ message: "Student ID / PRN already exists for this institution." });
    const issues = recomputeIssues(db, { ...student, id: row.id }, row.institution_id);
    const status = hasIssueType(issues, "CROSS_INSTITUTION_CONFLICT") ? "PENDING_REVIEW" : issues.length ? "ACTION_REQUIRED" : "UPLOADED";
    db.prepare(`
      UPDATE students SET student_id=?, student_name=?, apaar_id=?, programme=?, year_of_study=?, dob=?, admission_status=?, category=?,
      oci_status=?, foreign_national_status=?, nri_status=?, supernumerary_seats=?, gender=?, admission_date=?, status=?
      WHERE id=?
    `).run(student.studentId, student.studentName, student.apaarId, student.programme, student.yearOfStudy, student.dob, student.admissionStatus, student.category,
      String(student.ociStatus), String(student.foreignNationalStatus), String(student.nriStatus), student.supernumerarySeats,
      student.gender, student.admissionDate, status, row.id);
    replaceIssues(db, row.id, issues);
    audit(db, "RECORD_CORRECTED", row.institution_id, row.source, `Record ${request.params.id} corrected.`, { status }, request);
    return response.json({ record: backendRecord(db, db.prepare("SELECT * FROM students WHERE id = ?").get(row.id)) });
  });

  app.post("/api/students/:id/draft", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const row = ownStudent(db, request, request.params.id);
    if (!row) return response.status(403).json({ message: "Record does not belong to this institution." });
    if (["ACCEPTED", "REJECTED"].includes(row.status)) {
      return response.status(409).json({ message: `Cannot correct a ${row.status} record.` });
    }

    let student;
    try {
      student = normalizeStudent({ ...row, ...request.body, institutionId: row.institution_id });
    } catch (error) {
      return response.status(400).json({ message: error.message });
    }
    const storageErrors = validateStudent(student);
    if (storageErrors.length) return response.status(400).json({ errors: storageErrors });
    const duplicateStudent = db.prepare("SELECT id FROM students WHERE institution_id = ? AND student_id = ? AND id <> ?").get(row.institution_id, student.studentId, row.id);
    if (duplicateStudent) return response.status(409).json({ message: "Student ID / PRN already exists for this institution." });

    db.prepare(`
      UPDATE students SET student_id=?, student_name=?, apaar_id=?, programme=?, year_of_study=?,
      dob=?, admission_status=?, category=?, oci_status=?, foreign_national_status=?, nri_status=?,
      supernumerary_seats=?, gender=?, admission_date=?
      WHERE id=?
    `).run(student.studentId, student.studentName, student.apaarId, student.programme, student.yearOfStudy,
      student.dob, student.admissionStatus, student.category, String(student.ociStatus),
      String(student.foreignNationalStatus), String(student.nriStatus), student.supernumerarySeats,
      student.gender, student.admissionDate, row.id);

    audit(db, "RECORD_DRAFT_SAVED", row.institution_id, row.source, `Draft saved for record ${request.params.id}.`, { status: row.status }, request);
    const updated = db.prepare("SELECT * FROM students WHERE id = ?").get(row.id);
    return response.json({ record: { ...backendRecord(db, updated), issues: issuesFor(db, row.id) } });
  });

  app.post("/api/students/:id/outcome", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const row = ownStudent(db, request, request.params.id);
    if (!row) return response.status(403).json({ message: "Record does not belong to this institution." });
    const allowed = ["READY_TO_ACCEPT", "ACTION_REQUIRED", "PENDING_REVIEW"];
    if (!allowed.includes(request.body.status)) return response.status(409).json({ message: "Illegal validation outcome." });
    if (!["UPLOADED", "ACTION_REQUIRED", "PENDING_REVIEW"].includes(row.status)) {
      return response.status(409).json({ message: `Cannot validate a ${row.status} record.` });
    }
    const submittedIssues = request.body.issues || [];
    const conflict = otherInstitutionMatch(db, { apaarId: row.apaar_id }, row.institution_id);
    const computedIssues = ruleIssues(db, row, row.institution_id, row.id);
    const issues = conflict && !hasIssueType(submittedIssues, "CROSS_INSTITUTION_CONFLICT")
      ? [...submittedIssues, ...computedIssues, { issueType: "CROSS_INSTITUTION_CONFLICT", severity: "HIGH", reason: "Active enrolment conflict flagged for review, not fraud.", field: "apaarId", responsibleParty: "AICTE Central Reviewer", requiredAction: "AICTE Reviewer must adjudicate transfer or withdrawal evidence.", evidence: `AICTE-only evidence: ${conflict.institution_id}, ${conflict.programme}, ${conflict.year_of_study}.` }]
      : [...submittedIssues, ...computedIssues];
    const status = conflict ? "PENDING_REVIEW" : request.body.status;
    db.prepare("UPDATE students SET status = ? WHERE id = ?").run(status, row.id);
    replaceIssues(db, row.id, issues);
    audit(db, "RECORDS_VALIDATED", row.institution_id, row.source, `Record ${request.params.id} validation outcome: ${status}.`, { status }, request);
    return response.json({ record: backendRecord(db, db.prepare("SELECT * FROM students WHERE id = ?").get(row.id)) });
  });

  app.post("/api/students/:id/accept", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const row = ownStudent(db, request, request.params.id);
    if (!row) return response.status(403).json({ message: "Record does not belong to this institution." });
    if (row.status !== "READY_TO_ACCEPT") return response.status(409).json({ message: "Only READY_TO_ACCEPT records can be accepted." });
    db.prepare("UPDATE students SET status = 'ACCEPTED' WHERE id = ?").run(row.id);
    audit(db, "RECORD_ACCEPTED", row.institution_id, row.source, `Record ${request.params.id} accepted.`, { status: "ACCEPTED" }, request);
    return response.json({ record: backendRecord(db, db.prepare("SELECT * FROM students WHERE id = ?").get(row.id)) });
  });

  app.post("/api/aicte/students/:id/review", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const dbId = dbIdFromPublicId(request.params.id);
    const row = dbId ? db.prepare("SELECT * FROM students WHERE id = ?").get(dbId) : null;
    if (!row) return response.status(404).json({ message: "Record not found." });
    if (row.status !== "PENDING_REVIEW") return response.status(409).json({ message: "Only PENDING_REVIEW records can be reviewed." });
    const transitions = { RETURN_TO_INSTITUTION: "ACTION_REQUIRED", APPROVE: "READY_TO_ACCEPT", REJECT: "REJECTED" };
    const status = transitions[request.body.decision];
    if (!status) return response.status(400).json({ message: "Invalid review decision." });
    db.prepare("UPDATE students SET status = ? WHERE id = ?").run(status, row.id);
    if (status === "REJECTED") replaceIssues(db, row.id, [{ issueType: "CROSS_INSTITUTION_CONFLICT", severity: "HIGH", reason: request.body.note || "Rejected by AICTE reviewer.", field: "apaarId", responsibleParty: "AICTE Central Reviewer", requiredAction: "Record remains rejected pending institutional correction.", evidence: "AICTE review decision." }]);
    audit(db, "RECORD_REVIEWED", row.institution_id, row.source, `Record ${request.params.id} reviewed: ${request.body.decision}.`, { status, note: request.body.note || "" }, request);
    return response.json({ record: backendRecord(db, db.prepare("SELECT * FROM students WHERE id = ?").get(row.id)) });
  });

  app.get("/api/aicte/repository", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const conditions = ["status = 'ACCEPTED'"];
    const values = [];
    if (request.query.institution) { conditions.push("institution_id = ?"); values.push(request.query.institution); }
    if (request.query.programme) { conditions.push("programme = ?"); values.push(request.query.programme); }
    const rows = db.prepare(`SELECT * FROM students WHERE ${conditions.join(" AND ")} ORDER BY id DESC`).all(...values);
    return response.json({ records: rows.map((row) => backendRecord(db, row)) });
  });

  app.get("/api/meta", (_request, response) => {
    const row = db.prepare("SELECT value FROM demo_meta WHERE key = 'seedVersion'").get();
    return response.json({ seedVersion: row?.value || "initial" });
  });

  app.get("/api/aicte/dashboard", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const data = aggregateData(db, request.query.institution && request.query.institution !== "ALL" ? request.query.institution : null);
    const institutions = [...new Map(data.rows.map((row) => [row.institutionId, row])).values()].map((row) => {
      const institutionRows = data.rows.filter((item) => item.institutionId === row.institutionId);
      const approvedIntake = institutionRows.reduce((sum, item) => sum + item.approvedIntake, 0);
      const acceptedEnrolment = institutionRows.reduce((sum, item) => sum + item.acceptedEnrolment, 0);
      return {
        id: row.institutionId, aicteId: row.aicteId, name: row.institution,
        shortName: row.institution, campus: row.campus, approvedIntake,
        acceptedEnrolment, actualEnrolment: acceptedEnrolment,
        openAnomalies: institutionRows.reduce((sum, item) => sum + item.openAnomalies, 0),
        utilisation: approvedIntake ? Math.round(acceptedEnrolment / approvedIntake * 100) : 0
      };
    });
    return response.json({
      ...data.totals,
      totalEscalated: data.totals.totalEscalated,
      institutions,
      rows: data.rows,
      reviewQueueCount: data.reviewQueueCount,
      issueSummary: data.issueSummary
    });
  });

  app.get("/api/college/dashboard", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const data = aggregateData(db, request.get("x-institution-id"));
    const categoryCounts = Object.fromEntries(["GENERAL", "OBC", "SC", "ST", "EWS", "TFWS", "NRI_FN"].map((category) => [
      category,
      db.prepare("SELECT COUNT(*) AS count FROM students WHERE institution_id = ? AND category = ? AND status = 'ACCEPTED'")
        .get(request.get("x-institution-id"), category).count
    ]));
    const approvedIntake = data.rows.reduce((sum, row) => sum + row.approvedIntake, 0);
    const acceptedEnrolment = data.totals.totalAcceptedEnrolment;
    return response.json({
      ...data.totals,
      institutionId: request.get("x-institution-id"),
      institutionName: data.rows[0]?.institution || request.get("x-institution-id"),
      approvedIntake,
      acceptedEnrolment,
      actualEnrolment: acceptedEnrolment,
      readyToAccept: data.rows.reduce((sum, row) => sum + row.readyToAccept, 0),
      utilisationPercentage: approvedIntake ? Math.round(acceptedEnrolment / approvedIntake * 100) : 0,
      openAnomalies: data.totals.totalOpenAnomalies,
      overdueAnomalies: data.totals.totalOverdue,
      escalatedAnomalies: data.totals.totalEscalated,
      programmes: data.rows.map((row) => ({ ...row, year: row.year })),
      categoryCounts,
      rows: data.rows,
      reviewQueueCount: data.reviewQueueCount,
      issueSummary: data.issueSummary
    });
  });

  app.get("/api/aicte/reports/intake", (request, response) => {
    if (!requireRole(request, response, db, "AICTE")) return;
    const data = aggregateData(db, request.query.institution && request.query.institution !== "ALL" ? request.query.institution : null);
    return response.json({ rows: data.rows, totals: data.totals, issueSummary: data.issueSummary });
  });

  app.get("/api/college/reports/summary", (request, response) => {
    if (!requireRole(request, response, db, "INSTITUTION")) return;
    const data = aggregateData(db, request.get("x-institution-id"));
    return response.json({ rows: data.rows, totals: data.totals, issueSummary: data.issueSummary });
  });

  app.get("/api/students", (request, response) => {
    const institutionId = request.get("x-institution-id");
    if (!institutionId) return response.status(400).json({ message: "X-Institution-Id header is required." });
    return response.json({ records: db.prepare("SELECT * FROM students WHERE institution_id = ? ORDER BY id").all(institutionId) });
  });
  app.use((error, request, response, next) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return response.status(413).json({ message: "Upload exceeds the 2 MB maximum file size." });
    }
    if (error) return response.status(400).json({ message: error.message || "Request could not be processed." });
    return next();
  });
  return app;
}

if (process.argv[1] && process.argv[1].endsWith("server/app.js")) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, () => console.log(`APAAR ingestion API listening on http://localhost:${port}`));
}
