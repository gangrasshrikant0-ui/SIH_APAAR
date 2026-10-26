import fs from "node:fs";
import path from "node:path";
import { createDatabase, closeDatabase } from "../server/db.js";
import { APPROVAL_MASTER } from "../src/mocks/approvalMasterMock.js";

function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnv();
const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "apaar.sqlite");
if (databasePath !== ":memory:") {
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
}

const db = createDatabase(databasePath);
db.prepare("INSERT INTO demo_meta (key, value) VALUES ('seedVersion', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
  .run(`demo-${Date.now()}`);
const insertApproval = db.prepare(`
  INSERT INTO approval_master (
    institution_id, institution_name, aicte_id, campus, programme_code,
    programme_name, degree, academic_year, approved_intake,
    category_limits_json, supernumerary_limits_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(institution_id, programme_code, academic_year) DO UPDATE SET
    institution_name=excluded.institution_name, aicte_id=excluded.aicte_id,
    campus=excluded.campus, programme_name=excluded.programme_name,
    degree=excluded.degree, approved_intake=excluded.approved_intake,
    category_limits_json=excluded.category_limits_json,
    supernumerary_limits_json=excluded.supernumerary_limits_json
`);
for (const institution of APPROVAL_MASTER.institutions) {
  for (const programme of institution.programmes) {
    insertApproval.run(
      institution.id, institution.name, institution.aicteId, institution.campus,
      programme.code, programme.name, programme.degree, APPROVAL_MASTER.academicYear,
      programme.approvedIntake, JSON.stringify(programme.categoryLimits),
      JSON.stringify(programme.supernumerarySeats)
    );
  }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS demo_institutions (
    institution_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    programmes_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
const institutions = [
  ["INST-001", "PICT Pune", [["Computer Engineering", 120, 60], ["Information Technology", 120, 60], ["Artificial Intelligence & Data Science", 60, 30]]],
  ["INST-002", "COEP Tech", [["Computer Engineering", 150, 100], ["Mechanical Engineering", 120, 80], ["Electronics & Telecommunication", 120, 80]]],
  ["INST-003", "VJTI Mumbai", [["Computer Engineering", 120, 70], ["Information Technology", 120, 70], ["Electronics & Telecommunication", 120, 70]]]
];
const insertInstitution = db.prepare("INSERT INTO demo_institutions VALUES (?, ?, ?, ?)");
for (const [id, name, programmes] of institutions) {
  insertInstitution.run(id, name, JSON.stringify(programmes), new Date().toISOString());
}

const insert = db.prepare(`
  INSERT INTO students (
    institution_id, student_id, student_name, apaar_id, programme, year_of_study,
    category, oci_status, foreign_national_status, nri_status, supernumerary_seats,
    gender, admission_date, source, status, created_at, record_reference,
    consent_for_external_verification, revoked
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const now = new Date().toISOString();
for (let institutionIndex = 0; institutionIndex < institutions.length; institutionIndex += 1) {
  const [institutionId, institutionName, programmes] = institutions[institutionIndex];
  for (let index = 1; index <= 20; index += 1) {
    const accepted = index <= 5;
    const crossInstitutionApaar = index === 20 ? "900000000001" : `${institutionIndex + 1}${String(index).padStart(11, "0")}`;
    const seededIssue = institutionId === "INST-001" && index >= 6 && index <= 11
      ? [
        ["MISSING_APAAR_ID", "APAAR ID is missing in the institutional record.", "apaarId"],
        ["WRONG_FORMAT", "APAAR ID has 11 digits; exactly 12 numeric digits are required.", "apaarId"],
        ["COURSE_MAPPING_ERROR", "Programme is not approved for this campus.", "programme"],
        ["INTAKE_EXCEEDED", "Computer Engineering admissions reached 125, exceeding approved intake of 120 seats.", "programme"],
        ["SEAT_CATEGORY_LIMIT_EXCEEDED", "NRI/FN category reached 8 admitted students versus a limit of 5.", "category"],
        ["INCONSISTENT_DATE", "Admission date is not a valid calendar date.", "admissionDate"]
      ][index - 6]
      : null;
    const revoked = institutionId === "INST-001" && index === 4;
    const noConsent = institutionId === "INST-002" && index === 5;
    const reference = accepted ? `DEMO-${institutionId}-${String(index).padStart(3, "0")}` : null;
    const apaarId = seededIssue?.[0] === "MISSING_APAAR_ID" ? "" :
      seededIssue?.[0] === "WRONG_FORMAT" ? "12345678901" : crossInstitutionApaar;
    const baseProgramme = programmes[(index - 1) % programmes.length][0];
    const programme = seededIssue?.[0] === "COURSE_MAPPING_ERROR" ? "Aviation Engineering" : baseProgramme;
    const admissionDate = seededIssue?.[0] === "INCONSISTENT_DATE" ? "2026-99-99" : "2026-07-01";
    const status = accepted ? "ACCEPTED" : seededIssue ? "ACTION_REQUIRED" : "UPLOADED";
    const result = insert.run(
      institutionId, `DEMO-${institutionId}-${String(index).padStart(3, "0")}`,
      `${institutionName} Student ${index}`, apaarId,
      programme || programmes[(index - 1) % programmes.length][0], "Year 1",
      seededIssue?.[0] === "SEAT_CATEGORY_LIMIT_EXCEEDED" ? "NRI_FN" : index % 4 === 0 ? "NRI_FN" : "GENERAL", "false", "false", index % 4 === 0 ? "true" : "false",
      index % 4 === 0 ? 1 : 0, index % 2 ? "F" : "M", admissionDate,
      "DEMO_SEED", status, now, reference, noConsent ? 0 : 1, revoked ? 1 : 0
    );
    if (seededIssue) {
      db.prepare("INSERT INTO student_issues (student_id, issue_type, severity, reason, field, responsible_party, required_action, due_date, evidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(result.lastInsertRowid, seededIssue[0], "HIGH", seededIssue[1], seededIssue[2], "Institution Data Officer", "Correct the record and revalidate it.", "2026-11-02", "Synthetic demo seed case.");
    }
  }
}
db.prepare("INSERT INTO audit_log (action_type, institution_id, source, actor, role, details, counts_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
  .run("DEMO_DATA_RESET", "AICTE-HQ", "DEMO_SEED", "demo-reset", "AICTE", "Synthetic demo dataset loaded.", JSON.stringify({ records: 60, institutions: 3 }), now);
closeDatabase(db);
console.log("Synthetic demo dataset loaded: 3 institutions and 60 student records.");
console.log("Clear the browser local storage before opening the demo so local staging data starts clean.");
