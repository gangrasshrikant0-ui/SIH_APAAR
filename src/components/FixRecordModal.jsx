import React, { useState } from "react";
import { X, CheckCircle2, AlertTriangle, RefreshCw, FileText, Sparkles, ShieldCheck } from "lucide-react";
import { collegeApi } from "../api/collegeApi";
import { StatusBadge, SeverityBadge } from "./StatusBadge";

export function FixRecordModal({ record, batchId, onClose, onFixed }) {
  const [apaarId, setApaarId] = useState(record.apaarId || "");
  const [studentId, setStudentId] = useState(record.studentId || "");
  const [programme, setProgramme] = useState(record.programme || "Computer Engineering");
  const [category, setCategory] = useState(record.category || "GENERAL");
  const [transferProof, setTransferProof] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revalidationResult, setRevalidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleQuickFixPreset = () => {
    // Provide clean synthetic values depending on issue
    if (record.issueType === "MISSING_APAAR_ID" || record.issueType === "WRONG_FORMAT") {
      setApaarId("998877665544");
    } else if (record.issueType === "DUPLICATE_IN_BATCH") {
      setApaarId("887766554433");
    } else if (record.issueType === "COURSE_MAPPING_ERROR") {
      setProgramme("Computer Engineering");
    } else if (record.issueType === "SEAT_CATEGORY_LIMIT") {
      setCategory("GENERAL");
    } else if (record.issueType === "CROSS_INSTITUTION_CONFLICT") {
      setTransferProof("TC/NOC-COEP-2026-AUTH-9014 (Verified Transfer Clearance)");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");
    setRevalidationResult(null);

    try {
      const res = await collegeApi.fixAndRevalidateRecord(batchId, record.id, {
        apaarId,
        studentId,
        programme,
        category,
        transferProof
      });

      setRevalidationResult(res);

      if (res.validationPassed) {
        setTimeout(() => {
          onFixed(res.record);
          onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to resubmit record for validation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fix-modal-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: "1.75rem" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", borderBottom: "1px solid var(--border-light)", paddingBottom: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span className="tag-badge severity-high">{record.issueTitle || "Anomaly"}</span>
              <StatusBadge status={record.status} />
            </div>
            <h2 id="fix-modal-title" style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)" }}>
              Fix Anomaly & Revalidate: {record.studentName}
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              PRN: <strong>{record.studentId}</strong> &bull; Course: <strong>{record.programme}</strong>
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: "0.35rem" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Existing Problem Diagnostic Box */}
        <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "8px", padding: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#92400E", fontWeight: "700", fontSize: "0.875rem", marginBottom: "0.35rem" }}>
            <AlertTriangle size={16} />
            <span>Planted Fault Diagnostic</span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#78350F", marginBottom: "0.5rem" }}>
            <strong>Reason:</strong> {record.reason}
          </p>
          <p style={{ fontSize: "0.8125rem", color: "#92400E" }}>
            <strong>Evidence:</strong> <code>{record.evidence}</code>
          </p>
          <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(146, 64, 14, 0.2)", fontSize: "0.8125rem", color: "#78350F" }}>
            <strong>Required Action:</strong> {record.requiredAction}
          </div>
        </div>

        {/* Quick Demo Autofill Hint */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Edit fields below to correct the data:
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleQuickFixPreset}
            style={{ fontSize: "0.75rem", borderColor: "#0284C7", color: "#0284C7" }}
          >
            <Sparkles size={12} />
            <span>Apply Valid Sample Fix</span>
          </button>
        </div>

        {/* Fix Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "700", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
              12-Digit APAAR ID <span style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(format-checked, not identity-verified)</span>
            </label>
            <input
              type="text"
              value={apaarId}
              onChange={(e) => setApaarId(e.target.value)}
              placeholder="e.g. 123456789012"
              className="search-input"
              style={{ width: "100%", fontFamily: "monospace", letterSpacing: "1px" }}
              maxLength={12}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
              Must contain exactly 12 numeric digits. No letters or symbols.
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "700", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
                Student Institutional ID / PRN
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="search-input"
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "700", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
                Approved Programme
              </label>
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="filter-select"
                style={{ width: "100%" }}
              >
                <option value="Computer Engineering">Computer Engineering (Approved: 120)</option>
                <option value="Information Technology">Information Technology (Approved: 120)</option>
                <option value="Electronics & Telecommunication">Electronics & Telecom (Approved: 120)</option>
                <option value="Artificial Intelligence & Data Science">AI & Data Science (Approved: 60)</option>
                <option value="B.Tech Aeronautical Engineering">B.Tech Aeronautical Engineering (Unapproved)</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "700", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
              Seat Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="filter-select"
              style={{ width: "100%" }}
            >
              <option value="GENERAL">GENERAL (Open Merit)</option>
              <option value="OBC">OBC (Other Backward Classes)</option>
              <option value="SC">SC (Scheduled Caste)</option>
              <option value="ST">ST (Scheduled Tribe)</option>
              <option value="EWS">EWS (Economically Weaker Section)</option>
              <option value="TFWS">TFWS (Tuition Fee Waiver)</option>
              <option value="NRI_FN">NRI / FN / OCI (Supernumerary Quota - Max 5)</option>
            </select>
          </div>

          {/* Additional field for Cross-Institution conflict */}
          {record.issueType === "CROSS_INSTITUTION_CONFLICT" && (
            <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "8px", padding: "0.85rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "700", color: "#0369A1", marginBottom: "0.35rem" }}>
                Transfer / Withdrawal Verification Proof
              </label>
              <input
                type="text"
                value={transferProof}
                onChange={(e) => setTransferProof(e.target.value)}
                placeholder="Enter Transfer Certificate Ref (e.g. TC-COEP-2026-9812)"
                className="search-input"
                style={{ width: "100%", borderColor: "#7DD3FC" }}
              />
              <span style={{ fontSize: "0.75rem", color: "#0284C7", display: "block", marginTop: "3px" }}>
                Evidence note: Flagged for review, not fraud. Valid TC clears the cross-institution flag.
              </span>
            </div>
          )}

          {/* Revalidation Outcome Banner */}
          {revalidationResult && (
            <div
              style={{
                borderRadius: "8px",
                padding: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                background: revalidationResult.validationPassed ? "#DCFCE7" : "#FEE2E2",
                color: revalidationResult.validationPassed ? "#166534" : "#991B1B",
                border: `1px solid ${revalidationResult.validationPassed ? "#86EFAC" : "#FCA5A5"}`
              }}
            >
              {revalidationResult.validationPassed ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>
                    <strong>Revalidation Passed:</strong> Record updated to <code>READY_TO_ACCEPT</code>. Anomaly resolved! Closing dialog...
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} />
                  <span>
                    <strong>Validation Failed:</strong> {revalidationResult.record.reason}
                  </span>
                </>
              )}
            </div>
          )}

          {errorMsg && (
            <div style={{ color: "#DC2626", fontSize: "0.875rem" }}>
              {errorMsg}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin-slow" />
                  <span>Revalidating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Resubmit & Revalidate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
