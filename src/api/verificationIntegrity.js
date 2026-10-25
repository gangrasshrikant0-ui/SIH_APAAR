const INTEGRITY_FIELDS = [
  "recordReference",
  "studentId",
  "studentName",
  "apaarId",
  "institutionId",
  "programme",
  "yearOfStudy",
  "status"
  ,"verificationVersion"
];

export async function createVerificationDigest(record) {
  const payload = JSON.stringify(INTEGRITY_FIELDS.map((field) => [field, record[field] ?? ""]));
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("Verification integrity support is unavailable in this environment.");
  }
  const data = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(data), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hasValidVerificationDigest(record) {
  return Boolean(record.verificationDigest) &&
    record.verificationDigest === await createVerificationDigest(record);
}
