import { normalizeSyntheticApaar } from "../mocks/demoReference.js";

export const REQUIRED_CANONICAL_FIELDS = [
  "studentId",
  "studentName",
  "apaarId",
  "programme",
  "yearOfStudy",
  "category"
];

export const STANDARD_COLUMNS = [
  {
    key: "studentId",
    label: "Institutional Student ID / PRN",
    required: true,
    aliases: ["PRN", "Roll No", "RollNumber", "StudentID", "Student ID", "Registration No", "Enrollment No"]
  },
  {
    key: "studentName",
    label: "Student Full Name",
    required: true,
    aliases: ["Student Name", "Name", "Candidate Name", "StudentName", "Full Name"]
  },
  {
    key: "apaarId",
    label: "APAAR ID (12 Digits)",
    required: true,
    aliases: [
      "APAAR", "APAAR_ID", "APAAR ID", "ApaarNumber", "National Student ID",
      "Student APAAR Number", "Student APAAR ID", "APAAR Number"
    ]
  },
  {
    key: "programme",
    label: "Degree & Programme",
    required: true,
    aliases: ["Course", "Branch", "Programme", "Program", "Department", "Course Name"]
  },
  {
    key: "yearOfStudy",
    label: "Academic Year of Study",
    required: true,
    aliases: ["Year", "Class", "Semester", "YearOfStudy", "Academic Year", "Year of Study", "Study Year"]
  },
  {
    key: "category",
    label: "Seat Category",
    required: true,
    aliases: ["Category", "Quota", "Admission Category", "SeatType", "Seat Type"]
  },
  {
    key: "ociStatus",
    label: "OCI Status",
    required: false,
    aliases: ["OCI", "OCI Status", "OCI Flag"]
  },
  {
    key: "foreignNationalStatus",
    label: "Foreign National Status",
    required: false,
    aliases: ["FN", "Foreign National", "FN Status", "Foreign National Status", "Foreign National Flag"]
  },
  {
    key: "nriStatus",
    label: "NRI Status",
    required: false,
    aliases: ["NRI", "NRI Status", "NRI Flag"]
  },
  {
    key: "supernumerarySeats",
    label: "Supernumerary Seats",
    required: false,
    aliases: ["Supernumerary", "Supernumerary Seats", "SN Seats"]
  },
  {
    key: "admissionDate",
    label: "Date of Admission",
    required: false,
    aliases: ["AdmissionDate", "DOA", "JoiningDate", "Admission Date"]
  },
  {
    key: "admissionStatus",
    label: "Admission Status",
    required: false,
    aliases: ["Admission Status", "Enrolment Status", "Enrollment Status", "Status"]
  },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    required: false,
    aliases: ["DOB", "Date of Birth", "Birth Date", "Birthdate"]
  },
  {
    key: "gender",
    label: "Gender",
    required: false,
    aliases: ["Gender", "Sex"]
  },
  {
    key: "institutionId",
    label: "Institution ID",
    required: false,
    aliases: ["Institution ID", "College Code", "College ID", "Institute Code", "AICTE ID"]
  }
];

export const FIELD_ALIASES = Object.fromEntries(
  STANDARD_COLUMNS.map((column) => [column.key, [column.key, column.label, ...column.aliases]])
);

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchScore(header, column) {
  const normalized = normalizeHeader(header);
  if (!normalized) return 0;
  const candidates = [column.key, column.label, ...column.aliases].map(normalizeHeader);
  if (candidates.includes(normalized)) return 100;
  const substantial = candidates.filter((candidate) => candidate.length >= 8);
  if (substantial.some((candidate) => candidate === normalized)) return 100;
  if (normalized.length >= 10 && substantial.some((candidate) => candidate.includes(normalized) || normalized.includes(candidate))) {
    return 70;
  }
  return 0;
}

export function autoMapColumns(headers = []) {
  const used = new Set();
  const mapping = {};
  const details = {};

  for (const column of STANDARD_COLUMNS) {
    const ranked = headers
      .map((header) => ({ header, score: matchScore(header, column) }))
      .filter((item) => item.score >= 70 && !used.has(item.header))
      .sort((a, b) => b.score - a.score || b.header.length - a.header.length);

    if (!ranked.length) {
      mapping[column.key] = "";
      details[column.key] = { confidence: "unmapped", header: "" };
      continue;
    }

    const best = ranked[0];
    const ambiguous = ranked.filter((item) => item.score === best.score);
    if (ambiguous.length > 1 && best.score < 100) {
      mapping[column.key] = "";
      details[column.key] = {
        confidence: "ambiguous",
        header: "",
        candidates: ambiguous.map((item) => item.header)
      };
      continue;
    }

    mapping[column.key] = best.header;
    used.add(best.header);
    details[column.key] = {
      confidence: best.score === 100 ? "exact" : "probable",
      header: best.header,
      score: best.score
    };
  }

  const extraColumns = headers.filter((header) => !used.has(header));
  const missingRequired = REQUIRED_CANONICAL_FIELDS.filter((key) => !mapping[key]);
  const unreliable = Object.values(details).some((item) => item.confidence === "ambiguous") || missingRequired.length > 0;

  return {
    mapping,
    details,
    extraColumns,
    missingRequired,
    unreliable,
    warning: unreliable
      ? `Automatic mapping is incomplete. Map mandatory fields before staging: ${missingRequired.join(", ") || "resolve ambiguous columns"}.`
      : ""
  };
}

export function extraColumnsFor(headers = [], mapping = {}) {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((header) => header && !mapped.has(header));
}

export function recordsFromMappedRows(headers, rows, mapping) {
  const extras = extraColumnsFor(headers, mapping);
  return rows.map((row) => {
    const record = {};
    for (const [key, header] of Object.entries(mapping)) {
      const index = headers.indexOf(header);
      let value = index >= 0 ? row[index] ?? "" : "";
      if (typeof value === "string") value = value.trim();
      if (key === "apaarId") value = normalizeSyntheticApaar(value);
      if (key === "category") value = String(value || "").trim().toUpperCase().replace(/\s+/g, "_");
      if (key === "yearOfStudy") value = String(value || "").trim();
      if (key === "admissionStatus") value = String(value || "").trim().toUpperCase();
      record[key] = value;
    }
    if (extras.length) {
      record.extraFields = Object.fromEntries(
        extras.map((header) => [header, row[headers.indexOf(header)] ?? ""])
      );
    }
    return record;
  });
}

export function mappingIsComplete(mapping) {
  return REQUIRED_CANONICAL_FIELDS.every((key) => mapping[key]);
}
