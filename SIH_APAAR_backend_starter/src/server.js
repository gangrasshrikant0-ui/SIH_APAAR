import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { parse } from "csv-parse/sync";
import approvalMaster from "./data/approvalMaster.json" with { type: "json" };
import { validateBatch } from "./validationEngine.js";

const app = express();
const port = Number(process.env.PORT || 5000);
const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(cors({ origin }));
app.use(express.json({ limit: "2mb" }));

// Prototype-only in-memory submission store. Data resets when the server restarts.
const batches = new Map();

app.get("/api/health", (_req, res) => res.json({
  ok: true, service: "SIH APAAR demo validation API", mode: "SYNTHETIC_DEMO_ONLY"
}));

app.get("/api/v1/institutions", (_req, res) => {
  res.json({ mode: "SYNTHETIC_DEMO_ONLY", institutions: approvalMaster.institutions });
});

app.post("/api/v1/validate", (req, res, next) => {
  try {
    const { records, institutionId, academicYear } = req.body || {};
    if (!Array.isArray(records)) return res.status(400).json({ error: "Expected JSON body with a records array." });
    const report = validateBatch(records, { institutionId, academicYear });
    res.json(report);
  } catch (error) { next(error); }
});

app.post("/api/v1/validate-csv", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Attach a CSV file using form field 'file'." });
    const csvRecords = parse(req.file.buffer.toString("utf8").replace(/^\uFEFF/, ""), {
      columns: true, skip_empty_lines: true, trim: true, bom: true,
      relax_column_count: false
    });
    const report = validateBatch(csvRecords, {
      institutionId: req.body.institutionId || "INST-001",
      academicYear: req.body.academicYear || approvalMaster.academicYear
    });
    res.json({ ...report, fileName: req.file.originalname });
  } catch (error) { next(error); }
});

app.post("/api/v1/batches", (req, res, next) => {
  try {
    const { records, institutionId, academicYear } = req.body || {};
    if (!Array.isArray(records)) return res.status(400).json({ error: "Expected JSON body with a records array." });
    const report = validateBatch(records, { institutionId, academicYear });
    const batchId = `DEMO-BATCH-${Date.now()}`;
    const batch = { batchId, createdAt: new Date().toISOString(), ...report };
    batches.set(batchId, batch);
    res.status(201).json(batch);
  } catch (error) { next(error); }
});

app.get("/api/v1/batches/:batchId", (req, res) => {
  const batch = batches.get(req.params.batchId);
  if (!batch) return res.status(404).json({ error: "Batch not found." });
  res.json(batch);
});

app.get("/api/v1/college/:institutionId/summary", (req, res) => {
  const institutionBatches = [...batches.values()].filter(b => b.institution.id === req.params.institutionId);
  const records = institutionBatches.flatMap(b => b.records);
  res.json({
    mode: "SYNTHETIC_DEMO_ONLY",
    institutionId: req.params.institutionId,
    submittedBatches: institutionBatches.length,
    submittedRecords: records.length,
    validRecords: records.filter(r => r.validationStatus === "VALID").length,
    flaggedRecords: records.filter(r => r.validationStatus === "FLAGGED").length,
    pendingReview: records.filter(r => r.validationStatus === "PENDING_REVIEW").length
  });
});

app.get("/api/v1/aicte/summary", (_req, res) => {
  const allBatches = [...batches.values()];
  const allRecords = allBatches.flatMap(b => b.records);
  const institutionIds = new Set(allBatches.map(b => b.institution.id));
  res.json({
    mode: "SYNTHETIC_DEMO_ONLY",
    institutionsWithSubmissions: institutionIds.size,
    submittedBatches: allBatches.length,
    submittedRecords: allRecords.length,
    validRecords: allRecords.filter(r => r.validationStatus === "VALID").length,
    flaggedRecords: allRecords.filter(r => r.validationStatus === "FLAGGED").length,
    pendingReview: allRecords.filter(r => r.validationStatus === "PENDING_REVIEW").length,
    reviewQueue: allRecords.filter(r => r.validationStatus !== "VALID").map(r => ({
      studentId: r.studentId, studentName: r.studentName, apaarId: r.apaarId,
      institutionId: allBatches.find(b => b.records.includes(r))?.institution.id,
      validationStatus: r.validationStatus, issues: r.issues
    }))
  });
});

app.use((error, _req, res, _next) => {
  const status = error?.name === "MulterError" ? 400 : 500;
  res.status(status).json({ error: error.message || "Internal server error." });
});

app.listen(port, () => {
  console.log(`SIH APAAR demo API listening on http://localhost:${port}`);
  console.log("WARNING: synthetic demo only; not connected to official APAAR/AICTE services.");
});
