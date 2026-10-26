import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { APPROVAL_MASTER } from "../src/mocks/approvalMasterMock.js";

export function createDatabase(databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "apaar.sqlite")) {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      apaar_id TEXT NOT NULL,
      programme TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      category TEXT NOT NULL,
      oci_status TEXT,
      foreign_national_status TEXT,
      nri_status TEXT,
      supernumerary_seats INTEGER NOT NULL DEFAULT 0,
      gender TEXT,
      admission_date TEXT,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UPLOADED',
      created_at TEXT NOT NULL,
      record_reference TEXT,
      consent_for_external_verification INTEGER NOT NULL DEFAULT 1,
      revoked INTEGER NOT NULL DEFAULT 0
      ,batch_id TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS students_institution_student_id
      ON students (institution_id, student_id);
    DROP INDEX IF EXISTS students_apaar_id;
    CREATE INDEX IF NOT EXISTS students_apaar_id
      ON students (apaar_id);
    CREATE TABLE IF NOT EXISTS ingestion_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id TEXT NOT NULL,
      source TEXT NOT NULL,
      total INTEGER NOT NULL,
      accepted INTEGER NOT NULL,
      rejected INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS student_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      reason TEXT NOT NULL,
      field TEXT,
      responsible_party TEXT NOT NULL,
      required_action TEXT NOT NULL,
      due_date TEXT NOT NULL,
      evidence TEXT,
      batch_id TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      institution_id TEXT,
      source TEXT,
      actor TEXT,
      role TEXT,
      details TEXT NOT NULL,
      counts_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approval_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      aicte_id TEXT NOT NULL,
      campus TEXT NOT NULL,
      programme_code TEXT NOT NULL,
      programme_name TEXT NOT NULL,
      degree TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      approved_intake INTEGER NOT NULL,
      category_limits_json TEXT NOT NULL,
      supernumerary_limits_json TEXT NOT NULL,
      UNIQUE (institution_id, programme_code, academic_year)
    );
    CREATE TABLE IF NOT EXISTS demo_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS batches (
      batch_id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      source TEXT NOT NULL,
      file_name TEXT,
      uploaded_at TEXT NOT NULL,
      status TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      stored_clean INTEGER NOT NULL DEFAULT 0,
      stored_flagged INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0
    );
  `);
  const studentColumns = db.prepare("PRAGMA table_info(students)").all().map((column) => column.name);
  if (!studentColumns.includes("nri_status")) db.exec("ALTER TABLE students ADD COLUMN nri_status TEXT");
  const auditColumns = db.prepare("PRAGMA table_info(audit_log)").all().map((column) => column.name);
  if (!auditColumns.includes("actor")) db.exec("ALTER TABLE audit_log ADD COLUMN actor TEXT");
  if (!auditColumns.includes("role")) db.exec("ALTER TABLE audit_log ADD COLUMN role TEXT");
  const optionalStudentColumns = db.prepare("PRAGMA table_info(students)").all().map((column) => column.name);
  if (!optionalStudentColumns.includes("record_reference")) db.exec("ALTER TABLE students ADD COLUMN record_reference TEXT");
  if (!optionalStudentColumns.includes("consent_for_external_verification")) db.exec("ALTER TABLE students ADD COLUMN consent_for_external_verification INTEGER NOT NULL DEFAULT 1");
  if (!optionalStudentColumns.includes("revoked")) db.exec("ALTER TABLE students ADD COLUMN revoked INTEGER NOT NULL DEFAULT 0");
  if (!optionalStudentColumns.includes("batch_id")) db.exec("ALTER TABLE students ADD COLUMN batch_id TEXT");
  const issueColumns = db.prepare("PRAGMA table_info(student_issues)").all().map((column) => column.name);
  if (!issueColumns.includes("batch_id")) db.exec("ALTER TABLE student_issues ADD COLUMN batch_id TEXT");
  const approvalCount = db.prepare("SELECT COUNT(*) AS count FROM approval_master").get().count;
  if (approvalCount === 0) {
    const insertApproval = db.prepare(`
      INSERT INTO approval_master (
        institution_id, institution_name, aicte_id, campus, programme_code,
        programme_name, degree, academic_year, approved_intake,
        category_limits_json, supernumerary_limits_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAll = db.transaction(() => {
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
    });
    insertAll();
  }
  return db;
}

export function closeDatabase(db) {
  db.close();
}
