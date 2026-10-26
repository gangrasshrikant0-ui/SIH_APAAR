const REQUIRED_FIELDS = ["studentId", "studentName", "programme", "yearOfStudy"];
const BOOLEAN_FIELDS = ["ociStatus", "foreignNationalStatus", "nriStatus"];

function parseBoolean(value, field) {
  if (value === "" || value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["not_applicable", "not_recorded", "na", "n/a"].includes(normalized)) return false;
  if (["confirmed"].includes(normalized)) return true;
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  throw new Error(`${field} must be true/false, yes/no, or 1/0.`);
}

export function normalizeStudent(input = {}) {
  const normalized = {
    studentId: String(input.studentId || "").trim(),
    studentName: String(input.studentName || "").trim(),
    apaarId: String(input.apaarId || "").trim(),
    programme: String(input.programme || "").trim(),
    yearOfStudy: String(input.yearOfStudy || "").trim(),
    category: String(input.category || "").trim(),
    ociStatus: input.ociStatus || "",
    foreignNationalStatus: input.foreignNationalStatus || "",
    nriStatus: input.nriStatus || input.nri || "",
    supernumerarySeats: Number(input.supernumerarySeats || 0),
    gender: String(input.gender || "").trim(),
    admissionDate: String(input.admissionDate || "").trim(),
    institutionId: input.institutionId ? String(input.institutionId).trim() : ""
  };
  for (const field of BOOLEAN_FIELDS) normalized[field] = parseBoolean(normalized[field], field);
  return normalized;
}

export function validateStorageFields(student) {
  return REQUIRED_FIELDS
    .filter((field) => !student[field])
    .map((field) => ({ field, message: `${field} is required.` }));
}

export function validateStudent(student) {
  const errors = validateStorageFields(student);
  if (!Number.isInteger(student.supernumerarySeats) || student.supernumerarySeats < 0) {
    errors.push({ field: "supernumerarySeats", message: "Supernumerary seats must be a non-negative whole number." });
  }
  return errors;
}

export function businessIssues(student) {
  const issues = [];
  if (!student.apaarId) {
    issues.push({
      issueType: "MISSING_APAAR_ID",
      severity: "HIGH",
      reason: "APAAR ID field is empty or missing in institutional record.",
      field: "apaarId",
      responsibleParty: "Institution Data Officer",
      requiredAction: "Provide a valid 12-digit numeric APAAR ID.",
      evidence: "Field 'apaarId' contains an empty value."
    });
  } else if (!/^\d{12}$/.test(student.apaarId)) {
    issues.push({
      issueType: "WRONG_FORMAT",
      severity: "HIGH",
      reason: `APAAR ID '${student.apaarId}' must be exactly 12 numeric digits (format-checked, not identity-verified).`,
      field: "apaarId",
      responsibleParty: "Institution Data Officer",
      requiredAction: "Correct APAAR ID to exactly 12 numeric digits.",
      evidence: "Non-numeric characters or invalid length detected."
    });
  }
  if (student.programme.toLowerCase().includes("aero") || student.programme.toLowerCase().includes("aviation")) {
    issues.push({
      issueType: "COURSE_MAPPING_ERROR",
      severity: "HIGH",
      reason: `Programme '${student.programme}' is not approved for this campus in AICTE Approval Master.`,
      field: "programme",
      responsibleParty: "Data Officer + Master-Data Admin",
      requiredAction: "Reassign student to an approved programme.",
      evidence: "Approval Master sanction missing for this programme."
    });
  }
  return issues;
}

export { REQUIRED_FIELDS };
