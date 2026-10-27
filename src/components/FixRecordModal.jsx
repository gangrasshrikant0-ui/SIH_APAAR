import React, { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { collegeApi } from "../api/collegeApi";
import { StatusBadge } from "./StatusBadge";
import {
  correctBackendRecord,
  isBackendConfigured,
  saveBackendRecordDraft
} from "../api/ingestionApi";

export function FixRecordModal({
  record,
  batchId,
  onClose,
  onFixed,
  onRevalidated,
  onDraftSaved
}) {
  const [fields, setFields] = useState({
    apaarId: record.apaarId || "",
    studentName: record.studentName || "",
    studentId: record.studentId || "",
    programme: record.programme || "",
    category: record.category || "GENERAL",
    dob: record.dob || record.dateOfBirth || "",
    yearOfStudy: record.yearOfStudy || "",
    admissionStatus: record.admissionStatus || "",
    ociStatus: record.ociStatus || "",
    foreignNationalStatus: record.foreignNationalStatus || "",
    nriStatus: record.nriStatus || "",
    supernumerarySeats: record.supernumerarySeats ?? 0,
    transferProof: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [revalidationResult, setRevalidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sampleFixNotice, setSampleFixNotice] = useState("");

  const issueFieldMap = {
    MISSING_APAAR_ID: ["apaarId"],
    WRONG_FORMAT: ["apaarId"],
    DUPLICATE_IN_BATCH: ["apaarId"],
    DUPLICATE_ACROSS_BATCHES: ["apaarId"],
    DUPLICATE_IN_REPOSITORY: ["apaarId"],
    DUPLICATE_STUDENT_ID: ["studentId"],
    MISSING_DOB: ["dob"],
    INVALID_DOB: ["dob"],
    INVALID_CATEGORY: ["category"],
    CATEGORY_MISMATCH: ["category", "ociStatus", "foreignNationalStatus", "nriStatus"],
    INVALID_ACADEMIC_YEAR: ["yearOfStudy"],
    INVALID_YEAR_OF_STUDY: ["yearOfStudy"],
    COURSE_MAPPING_ERROR: ["programme"],
    SEAT_CATEGORY_LIMIT: ["category"],
    CROSS_INSTITUTION_CONFLICT: ["transferProof"]
  };
  const mandatoryField = record.issueType === "MISSING_MANDATORY_FIELD"
    ? record.evidence?.match(/Field '([^']+)'/)?.[1]
    : null;
  const mandatoryFieldMap = {
    studentName: "studentName",
    studentId: "studentId",
    programme: "programme",
    yearOfStudy: "yearOfStudy",
    category: "category",
    apaarId: "apaarId",
    dob: "dob",
    dateOfBirth: "dob"
  };
  const visibleFields = new Set(
    mandatoryField
      ? [mandatoryFieldMap[mandatoryField]].filter(Boolean)
      : issueFieldMap[record.issueType] || []
  );

  useEffect(() => {
    if (!sampleFixNotice) return undefined;
    const timer = window.setTimeout(() => setSampleFixNotice(""), 2500);
    return () => window.clearTimeout(timer);
  }, [sampleFixNotice]);

  const updateField = (field, value) => {
    setFields((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const getCorrectionFields = () =>
    Object.fromEntries(
      [...visibleFields].map((field) => [field, fields[field]])
    );

  const handleQuickFixPreset = () => {
    const presets = {
      MISSING_APAAR_ID: {
        apaarId: "987654321098",
      },

      WRONG_FORMAT: {
        apaarId: "111122223334",
      },

      DUPLICATE_IN_BATCH: {
        apaarId:
          record.studentName === "Vikram Joshi"
            ? "887766554433"
            : "998877665544",
      },

      DUPLICATE_IN_REPOSITORY: {
        apaarId: "111122223336",
      },

      DUPLICATE_ACROSS_BATCHES: {
        apaarId: "111122223336",
      },

      INVALID_CATEGORY: {
        category: "GENERAL",
      },

      INVALID_ACADEMIC_YEAR: {
        yearOfStudy: "SE",
      },

      INVALID_YEAR_OF_STUDY: {
        yearOfStudy: "SE",
      },

      INVALID_DOB: {
        dob: "2000-01-01",
      },

      CATEGORY_MISMATCH: {
        category: "NRI_FN",
        ociStatus: "",
        foreignNationalStatus: "",
        nriStatus: "",
      },

      COURSE_MAPPING_ERROR: {
        programme: "Computer Engineering",
      },

      SEAT_CATEGORY_LIMIT: {
        category: "GENERAL",
      },
    };

    const mandatoryPresets = {
      studentName: { studentName: "Valid Student" },
      studentId: { studentId: "STU-001" },
      programme: { programme: "Computer Engineering" },
      yearOfStudy: { yearOfStudy: "SE" },
      category: { category: "GENERAL" },
      apaarId: { apaarId: "987654321098" },
      dob: { dob: "2000-01-01" },
      dateOfBirth: { dob: "2000-01-01" },
    };
    const preset = record.issueType === "MISSING_MANDATORY_FIELD"
      ? mandatoryPresets[mandatoryField]
      : presets[record.issueType];

    if (!preset) {
      setSampleFixNotice(
        record.issueType === "CROSS_INSTITUTION_CONFLICT"
          ? "Provide valid transfer documentation for reviewer adjudication; no sample proof is generated."
          : "This issue requires institutional review; no sample field correction is available."
      );
      return;
    }

    setFields((previous) => ({
      ...previous,
      ...preset,
    }));
    setSampleFixNotice("Sample correction filled. Review it before saving.");
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    setErrorMsg("");
    setRevalidationResult(null);

    try {
      // Backend-connected records
      if (
        isBackendConfigured() &&
        String(record.id).startsWith("INGEST-")
      ) {
        const backendResult = await correctBackendRecord(
          record.id,
          getCorrectionFields()
        );

        if (backendResult.offline) {
          setErrorMsg(
            "Backend offline: changes were not saved to the database."
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Revalidate the SAME record in the current batch.
      const res = await collegeApi.fixAndRevalidateRecord(
        batchId,
        record.id,
        getCorrectionFields()
      );

      setRevalidationResult(res);

      if (res.validationPassed) {
        setTimeout(() => {
          onFixed(res.record);
          onClose();
        }, 1200);
      } else {
        await onRevalidated?.(res.record);
      }
    } catch (err) {
      setErrorMsg(
        err.message || "Failed to resubmit record for validation."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setSavingDraft(true);
    setErrorMsg("");
    setRevalidationResult(null);

    try {
      if (
        isBackendConfigured() &&
        String(record.id).startsWith("INGEST-")
      ) {
        const backendResult = await saveBackendRecordDraft(
          record.id,
          getCorrectionFields()
        );

        if (backendResult.offline) {
          setErrorMsg(
            "Backend offline: draft changes were not saved to the database."
          );
          return;
        }
      }

      const result = await collegeApi.saveRecordDraft(
        batchId,
        record.id,
        getCorrectionFields(),
        record.issueId
      );
      await onDraftSaved?.(result.record);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to save record draft.");
    } finally {
      setIsSubmitting(false);
      setSavingDraft(false);
    }
  };

  const inputStyle = {
    width: "100%",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: "700",
    color: "var(--gov-navy-900)",
    marginBottom: "0.35rem",
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fix-modal-title"
    >
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "1.75rem" }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.25rem",
            borderBottom: "1px solid var(--border-light)",
            paddingBottom: "1rem",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              }}
            >
              <span className="tag-badge severity-high">
                {record.issueTitle || "Data Validation Issue"}
              </span>

              <StatusBadge status={record.status} />
            </div>

            <h2
              id="fix-modal-title"
              style={{
                fontSize: "1.25rem",
                color: "var(--gov-navy-900)",
              }}
            >
              Correct Student Data
            </h2>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-muted)",
              }}
            >
              Student: <strong>{record.studentName || "Name missing"}</strong>
            </p>

            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-muted)",
              }}
            >
              Record ID: <strong>{record.id}</strong> &bull; PRN:{" "}
              <strong>{record.studentId || "Missing"}</strong>
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

        {/* Diagnostic */}
        <div
          style={{
            background: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#92400E",
              fontWeight: "700",
              fontSize: "0.875rem",
              marginBottom: "0.35rem",
            }}
          >
            <AlertTriangle size={16} />
            <span>Issue Diagnostic</span>
          </div>

          <p
            style={{
              fontSize: "0.875rem",
              color: "#78350F",
              marginBottom: "0.5rem",
            }}
          >
            <strong>Reason:</strong> {record.reason}
          </p>

          <p
            style={{
              fontSize: "0.8125rem",
              color: "#92400E",
            }}
          >
            <strong>Evidence:</strong>{" "}
            <code>{record.evidence}</code>
          </p>

          <div
            style={{
              marginTop: "0.5rem",
              paddingTop: "0.5rem",
              borderTop: "1px solid rgba(146, 64, 14, 0.2)",
              fontSize: "0.8125rem",
              color: "#78350F",
            }}
          >
            <strong>Required Action:</strong>{" "}
            {record.requiredAction}
          </div>
        </div>

        {/* Sample Fix */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
            }}
          >
            Correct only the field(s) associated with this issue:
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleQuickFixPreset}
            style={{
              fontSize: "0.75rem",
              borderColor: "#0284C7",
              color: "#0284C7",
              flexShrink: 0,
            }}
          >
            <Sparkles size={12} />
            <span>Suggest Sample Fix</span>
          </button>
        </div>
        {sampleFixNotice && (
          <div className="sample-fix-toast" role="status" aria-live="polite">
            {sampleFixNotice}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {visibleFields.size === 0 && (
            <p className="gov-alert gov-alert-warning" role="status">
              This issue has no editable student field. Review the required action before revalidating.
            </p>
          )}
          {/* APAAR */}
          {visibleFields.has("apaarId") && <div>
            <label style={labelStyle}>
              12-Digit APAAR ID
            </label>

            <input
              type="text"
              value={fields.apaarId}
              onChange={(e) =>
                updateField("apaarId", e.target.value)
              }
              placeholder="Enter 12 numeric digits"
              className="search-input"
              style={{
                ...inputStyle,
                fontFamily: "monospace",
                letterSpacing: "1px",
              }}
              maxLength={12}
            />
          </div>}

          {/* Student Name */}
          {visibleFields.has("studentName") && <div>
            <label style={labelStyle}>
              Student Full Name
            </label>

            <input
              type="text"
              value={fields.studentName}
              onChange={(e) =>
                updateField("studentName", e.target.value)
              }
              placeholder="Enter student's full name"
              className="search-input"
              style={inputStyle}
            />
          </div>}

          {/* PRN */}
          {visibleFields.has("studentId") && <div>
            <label style={labelStyle}>
              Student Institutional ID / PRN
            </label>

            <input
              type="text"
              value={fields.studentId}
              onChange={(e) =>
                updateField("studentId", e.target.value)
              }
              placeholder="Enter institutional PRN"
              className="search-input"
              style={inputStyle}
            />
          </div>}

          {/* Programme */}
          {visibleFields.has("programme") && <div>
            <label style={labelStyle}>
              Approved Programme
            </label>

            <select
              value={fields.programme}
              onChange={(e) =>
                updateField("programme", e.target.value)
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="Computer Engineering">
                Computer Engineering
              </option>

              <option value="Information Technology">
                Information Technology
              </option>

              <option value="Electronics & Telecommunication">
                Electronics & Telecommunication
              </option>

              <option value="Artificial Intelligence & Data Science">
                Artificial Intelligence & Data Science
              </option>

              <option value="B.Tech Aeronautical Engineering">
                B.Tech Aeronautical Engineering (Unapproved)
              </option>
            </select>
          </div>}

          {/* Category */}
          {visibleFields.has("category") && <div>
            <label style={labelStyle}>
              Seat Category
            </label>

            <select
              value={fields.category}
              onChange={(e) =>
                updateField("category", e.target.value)
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="GENERAL">GENERAL</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
              <option value="TFWS">TFWS</option>
              <option value="NRI_FN">NRI / FN / OCI</option>
            </select>
          </div>}

          {/* DOB */}
          {visibleFields.has("dob") && <div>
            <label style={labelStyle}>
              Date of Birth
            </label>

            <input
              type="date"
              value={fields.dob}
              onChange={(e) =>
                updateField("dob", e.target.value)
              }
              className="search-input"
              style={inputStyle}
            />
          </div>}

          {/* Year of study */}
          {visibleFields.has("yearOfStudy") && <div>
            <label style={labelStyle}>
              Academic Year of Study
            </label>

            <select
              value={fields.yearOfStudy}
              onChange={(e) =>
                updateField("yearOfStudy", e.target.value)
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="">Select year</option>
              <option value="FE">FE</option>
              <option value="SE">SE</option>
              <option value="TE">TE</option>
              <option value="BE">BE</option>
              <option value="FY">FY</option>
              <option value="SY">SY</option>
              <option value="TY">TY</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>}

          {/* OCI status */}
          {visibleFields.has("ociStatus") && <div>
            <label style={labelStyle}>
              OCI Status
            </label>

            <select
              value={fields.ociStatus}
              onChange={(e) =>
                updateField("ociStatus", e.target.value)
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="">Not recorded</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
            </select>
          </div>}

          {/* Foreign national status */}
          {visibleFields.has("foreignNationalStatus") && <div>
            <label style={labelStyle}>
              Foreign National Status
            </label>

            <select
              value={fields.foreignNationalStatus}
              onChange={(e) =>
                updateField(
                  "foreignNationalStatus",
                  e.target.value
                )
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="">Not recorded</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
            </select>
          </div>}

          {/* NRI status */}
          {visibleFields.has("nriStatus") && <div>
            <label style={labelStyle}>
              NRI Status
            </label>

            <select
              value={fields.nriStatus}
              onChange={(e) =>
                updateField("nriStatus", e.target.value)
              }
              className="filter-select"
              style={inputStyle}
            >
              <option value="">Not recorded</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="NOT_APPLICABLE">NOT APPLICABLE</option>
            </select>
          </div>}

          {/* Supernumerary seats */}
          {visibleFields.has("supernumerarySeats") && <div>
            <label style={labelStyle}>
              Supernumerary Seats
            </label>

            <input
              type="number"
              min="0"
              value={fields.supernumerarySeats}
              onChange={(e) =>
                updateField(
                  "supernumerarySeats",
                  Number(e.target.value)
                )
              }
              className="search-input"
              style={inputStyle}
            />
          </div>}

          {/* Transfer proof */}
          {visibleFields.has("transferProof") && (
            <div>
              <label style={labelStyle}>
                Transfer / Withdrawal Verification Proof
              </label>

              <input
                type="text"
                value={fields.transferProof}
                onChange={(e) =>
                  updateField("transferProof", e.target.value)
                }
                placeholder="Enter transfer certificate reference"
                className="search-input"
                style={inputStyle}
              />
            </div>
          )}

          {/* Result */}
          {revalidationResult && (
            <div
              style={{
                borderRadius: "8px",
                padding: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                background: revalidationResult.validationPassed
                  ? "#DCFCE7"
                  : "#FEE2E2",
                color: revalidationResult.validationPassed
                  ? "#166534"
                  : "#991B1B",
                border: `1px solid ${
                  revalidationResult.validationPassed
                    ? "#86EFAC"
                    : "#FCA5A5"
                }`,
              }}
            >
              {revalidationResult.validationPassed ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>
                    <strong>Revalidation Passed:</strong>{" "}
                    Record corrected. Anomaly resolved!
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} />
                  <span>
                    <strong>Validation Failed:</strong>{" "}
                    {revalidationResult.record?.reason ||
                      "One or more issues remain."}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div
              style={{
                color: "#DC2626",
                fontSize: "0.875rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1rem",
              borderTop: "1px solid var(--border-light)",
              paddingTop: "1rem",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              {savingDraft ? (
                <>
                  <RefreshCw size={14} className="spin-slow" />
                  <span>Saving Draft...</span>
                </>
              ) : (
                <span>Save Draft</span>
              )}
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw
                    size={14}
                    className="spin-slow"
                  />
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