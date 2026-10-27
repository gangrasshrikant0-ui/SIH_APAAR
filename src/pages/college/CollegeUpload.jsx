import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Layers,
  Sparkles,
  Download,
  FileCheck
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { ingestStudentsCsv, isBackendConfigured, storedRecordsOnly } from "../../api/ingestionApi";
import { STANDARD_COLUMNS } from "../../mocks/mockBatches";
import { StatusBadge } from "../../components/StatusBadge";
import { CollegeAddStudents } from "./CollegeAddStudents";
import { getCurrentUser } from "../../mocks/mockStore";
import { readSheet } from "read-excel-file/browser";
import { parse } from "csv-parse/browser/esm/sync";

export function CollegeUpload() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshStats } = useOutletContext() || {};

  const [activeBatch, setActiveBatch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [validationStage, setValidationStage] = useState(null); // 'PARSING', 'VALIDATING', 'DONE'
  const [fileColumns, setFileColumns] = useState([]);
  const [fileRows, setFileRows] = useState([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [mappingError, setMappingError] = useState("");
  const [mappingBusy, setMappingBusy] = useState(false);
  const [ingestionSummary, setIngestionSummary] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const entryMode = searchParams.get("mode") === "manual" ? "manual" : "upload";
  const hiddenPreset = searchParams.get("preset");

  // Column mapping states
  const [mapping, setMapping] = useState({
    studentId: "PRN",
    studentName: "Student Full Name",
    apaarId: "APAAR ID (12 Digits)",
    programme: "Degree & Programme",
    yearOfStudy: "Academic Year of Study",
    category: "Seat Category",
    ociStatus: "OCI Status",
    foreignNationalStatus: "Foreign National Status",
    supernumerarySeats: "Supernumerary Seats",
    admissionDate: "Date of Admission"
  });

  const loadCurrentBatch = useCallback(async () => {
    setIsLoading(true);
    try {
      const batch = await collegeApi.getActiveBatch();
      setActiveBatch(batch);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentBatch();
  }, [loadCurrentBatch]);

  useEffect(() => {
    if (hiddenPreset === "faulty") handleLoadFaultyPreset();
    if (hiddenPreset === "clean") handleLoadCleanPreset();
  }, [hiddenPreset]);

  const parseCsv = (text) => {
    const [headerRow, ...rows] = parse(text, {
      bom: true,
      skip_empty_lines: true,
      trim: true
    });
    if (!headerRow?.length) throw new Error("The selected CSV is empty.");
    const headers = headerRow.map((value) => String(value).trim());
    if (headers.some((header) => !header)) throw new Error("The CSV header row contains an empty column.");
    return {
      headers,
      rows: rows.filter((row) => row.some((value) => String(value).trim()))
    };
  };

  const autoMap = (headers) => Object.fromEntries(STANDARD_COLUMNS.map((column) => {
    const match = headers.find((header) => [column.label, column.key, ...column.aliases]
      .some((alias) => alias.toLowerCase().replace(/[^a-z0-9]/g, "") === header.toLowerCase().replace(/[^a-z0-9]/g, "")));
    return [column.key, match || ""];
  }));

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setMappingError("Unsupported file type. Select a CSV or XLSX file.");
      return;
    }
    setSelectedFile(file);
    if (/\.xlsx$/i.test(file.name)) {
      readSheet(file).then((rows) => {
        const headers = (rows.shift() || []).map(String);
        setFileColumns(headers);
        setFileRows(rows.filter((row) => row.some(Boolean)));
        setMapping(autoMap(headers));
        setSelectedFileName(file.name);
        setMappingError("");
      }).catch(() => setMappingError("Unable to read the selected XLSX file."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result || ""));
        setFileColumns(parsed.headers);
        setFileRows(parsed.rows);
        setMapping(autoMap(parsed.headers));
        setSelectedFileName(file.name);
        setMappingError("");
      } catch (error) {
        setMappingError(error.message);
      }
    };
    reader.onerror = () => setMappingError("Unable to read the selected file.");
    reader.readAsText(file);
  };

  const handleMappedUpload = async () => {
    const required = ["studentId", "studentName", "apaarId", "programme", "yearOfStudy", "category"];
    const missing = required.filter((key) => !mapping[key]);
    const mapped = Object.values(mapping).filter(Boolean);
    if (missing.length) {
      setMappingError(`Map required fields before continuing: ${missing.join(", ")}.`);
      return;
    }
    if (new Set(mapped).size !== mapped.length) {
      setMappingError("Each file column can be mapped only once.");
      return;
    }
    setMappingBusy(true);
    try {
      const indexes = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, fileColumns.indexOf(value)]));
      const records = fileRows.map((row) => Object.fromEntries(Object.entries(indexes).map(([key, index]) => {
        const value = index >= 0 ? row[index] || "" : "";
        return [key, value instanceof Date ? value.toISOString().slice(0, 10) : value];
      })));
      const csv = [
        Object.keys(mapping).join(","),
        ...records.map((record) => Object.keys(mapping).map((key) => JSON.stringify(record[key] || "")).join(","))
      ].join("\n");
      if (isBackendConfigured()) {
        const uploadFile = selectedFile || new File([csv], selectedFileName || "students.csv", { type: "text/csv" });
        const result = await ingestStudentsCsv(uploadFile, getCurrentUser()?.id || "INST-001", selectedFile ? mapping : null);
        if (result.offline) {
          setIngestionSummary({ offline: true });
          setMappingError("Backend unavailable; file records were staged locally.");
          await collegeApi.addStudentsToStaging(records, "BULK_UPLOAD");
        } else {
          setIngestionSummary(result);
          const storedRecords = storedRecordsOnly(result);
          if (storedRecords.length) await collegeApi.addStudentsToStaging(storedRecords, "BULK_UPLOAD");
        }
        if (result.offline) {
          const batch = await collegeApi.getActiveBatch();
          setActiveBatch(batch);
          setUploadSummary({
            fileName: selectedFileName,
            addedCount: records.length,
            flaggedRowsCount: batch.flaggedRowsCount,
            clean: batch.flaggedRowsCount === 0
          });
          setMappingError("");
          return;
        }
        if (result.rejected > 0) {
          setMappingError("Some rows were rejected. Stored rows are available for validation; review the row-level errors above.");
          return;
        }
      } else {
        await collegeApi.addStudentsToStaging(records, "BULK_UPLOAD");
      }
      const batch = await collegeApi.getActiveBatch();
      setActiveBatch(batch);
      setUploadSummary({
        fileName: selectedFileName,
        addedCount: records.length,
        flaggedRowsCount: batch.flaggedRowsCount,
        clean: true
      });
      setMappingError("");
    } catch (error) {
      setMappingError(error.message || "Unable to stage the mapped records.");
    } finally {
      setMappingBusy(false);
    }
  };

  const handleLoadFaultyPreset = async () => {
    setIsUploading(true);
    setValidationStage("PARSING");
    
    setTimeout(() => {
      setValidationStage("VALIDATING");
    }, 600);

    setTimeout(async () => {
      const batch = await collegeApi.loadPresetBatch("FAULTY");
      setActiveBatch(batch);
      setUploadSummary({
        fileName: batch.fileName,
        addedCount: batch.totalRows,
        flaggedRowsCount: batch.flaggedRowsCount,
        clean: batch.flaggedRowsCount === 0,
        preset: true
      });
      setValidationStage("DONE");
      setIsUploading(false);
      if (refreshStats) refreshStats();
    }, 1400);
  };

  const handleLoadCleanPreset = async () => {
    setIsUploading(true);
    setValidationStage("PARSING");

    setTimeout(() => {
      setValidationStage("VALIDATING");
    }, 600);

    setTimeout(async () => {
      const batch = await collegeApi.loadPresetBatch("CLEAN");
      setActiveBatch(batch);
      setUploadSummary({
        fileName: batch.fileName,
        addedCount: batch.totalRows,
        flaggedRowsCount: batch.flaggedRowsCount,
        clean: true,
        preset: true
      });
      setValidationStage("DONE");
      setIsUploading(false);
      if (refreshStats) refreshStats();
    }, 1200);
  };

  const handleDownloadSampleCsv = () => {
    const institutionName = getCurrentUser()?.institutionName || "Institution";
    const csvContent = "data:text/csv;charset=utf-8," +
      "PRN,Student Full Name,APAAR ID (12 Digits),Degree & Programme,Academic Year of Study,Seat Category,OCI Status,Foreign National Status,Supernumerary Seats,Date of Admission\n" +
      "SE-COMP-001,Aarav Sharma,111122223333,Computer Engineering,SE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-01\n" +
      "SE-COMP-012,Rajesh Sharma,,Computer Engineering,SE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-10\n" +
      "SE-COMP-025,Ananya Patil,98234-ABCD,Computer Engineering,SE,OBC,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-12\n" +
      "SE-COMP-004,Vikram Joshi,234567890123,Computer Engineering,SE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-05\n" +
      "SE-COMP-018,Sneha Roy,234567890123,Computer Engineering,SE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-11\n" +
      "TE-IT-008,Rohan Kulkarni,345678901234,Information Technology,TE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-14\n" +
      "FE-COMP-125,Arjun Deshmukh,456789012345,Computer Engineering,FE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-20\n" +
      "SE-COMP-067,Tariq Al-Mansoor,567890123456,Computer Engineering,SE,NRI_FN,NOT_RECORDED,NOT_RECORDED,1,2026-08-18\n" +
      "FE-AERO-001,Priya Nambiar,678901234567,B.Tech Aeronautical Engineering,FE,GENERAL,NOT_APPLICABLE,NOT_APPLICABLE,0,2026-08-16\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${institutionName.replace(/[^A-Za-z0-9]+/g, "_")}_Student_Batch_Sample.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    // handleLoadFaultyPreset();
  };

  return (
    <div className="gov-container">
      {/* Page Title & Explanation */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Batch Upload & Data Ingestion
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", maxWidth: "840px" }}>
          Upload and map student admission data into the institutional record schema. Submitted records are checked against approved academic rules; no live ERP connection is configured.
        </p>
      </div>
      <div className="filter-bar" role="tablist" aria-label="Ingestion mode" style={{ marginBottom: "1.25rem" }}>
        <button type="button" className={`btn ${entryMode === "upload" ? "btn-primary" : "btn-secondary"} btn-sm`} role="tab" aria-selected={entryMode === "upload"} onClick={() => setSearchParams({})}>Upload file</button>
        <button type="button" className={`btn ${entryMode === "manual" ? "btn-primary" : "btn-secondary"} btn-sm`} role="tab" aria-selected={entryMode === "manual"} onClick={() => setSearchParams({ mode: "manual" })}>Add students manually</button>
      </div>
      {entryMode === "manual" ? <CollegeAddStudents /> : null}
      {entryMode === "manual" ? null : (
      <>
      {/* Grid: Upload Dropzone & Column Mapping Preview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.75rem", marginBottom: "2rem" }}>
        {/* Dropzone Card */}
        <div className="gov-card">
          <div className="gov-card-header">
            <h3 style={{ fontSize: "1.125rem", color: "var(--gov-navy-900)" }}>
              Select Admissions CSV File
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadSampleCsv}
              title="Download a sample CSV"
            >
              <Download size={13} />
              <span>Sample CSV</span>
            </button>
          </div>

          {/* Interactive Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            style={{
              border: "2px dashed #93C5FD",
              background: "#F8FAFC",
              borderRadius: "10px",
              padding: "2.25rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: "1.25rem",
              transition: "all 0.2s ease"
            }}
          >
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFileSelected} style={{ display: "none" }} id="student-csv-file" />
            <label htmlFor="student-csv-file" style={{ cursor: "pointer", display: "block" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto" }}>
              <UploadCloud size={26} />
            </div>
            <h4 style={{ fontSize: "1rem", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
              Click to browse or drag & drop CSV file
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              CSV and Excel (.xlsx) uploads are supported. Excel files use the first sheet and first row as headers.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ pointerEvents: "none" }}>
              Browse File from Computer
            </span>
            </label>
          </div>
          {mappingError && (<div role="alert" style={{ color: "#991B1B", background: "#FEE2E2", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>{mappingError}</div>)}
          {ingestionSummary && (
            <div role="status" style={{ color: "#1E3A8A", background: "#EFF6FF", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem" }}>
              {ingestionSummary.offline ? <strong>Backend unavailable; records were staged locally.</strong> : <><strong>Ingestion result:</strong> {ingestionSummary.storedClean} stored for validation, {ingestionSummary.storedFlagged} flagged, {ingestionSummary.rejected} rejected of {ingestionSummary.total} rows.</>}
              {ingestionSummary.errors?.length > 0 && (
                <ul style={{ margin: "0.5rem 0 0 1.25rem" }}>
                  {ingestionSummary.errors.map((error, index) => <li key={`${error.row}-${error.field}-${index}`}>Row {error.row}{error.field ? ` (${error.field})` : ""}: {error.message}</li>)}
                </ul>
              )}
            </div>
          )}
          {selectedFileName && (
            <div style={{ border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem" }}>
              <strong>{selectedFileName}</strong>
              <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
                <table className="data-table" aria-label="Column mapping">
                  <thead><tr><th>Standard field</th><th>File column</th></tr></thead>
                  <tbody>{STANDARD_COLUMNS.map((column) => <tr key={column.key}><td>{column.label}{["studentId", "studentName", "apaarId", "programme", "yearOfStudy", "category"].includes(column.key) ? " *" : ""}</td><td><select value={mapping[column.key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [column.key]: event.target.value }))}><option value="">Not mapped</option>{fileColumns.map((header) => <option key={header} value={header}>{header}</option>)}</select></td></tr>)}</tbody>
                </table>
              </div>
              <p>Preview: {fileRows.slice(0, 5).map((row, index) => <span key={index} style={{ display: "block", fontSize: "0.8rem" }}>{row.join(" | ")}</span>)}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleMappedUpload} disabled={mappingBusy}>{mappingBusy ? "Staging..." : "Continue and stage mapped records"}</button>
            </div>
          )}

        </div>

        {/* Column Mapping Preview Card */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h3 style={{ fontSize: "1.125rem", color: "var(--gov-navy-900)" }}>
                Column-Mapping Preview
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Converts disparate college ERP column names into one standard schema.
              </p>
            </div>
            <span className="status-badge READY_TO_ACCEPT">
              <FileCheck size={12} />
              Mapped
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8125rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid var(--border-medium)" }}>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "var(--gov-navy-900)" }}>Submitted Column Name</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "var(--gov-navy-900)" }}>Target Standard Schema</th>
                  <th style={{ padding: "0.6rem 0.75rem", textAlign: "left", color: "var(--gov-navy-900)" }}>Validation Rule</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>Roll No / PRN / Student ID</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>studentId</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Mandatory institutional ID</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>Student Full Name</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>studentName</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Required text field</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-light)", background: "#FEF3C7" }}>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>APAAR / APAAR ID</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>apaarId</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "#92400E" }}>
                    Exact 12 digits (format-checked, not identity-verified)
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>Branch / Programme / Department</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>programme</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Must exist in AICTE Approval Master</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>Year / Semester</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>yearOfStudy</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>FE / SE / TE / BE</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.6rem 0.75rem" }}><code>Category / Quota</code></td>
                  <td style={{ padding: "0.6rem 0.75rem", fontWeight: "600", color: "#1E40AF" }}>category</td>
                  <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Checks NRI/FN & supernumerary caps</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Uploading & Validating Progress Simulation */}
      {isUploading && (
        <div className="gov-card" style={{ marginBottom: "2rem", borderColor: "#DDD6FE", background: "#FAF5FF" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <RefreshCw size={24} className="spin-slow" style={{ color: "#7C3AED" }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontWeight: "700", color: "#5B21B6", fontSize: "0.9375rem" }}>
                  {validationStage === "PARSING" ? "Parsing CSV & Normalizing Column Schemas..." : "Running Explainable AICTE Validation Engine..."}
                </span>
                <span style={{ fontSize: "0.8125rem", color: "#7C3AED", fontWeight: "600" }}>
                  {validationStage === "PARSING" ? "40%" : "85%"}
                </span>
              </div>
              <div style={{ height: "6px", width: "100%", background: "#E9D5FF", borderRadius: "9999px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: validationStage === "PARSING" ? "40%" : "85%", background: "#7C3AED", transition: "width 0.4s ease" }}></div>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#6D28D9", display: "block", marginTop: "0.35rem" }}>
                Checking: 12-digit format &bull; In-batch duplicates &bull; Repository matches &bull; Approval Master course & intake limits
              </span>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Current Active Batch Summary Banner */}
      {activeBatch && !isUploading && (
        <div className="gov-card" style={{ borderColor: activeBatch.flaggedRowsCount > 0 ? "#FCD34D" : "#86EFAC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.35rem" }}>
                <h3 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)" }}>
                  Current Ingested Batch: <code>{activeBatch.batchId}</code>
                </h3>
                <StatusBadge status={activeBatch.status} />
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Source: <strong>{activeBatch.fileName}</strong> &bull; Total Submitted Records: <strong>{activeBatch.totalRows}</strong> &bull; Ingestion Time: <strong>{new Date(activeBatch.uploadedAt).toLocaleString()}</strong>
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate(`/college/workbench?batch=${encodeURIComponent(activeBatch.batchId)}`)}
              >
                <span>Open Issue Workbench</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Validation Metrics Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", background: "#F8FAFC", borderRadius: "8px", padding: "1rem", border: "1px solid var(--border-light)" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Total Records</span>
              <strong style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)" }}>{activeBatch.totalRows}</strong>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#92400E", display: "block" }}>Anomalies Flagged</span>
              <strong style={{ fontSize: "1.25rem", color: activeBatch.flaggedRowsCount > 0 ? "#B45309" : "#166534" }}>
                {activeBatch.flaggedRowsCount}
              </strong>
              {activeBatch.flaggedRowsCount > 0 && (
                <span style={{ fontSize: "0.7rem", color: "#92400E", display: "block" }}>Action Required</span>
              )}
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#0F766E", display: "block" }}>Ready to Accept</span>
              <strong style={{ fontSize: "1.25rem", color: "#0F766E" }}>{activeBatch.readyToAcceptCount}</strong>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>All checks passed</span>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#166534", display: "block" }}>Accepted in Repository</span>
              <strong style={{ fontSize: "1.25rem", color: "#166534" }}>{activeBatch.acceptedCount}</strong>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>Stored in central database</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
