import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
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
import { STANDARD_COLUMNS } from "../../mocks/mockBatches";
import { StatusBadge } from "../../components/StatusBadge";

export function CollegeUpload() {
  const navigate = useNavigate();
  const { refreshStats } = useOutletContext() || {};

  const [activeBatch, setActiveBatch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [validationStage, setValidationStage] = useState(null); // 'PARSING', 'VALIDATING', 'DONE'

  // Column mapping states
  const [mapping, setMapping] = useState({
    studentId: "PRN",
    studentName: "Student Full Name",
    apaarId: "APAAR ID (12 Digits)",
    programme: "Degree & Programme",
    yearOfStudy: "Academic Year of Study",
    category: "Seat Category",
    admissionDate: "Date of Admission"
  });

  const loadCurrentBatch = async () => {
    setIsLoading(true);
    try {
      const batch = await collegeApi.getActiveBatch();
      setActiveBatch(batch);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentBatch();
  }, []);

  const handleLoadFaultyPreset = async () => {
    setIsUploading(true);
    setValidationStage("PARSING");
    
    setTimeout(() => {
      setValidationStage("VALIDATING");
    }, 600);

    setTimeout(async () => {
      const batch = await collegeApi.loadPresetBatch("FAULTY");
      setActiveBatch(batch);
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
      setValidationStage("DONE");
      setIsUploading(false);
      if (refreshStats) refreshStats();
    }, 1200);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent = "data:text/csv;charset=utf-8," +
      "PRN,Student Full Name,APAAR ID (12 Digits),Degree & Programme,Academic Year of Study,Seat Category,Date of Admission\n" +
      "SE-COMP-001,Aarav Sharma,111122223333,Computer Engineering,SE,GENERAL,2026-08-01\n" +
      "SE-COMP-012,Rajesh Sharma,,Computer Engineering,SE,GENERAL,2026-08-10\n" +
      "SE-COMP-025,Ananya Patil,98234-ABCD,Computer Engineering,SE,OBC,2026-08-12\n" +
      "SE-COMP-004,Vikram Joshi,234567890123,Computer Engineering,SE,GENERAL,2026-08-05\n" +
      "SE-COMP-018,Sneha Roy,234567890123,Computer Engineering,SE,GENERAL,2026-08-11\n" +
      "TE-IT-008,Rohan Kulkarni,345678901234,Information Technology,TE,GENERAL,2026-08-14\n" +
      "FE-COMP-125,Arjun Deshmukh,456789012345,Computer Engineering,FE,GENERAL,2026-08-20\n" +
      "SE-COMP-067,Tariq Al-Mansoor,567890123456,Computer Engineering,SE,NRI_FN,2026-08-18\n" +
      "FE-AERO-001,Priya Nambiar,678901234567,B.Tech Aeronautical Engineering,FE,GENERAL,2026-08-16\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "PICT_Faulty_Sample_Batch_SIH2026.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    handleLoadFaultyPreset();
  };

  return (
    <div className="gov-container">
      {/* Page Title & Explanation */}
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Batch Upload & Data Ingestion
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", maxWidth: "840px" }}>
          Colleges upload student admissions data via CSV. The platform standardizes column headers, runs automated rule-based checks against the AICTE Approval Master, and flags any anomalies for resolution.
        </p>
      </div>

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
              title="Download sample CSV with synthetic SIH records"
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
            onClick={handleLoadFaultyPreset}
          >
            <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem auto" }}>
              <UploadCloud size={26} />
            </div>
            <h4 style={{ fontSize: "1rem", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
              Click to browse or drag & drop CSV file
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Supports .csv files with student PRN, Name, APAAR ID, Course, and Category.
            </p>
            <span className="btn btn-secondary btn-sm" style={{ pointerEvents: "none" }}>
              Browse File from Computer
            </span>
          </div>

          {/* Quick Simulation Presets */}
          <div style={{ background: "#F1F5F9", borderRadius: "8px", padding: "1rem", border: "1px solid var(--border-light)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", display: "block", marginBottom: "0.5rem", textTransform: "uppercase" }}>
              Quick Evaluation Presets (Smart India Hackathon 2026):
            </span>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleLoadFaultyPreset}
                disabled={isUploading}
                style={{ background: "#1E3A8A" }}
              >
                <Sparkles size={13} />
                <span>Load Faulty Mock Batch (7 Planted Faults)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLoadCleanPreset}
                disabled={isUploading}
              >
                <CheckCircle2 size={13} style={{ color: "#166534" }} />
                <span>Load Clean Batch</span>
              </button>
            </div>
          </div>
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

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/college/workbench")}
              >
                <span>Inspect Flagged Rows in Workbench</span>
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
