import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../server/app.js";
import { createDatabase, closeDatabase } from "../server/db.js";
import { APPROVAL_MASTER } from "../src/mocks/approvalMasterMock.js";

const institution = "INST-001";
const headers = { "X-Institution-Id": institution };
const institutionHeaders = { ...headers, "X-Role": "INSTITUTION" };
const validStudent = {
  studentId: "FE-COMP-001",
  studentName: "Aarav Sharma",
  apaarId: "111122223333",
  programme: "Computer Engineering",
  yearOfStudy: "FE",
  category: "GENERAL"
};

function createTestApp() {
  const db = createDatabase(":memory:");
  return { app: createApp({ db }), db };
}

function csv(rows) {
  return [
    "PRN,Student Full Name,APAAR ID (12 Digits),Degree & Programme,Academic Year of Study,Seat Category",
    ...rows
  ].join("\n");
}

function xlsxBuffer(sheets) {
  const escapeXml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const sheetXml = (rows) => `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => `<c r="${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    "_rels/.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheet.rows); });
  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value >>> 0;
  });
  const crc32 = (buffer) => {
    let value = 0xffffffff;
    for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
  };
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(content);
    const header = Buffer.alloc(30 + nameBuffer.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(nameBuffer.length, 26);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt32LE(crc32(data), 14);
    nameBuffer.copy(header, 30);
    local.push(header, data);
    const entry = Buffer.alloc(46 + nameBuffer.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(nameBuffer.length, 28);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(offset, 42);
    nameBuffer.copy(entry, 46);
    central.push(entry);
    offset += header.length + data.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files ? Object.keys(files).length : 0, 8);
  end.writeUInt16LE(files ? Object.keys(files).length : 0, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuffer, end]);
}

const xlsxSheets = (secondRows = null) => [
  { name: "First", rows: [
    ["PRN", "Student Full Name", "APAAR ID (12 Digits)", "Degree & Programme", "Academic Year of Study", "Seat Category"],
    ["XLSX-001", "Mapped Student", "123456789012", "Computer Engineering", "FE", "GENERAL"]
  ] },
  ...(secondRows ? [{ name: "Second", rows: secondRows }] : [])
];

test("bulk uploads return a retrievable batch and accept XLSX, BOM CSV, and mappings", async () => {
  const { app, db } = createTestApp();
  const xlsx = xlsxBuffer([{ name: "Students", rows: [
    ["College PRN", "Name", "Code", "Course", "Year", "Category"],
    ["XLSX-001", "Mapped Student", "123456789012", "Computer Engineering", "FE", "GENERAL"]
  ] }]);
  const result = await request(app).post("/api/students/bulk").set(headers)
    .field("mapping", JSON.stringify({ studentId: "College PRN", studentName: "Name", apaarId: "Code", programme: "Course", yearOfStudy: "Year", category: "Category" }))
    .attach("file", xlsx, "students.xlsx");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.match(result.body.batchId, /^BATCH-\d{4}$/);
  assert.equal((await request(app).get(`/api/batches/${result.body.batchId}`).set(headers)).status, 200);
  assert.equal(result.body.storedClean, 1);
  const bom = Buffer.from(`\uFEFF${csv(["BOM-001,BOM Student,123456789013,Computer Engineering,FE,GENERAL"])}`);
  const bomResult = await request(app).post("/api/students/bulk").set(headers).attach("file", bom, "bom.csv");
  assert.equal(bomResult.status, 200);
  closeDatabase(db);
});

test("valid individual ingestion stores a clean UPLOADED record", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(headers).send(validStudent);
  assert.equal(response.status, 201);
  assert.match(response.body.batchId, /^BATCH-\d{4}$/);
  const batchResponse = await request(app).get(`/api/batches/${response.body.batchId}`).set(headers);
  assert.equal(batchResponse.status, 200);
  assert.equal(batchResponse.body.batchId, response.body.batchId);
  assert.deepEqual(
    { total: response.body.total, storedClean: response.body.storedClean, storedFlagged: response.body.storedFlagged, rejected: response.body.rejected },
    { total: 1, storedClean: 1, storedFlagged: 0, rejected: 0 }
  );
  assert.equal(response.body.records[0].status, "UPLOADED");
  closeDatabase(db);
});

test("another institution cannot read a batch or its issues and the attempt is audited", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, apaarId: "123" });
  const otherHeaders = { "X-Institution-Id": "INST-002" };
  const batch = response.body.batchId;
  const batchResponse = await request(app).get(`/api/batches/${batch}`).set(otherHeaders);
  const issuesResponse = await request(app).get(`/api/batches/${batch}/issues`).set(otherHeaders);
  assert.equal(batchResponse.status, 403);
  assert.equal(issuesResponse.status, 403);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action_type = 'UNAUTHORIZED_ACCESS_ATTEMPT'").get().count, 2);
  closeDatabase(db);
});

test("bulk upload rejects invalid, empty, header-only, and oversized files clearly", async () => {
  const cases = [
    { name: "notes.csv", content: Buffer.from("this is not a csv record") },
    { name: "empty.csv", content: Buffer.alloc(0) },
    { name: "headers.csv", content: Buffer.from("PRN,Student Full Name,APAAR ID (12 Digits),Degree & Programme,Academic Year of Study,Seat Category\n") },
    { name: "oversized.csv", content: Buffer.alloc((2 * 1024 * 1024) + 1, "a") }
  ];
  for (const upload of cases) {
    const { app, db } = createTestApp();
    const response = await request(app).post("/api/students/bulk").set(headers).attach("file", upload.content, upload.name);
    assert.ok([400, 413].includes(response.status), `${upload.name}: ${response.status}`);
    const message = response.body.message || response.body.errors?.[0]?.message;
    assert.ok(message && message.length > 0, `${upload.name}: missing readable message`);
    assert.equal(message.includes("Error:"), false);
    assert.equal(message.includes("at "), false);
    closeDatabase(db);
  }
});

test("mapping errors name an unmapped required field and a missing source column", async () => {
  const { app, db } = createTestApp();
  const file = Buffer.from(csv(["MAP-001,Mapped Student,123456789012,Computer Engineering,FE,GENERAL"]));
  const unmapped = await request(app).post("/api/students/bulk").set(headers)
    .field("mapping", JSON.stringify({ studentId: "PRN", studentName: "Student Full Name", apaarId: "", programme: "Degree & Programme", yearOfStudy: "Academic Year of Study", category: "Seat Category" }))
    .attach("file", file, "mapped.csv");
  assert.equal(unmapped.status, 400);
  assert.match(unmapped.body.errors[0].message, /apaarId/);
  const missingColumn = await request(app).post("/api/students/bulk").set(headers)
    .field("mapping", JSON.stringify({ studentId: "Not In File", studentName: "Student Full Name", apaarId: "APAAR ID (12 Digits)", programme: "Degree & Programme", yearOfStudy: "Academic Year of Study", category: "Seat Category" }))
    .attach("file", file, "mapped.csv");
  assert.equal(missingColumn.status, 400);
  assert.match(missingColumn.body.errors[0].message, /studentId|Not In File/);
  closeDatabase(db);
});

test("XLSX ingestion uses only the first worksheet", async () => {
  const { app, db } = createTestApp();
  const workbook = xlsxBuffer(xlsxSheets([
    ["PRN", "Student Full Name", "APAAR ID (12 Digits)", "Degree & Programme", "Academic Year of Study", "Seat Category"],
    ["SECOND-001", "Second Sheet", "123456789015", "Computer Engineering", "FE", "GENERAL"]
  ]));
  const response = await request(app).post("/api/students/bulk").set(headers)
    .attach("file", workbook, "students.xlsx");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.records.map((record) => record.studentId), ["XLSX-001"]);
  closeDatabase(db);
});

test("corrupt XLSX returns a clear 400 without a stack trace", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students/bulk").set(headers)
    .attach("file", Buffer.from("PK\x03\x04not-a-workbook"), "corrupt.xlsx");
  assert.equal(response.status, 400);
  const message = response.body.errors?.[0]?.message || response.body.message;
  assert.match(message, /Invalid upload|spreadsheet|XLSX/i);
  assert.equal(message.includes(" at "), false);
  closeDatabase(db);
});

test("rejected rows are not stored and batch counts match the response", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set(headers).send({ ...validStudent, studentId: "DUP-001" });
  const response = await request(app).post("/api/students/bulk").set(headers).attach("file", Buffer.from(csv([
    "DUP-001,Duplicate,123456789016,Computer Engineering,FE,GENERAL",
    "CLEAN-001,Clean Student,123456789017,Computer Engineering,FE,GENERAL",
    "FLAG-001,Flagged Student,123,Computer Engineering,FE,GENERAL"
  ])), "counts.csv");
  assert.equal(response.status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM students WHERE student_id = 'DUP-001'").get().count, 1);
  const batch = await request(app).get(`/api/batches/${response.body.batchId}`).set(headers);
  assert.equal(batch.body.storedClean, response.body.storedClean);
  assert.equal(batch.body.storedFlagged, response.body.storedFlagged);
  assert.equal(batch.body.rejected, response.body.rejected);
  assert.equal(batch.body.rejected, 1);
  closeDatabase(db);
});

test("bad APAAR is stored as ACTION_REQUIRED with a persisted issue", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, apaarId: "123" });
  assert.equal(response.status, 201);
  assert.equal(response.body.records[0].status, "ACTION_REQUIRED");
  assert.equal(response.body.issues[0].issueType, "WRONG_FORMAT");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM student_issues").get().count, 1);
  closeDatabase(db);
});

test("bulk ingestion stores flagged rows and rejects only missing storage fields", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students/bulk").set(headers).attach("file", Buffer.from(csv([
    "FE-COMP-001,Aarav Sharma,111122223333,Computer Engineering,FE,GENERAL",
    "FE-COMP-002,Invalid APAAR,123,Computer Engineering,FE,GENERAL",
    "FE-COMP-003,,222233334444,Computer Engineering,FE,GENERAL"
  ])), "students.csv");
  assert.equal(response.status, 200);
  assert.equal(response.body.total, 3);
  assert.equal(response.body.storedClean, 1);
  assert.equal(response.body.storedFlagged, 1);
  assert.equal(response.body.rejected, 1);
  assert.equal(response.body.records.find((record) => record.studentId === "FE-COMP-002").status, "ACTION_REQUIRED");
  assert.equal(response.body.errors[0].row, 4);
  closeDatabase(db);
});

test("same APAAR twice in a file flags both rows and APAAR is not globally unique", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students/bulk").set(headers).attach("file", Buffer.from(csv([
    "FE-COMP-001,Aarav Sharma,111122223333,Computer Engineering,FE,GENERAL",
    "FE-COMP-002,Another Student,111122223333,Computer Engineering,FE,GENERAL"
  ])), "students.csv");
  assert.equal(response.body.storedFlagged, 2);
  assert.equal(response.body.records.every((record) => record.status === "ACTION_REQUIRED"), true);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM students").get().count, 2);
  closeDatabase(db);
});

test("cross-institution APAAR is stored as pending review without leaking other institution", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002" }).send(validStudent);
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, studentId: "FE-COMP-002" });
  assert.equal(response.body.records[0].status, "PENDING_REVIEW");
  assert.equal(response.body.issues[0].issueType, "CROSS_INSTITUTION_CONFLICT");
  assert.equal(response.body.issues[0].reason, "Active enrolment at another institution. AICTE review required.");
  assert.equal(response.body.issues[0].reason.includes("INST-002"), false);
  closeDatabase(db);
});

test("duplicate student ID returns 409", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set(headers).send(validStudent);
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, apaarId: "222233334444" });
  assert.equal(response.status, 409);
  assert.equal(response.body.errors[0].field, "studentId");
  closeDatabase(db);
});

test("missing institution header returns 400 and writes unauthorized audit", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").send(validStudent);
  assert.equal(response.status, 400);
  assert.equal(db.prepare("SELECT action_type FROM audit_log").get().action_type, "UNAUTHORIZED_ACCESS_ATTEMPT");
  closeDatabase(db);
});

test("body institution mismatch returns 403", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, institutionId: "INST-002" });
  assert.equal(response.status, 403);
  closeDatabase(db);
});

test("records persist across database restart", async () => {
  const databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "apaar-")), "test.sqlite");
  let db = createDatabase(databasePath);
  const app = createApp({ db });
  await request(app).post("/api/students").set(headers).send(validStudent);
  closeDatabase(db);
  db = createDatabase(databasePath);
  const response = await request(createApp({ db })).get("/api/students").set(headers);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].student_id, validStudent.studentId);
  closeDatabase(db);
});

test("AICTE review queue returns cross-institution issue evidence", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ ...headers, "X-Role": "INSTITUTION" }).send(validStudent);
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002", "X-Role": "INSTITUTION" }).send({ ...validStudent, studentId: "FE-COMP-002" });
  const response = await request(app).get("/api/aicte/review-queue").set({ "X-Role": "AICTE" });
  assert.equal(response.status, 200);
  assert.ok(response.body.records.some((record) => record.issueType === "CROSS_INSTITUTION_CONFLICT" && record.evidence.includes("INST-001")));
  closeDatabase(db);
});

test("institution role cannot access AICTE endpoints and creates audit row", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).get("/api/aicte/review-queue").set({ ...headers, "X-Role": "INSTITUTION" });
  assert.equal(response.status, 403);
  assert.equal(db.prepare("SELECT action_type FROM audit_log ORDER BY id DESC").get().action_type, "UNAUTHORIZED_ACCESS_ATTEMPT");
  closeDatabase(db);
});

test("institution APAAR lookup is scoped and only exposes activeElsewhere", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ ...headers, "X-Role": "INSTITUTION" }).send(validStudent);
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002", "X-Role": "INSTITUTION" }).send({ ...validStudent, studentId: "FE-COMP-002" });
  const response = await request(app).get(`/api/students/by-apaar/${validStudent.apaarId}`).set({ ...headers, "X-Role": "INSTITUTION" });
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.activeElsewhere, true);
  assert.equal(JSON.stringify(response.body).includes("INST-002"), false);
  closeDatabase(db);
});

test("AICTE APAAR lookup returns records across institutions and audits lookup", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ ...headers, "X-Role": "INSTITUTION" }).send(validStudent);
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002", "X-Role": "INSTITUTION" }).send({ ...validStudent, studentId: "FE-COMP-002" });
  const response = await request(app).get(`/api/aicte/students/by-apaar/${validStudent.apaarId}`).set({ "X-Role": "AICTE" });
  assert.equal(response.body.records.length, 2);
  const audit = await request(app).get("/api/aicte/audit").set({ "X-Role": "AICTE" });
  assert.ok(audit.body.records.some((record) => record.actionType === "APAAR_LOOKUP"));
  closeDatabase(db);
});

test("correction clears server issues and acceptance requires READY_TO_ACCEPT", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, apaarId: "bad" });
  const id = response.body.records[0].id;
  let result = await request(app).post(`/api/students/${id}/accept`).set(institutionHeaders).send({});
  assert.equal(result.status, 409);
  result = await request(app).patch(`/api/students/${id}`).set(institutionHeaders).send(validStudent);
  assert.equal(result.body.record.status, "UPLOADED");
  result = await request(app).post(`/api/students/${id}/outcome`).set(institutionHeaders).send({ status: "READY_TO_ACCEPT", issues: [] });
  assert.equal(result.body.record.status, "READY_TO_ACCEPT");
  result = await request(app).post(`/api/students/${id}/accept`).set(institutionHeaders).send({});
  assert.equal(result.body.record.status, "ACCEPTED");
  result = await request(app).post(`/api/students/${id}/outcome`).set(institutionHeaders).send({ status: "VERIFIED", issues: [] });
  assert.equal(result.status, 409);
  closeDatabase(db);
});

test("cross-institution correction remains pending review and AICTE repository is accepted-only", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002" }).send(validStudent);
  const response = await request(app).post("/api/students").set(headers).send({ ...validStudent, studentId: "LOCAL-2", apaarId: "222233334444" });
  const id = response.body.records[0].id;
  const correction = await request(app).patch(`/api/students/${id}`).set(institutionHeaders).send({ ...validStudent, studentId: "LOCAL-2" });
  assert.equal(correction.body.record.status, "PENDING_REVIEW");
  assert.equal(correction.body.record.issues[0].issueType, "CROSS_INSTITUTION_CONFLICT");
  const repository = await request(app).get("/api/aicte/repository").set({ "X-Role": "AICTE" });
  assert.equal(repository.status, 200);
  assert.equal(repository.body.records.length, 0);
  const denied = await request(app).get("/api/aicte/repository").set({ "X-Role": "INSTITUTION", "X-Institution-Id": institution });
  assert.equal(denied.status, 403);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action_type = 'UNAUTHORIZED_ACCESS_ATTEMPT'").get().count, 1);
  closeDatabase(db);
});

test("sample faulty batch matches its documented issue expectations", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002" }).send({
    ...validStudent, studentId: "SEED-CROSS-001", apaarId: "333344445555"
  });
  const file = fs.readFileSync(new URL("../samples/batch_faulty.csv", import.meta.url));
  const expected = fs.readFileSync(new URL("../samples/expected_results.csv", import.meta.url), "utf8")
    .trim().split(/\r?\n/).slice(1).map((line) => {
      const [row, issueType] = line.split(",");
      return { row: Number(row), issueType };
    });
  const response = await request(app).post("/api/students/bulk").set(headers).attach("file", file, "batch_faulty.csv");
  assert.equal(response.status, 200);
  for (const item of expected) {
    const issue = response.body.issues.find((candidate) => candidate.row === item.row && candidate.issueType === item.issueType);
    assert.ok(issue, `Expected ${item.issueType} for row ${item.row}`);
  }
  assert.equal(response.body.records.filter((record) => record.status === "ACTION_REQUIRED" || record.status === "PENDING_REVIEW").length, 5);
  closeDatabase(db);
});

test("dashboard totals match accepted repository count and reports use the same rows", async () => {
  const { app, db } = createTestApp();
  const first = await request(app).post("/api/students").set(institutionHeaders).send(validStudent);
  const firstId = first.body.records[0].id;
  await request(app).post(`/api/students/${firstId}/outcome`).set(institutionHeaders).send({ status: "READY_TO_ACCEPT", issues: [] });
  await request(app).post(`/api/students/${firstId}/accept`).set(institutionHeaders).send({});
  await request(app).post("/api/students").set(institutionHeaders).send({ ...validStudent, studentId: "UPLOADED-ONLY", apaarId: "222233334444" });
  const dashboard = await request(app).get("/api/aicte/dashboard").set({ "X-Role": "AICTE" });
  const repository = await request(app).get("/api/aicte/repository").set({ "X-Role": "AICTE" });
  const report = await request(app).get("/api/aicte/reports/intake").set({ "X-Role": "AICTE" });
  assert.equal(dashboard.body.totalAcceptedEnrolment, repository.body.records.length);
  assert.equal(dashboard.body.totalAcceptedEnrolment, 1);
  assert.deepEqual(report.body.rows, dashboard.body.rows);
  closeDatabase(db);
});

test("college dashboard is institution-scoped and AICTE dashboard rejects institution role", async () => {
  const { app, db } = createTestApp();
  await request(app).post("/api/students").set(institutionHeaders).send(validStudent);
  await request(app).post("/api/students").set({ "X-Institution-Id": "INST-002" }).send({ ...validStudent, studentId: "OTHER-1", apaarId: "222233334444" });
  const college = await request(app).get("/api/college/dashboard").set(institutionHeaders);
  assert.equal(college.status, 200);
  assert.ok(college.body.rows.every((row) => row.institutionId === institution));
  const denied = await request(app).get("/api/aicte/dashboard").set(institutionHeaders);
  assert.equal(denied.status, 403);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action_type = 'UNAUTHORIZED_ACCESS_ATTEMPT'").get().count, 1);
  closeDatabase(db);
});

test("server raises the same 125-vs-120 intake issue used by the seeded approval master", async () => {
  const { app, db } = createTestApp();
  const insert = db.prepare(`
    INSERT INTO students (institution_id, student_id, student_name, apaar_id, programme, year_of_study, category,
      oci_status, foreign_national_status, nri_status, supernumerary_seats, source, status, created_at)
    VALUES ('INST-001', ?, ?, ?, 'Computer Engineering', 'Year 1', 'GENERAL', 'false', 'false', 'false', 0, 'DEMO_SEED', 'ACCEPTED', ?)
  `);
  for (let index = 1; index <= 120; index += 1) {
    insert.run(`ACCEPTED-${index}`, `Accepted ${index}`, `700000${String(index).padStart(6, "0")}`, new Date().toISOString());
  }
  const response = await request(app).post("/api/students").set(institutionHeaders).send({
    ...validStudent, studentId: "OVER-INTAKE", apaarId: "888877776666"
  });
  assert.equal(response.body.records[0].status, "ACTION_REQUIRED");
  assert.equal(response.body.issues.some((issue) => issue.issueType === "INTAKE_EXCEEDED"), true);
  assert.equal(db.prepare("SELECT approved_intake FROM approval_master WHERE institution_id = 'INST-001' AND programme_code = 'COMP'").get().approved_intake, 120);
  closeDatabase(db);
});

test("database approval master matches the client approval master values", () => {
  const { db } = createTestApp();
  const rows = db.prepare("SELECT * FROM approval_master ORDER BY institution_id, programme_code").all();
  const expected = APPROVAL_MASTER.institutions.flatMap((institution) => institution.programmes.map((programme) => ({
    institutionId: institution.id,
    programmeCode: programme.code,
    approvedIntake: programme.approvedIntake,
    categoryLimits: JSON.stringify(programme.categoryLimits),
    supernumerarySeats: JSON.stringify(programme.supernumerarySeats)
  }))).sort((a, b) => `${a.institutionId}${a.programmeCode}`.localeCompare(`${b.institutionId}${b.programmeCode}`));
  assert.deepEqual(rows.map((row) => ({
    institutionId: row.institution_id,
    programmeCode: row.programme_code,
    approvedIntake: row.approved_intake,
    categoryLimits: row.category_limits_json,
    supernumerarySeats: row.supernumerary_limits_json
  })), expected);
  closeDatabase(db);
});

test("overdue open issues are counted by the aggregate endpoint", async () => {
  const { app, db } = createTestApp();
  const response = await request(app).post("/api/students").set(institutionHeaders).send({ ...validStudent, apaarId: "bad" });
  const id = Number(response.body.records[0].id.replace("INGEST-", ""));
  db.prepare("UPDATE student_issues SET due_date = '2000-01-01' WHERE student_id = ?").run(id);
  const dashboard = await request(app).get("/api/college/dashboard").set(institutionHeaders);
  assert.ok(dashboard.body.totalOverdue >= 1);
  closeDatabase(db);
});
