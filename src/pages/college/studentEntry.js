// Helpers for the Add Students table (also covered by unit tests).

export const MAX_STUDENT_ROWS = 10;

export const PROGRAMMES = [
  "Computer Engineering",
  "Information Technology",
  "Electronics & Telecommunication Engineering",
  "Artificial Intelligence & Data Science",
  "Aeronautical Engineering"
];

export const YEARS = ["FE", "SE", "TE", "BE"];

export const CATEGORIES = [
  "GENERAL", "OBC", "SC", "ST", "EWS", "TFWS", "NRI_FN"
];

export function createEmptyStudent() {
  return {
    studentId: "",
    studentName: "",
    apaarId: "",
    programme: "Computer Engineering",
    yearOfStudy: "FE",
    category: "GENERAL",
    gender: "",
    admissionDate: ""
  };
}

export function addStudentRow(rows) {
  if (rows.length >= MAX_STUDENT_ROWS) return rows;
  return [...rows, createEmptyStudent()];
}

export function removeStudentRow(rows, index) {
  if (rows.length <= 1) return rows;
  return rows.filter((_, i) => i !== index);
}

export function clearStudentRows() {
  return [createEmptyStudent()];
}

export function isBlankStudent(student) {
  return !student.studentId?.trim() && !student.studentName?.trim() && !student.apaarId?.trim();
}

export function rowsReadyToStage(rows) {
  return rows.filter((r) => !isBlankStudent(r));
}
