import approvalMaster from "./data/approvalMaster.json" with { type: "json" };
import apaarRegistry from "./data/apaarRegistry.json" with { type: "json" };

const clean = (v) => String(v ?? "").trim();
const norm = (v) => clean(v).toLowerCase().replace(/[^a-z0-9]/g, "");

function findProgramme(institution, value) {
  const key = norm(value);
  return institution?.programmes.find(p => norm(p.code) === key || norm(p.name) === key ||
    (key && norm(p.name).includes(key)) || (key && key.includes(norm(p.name))));
}

export function validateBatch(inputRecords, { institutionId = "INST-001", academicYear = approvalMaster.academicYear } = {}) {
  if (!Array.isArray(inputRecords)) throw new Error("records must be an array");
  const institution = approvalMaster.institutions.find(i => i.id === institutionId);
  if (!institution) throw new Error(`Unknown demo institutionId '${institutionId}'.`);
  const seen = new Map();
  const records = inputRecords.map((raw, index) => ({
    id: clean(raw.id) || `ROW-${String(index + 1).padStart(3, "0")}`,
    studentId: clean(raw.studentId ?? raw.prn ?? raw.rollNo),
    studentName: clean(raw.studentName ?? raw.name),
    apaarId: clean(raw.apaarId ?? raw.apaar_id ?? raw.APAAR_ID),
    programme: clean(raw.programme ?? raw.programmeCode ?? raw.course),
    yearOfStudy: clean(raw.yearOfStudy ?? raw.academicYearOfStudy ?? raw.year),
    academicYear: clean(raw.academicYear) || academicYear,
    category: clean(raw.category ?? raw.seatCategory) || "UNKNOWN",
    ociStatus: clean(raw.ociStatus ?? raw.oci_status) || "NOT_RECORDED",
    foreignNationalStatus: clean(raw.foreignNationalStatus ?? raw.fnStatus ?? raw.fn_status) || "NOT_RECORDED",
    supernumerarySeats: Number(raw.supernumerarySeats ?? raw.supernumerary_seats ?? 0),
    admissionDate: clean(raw.admissionDate ?? raw.admission_date)
  }));
  for (const r of records) {
    if (r.apaarId) seen.set(r.apaarId, [...(seen.get(r.apaarId) || []), r.id]);
  }
  const programmeCounts = new Map();
  const results = records.map(r => {
    const issues = [];
    const add = (code, severity, message, status = "ACTION_REQUIRED") => issues.push({ code, severity, message, status });
    for (const field of ["studentId", "studentName", "apaarId", "programme", "yearOfStudy"]) {
      if (!r[field]) add("MISSING_FIELD", "ERROR", `Required field '${field}' is missing.`);
    }
    if (r.apaarId && !/^\d{12}$/.test(r.apaarId)) add("INVALID_APAAR_FORMAT", "ERROR", "APAAR ID must contain exactly 12 digits. Format validation is not identity verification.");
    if (r.apaarId && (seen.get(r.apaarId) || []).length > 1) add("DUPLICATE_IN_BATCH", "ERROR", `APAAR ID appears in ${seen.get(r.apaarId).length} row(s) in this upload.`);
    const programme = findProgramme(institution, r.programme);
    if (!programme) {
      if (r.programme) add("UNAPPROVED_PROGRAMME", "ERROR", `Programme '${r.programme}' was not found in this institution's synthetic approval reference.`);
    } else {
      r.programmeCode = programme.code;
      const countKey = `${programme.code}|${r.academicYear}`;
      programmeCounts.set(countKey, (programmeCounts.get(countKey) || 0) + 1);
    }
    let apaarCheck = "NOT_CHECKED";
    if (/^\d{12}$/.test(r.apaarId)) {
      const match = apaarRegistry.records.find(x => x.apaarId === r.apaarId);
      if (!match) apaarCheck = "NO_DEMO_REFERENCE_MATCH";
      else if (norm(match.name) !== norm(r.studentName)) {
        apaarCheck = "DEMO_NAME_MISMATCH";
        add("DEMO_REFERENCE_NAME_MISMATCH", "WARNING", "Name differs from the synthetic demo reference; manual review required.", "PENDING_REVIEW");
      } else apaarCheck = "DEMO_REFERENCE_MATCH";
    }
    r.apaarCheck = apaarCheck;
    r.validationStatus = issues.some(x => x.severity === "ERROR") ? "FLAGGED" :
      issues.length ? "PENDING_REVIEW" : "VALID";
    r.issues = issues;
    r.verificationDisclaimer = "Synthetic demo checks only. No official APAAR identity verification is connected.";
    return r;
  });
  // Counts represent rows in this submitted batch, not confirmed institution-wide enrolment.
  const programmeSummary = [...programmeCounts.entries()].map(([key, submittedCount]) => {
    const [programmeCode, year] = key.split("|");
    const p = institution.programmes.find(x => x.code === programmeCode);
    const issues = [];
    if (submittedCount > p.approvedIntake) issues.push({
      code: "POSSIBLE_INTAKE_EXCESS", severity: "WARNING",
      message: `${submittedCount} submitted rows for ${p.name} exceed demo approved intake ${p.approvedIntake}. Check repository totals, academic year, and applicable seat rules.`,
      status: "PENDING_REVIEW"
    });
    return { programmeCode, programme: p.name, academicYear: year, submittedRows: submittedCount, approvedIntake: p.approvedIntake, issues };
  });
  const counts = {
    total: results.length,
    valid: results.filter(r => r.validationStatus === "VALID").length,
    flagged: results.filter(r => r.validationStatus === "FLAGGED").length,
    pendingReview: results.filter(r => r.validationStatus === "PENDING_REVIEW").length,
    errors: results.reduce((n,r) => n + r.issues.filter(i => i.severity === "ERROR").length, 0),
    warnings: results.reduce((n,r) => n + r.issues.filter(i => i.severity === "WARNING").length, 0)
  };
  return {
    mode: "SYNTHETIC_DEMO_ONLY",
    institution: { id: institution.id, name: institution.name, aicteId: institution.aicteId },
    academicYear,
    counts, programmeSummary, records: results,
    disclaimer: "This prototype uses synthetic reference data. APAAR format/reference matches are not official identity verification. Intake flags require review and are not findings of misconduct."
  };
}
