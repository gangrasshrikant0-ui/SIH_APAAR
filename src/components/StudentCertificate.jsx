import React, { useState } from "react";
import { Award, Download, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { collegeApi } from "../api/collegeApi";
import { getBackendStudentJourney, isBackendConfigured } from "../api/ingestionApi";

export function StudentCertificate() {
  const [apaarId, setApaarId] = useState("");
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupNotice, setLookupNotice] = useState("");

  const lookup = async (event) => {
    event.preventDefault();
    setRecord(null);
    setMessage("");
    setError("");
    setLookupNotice("");
    if (!/^\d{12}$/.test(apaarId.trim())) {
      setError("APAAR ID must contain exactly 12 numeric digits.");
      return;
    }
    setLoading(true);
    try {
      const backend = isBackendConfigured()
        ? await getBackendStudentJourney(apaarId, "COLLEGE")
        : null;
      const result = backend && !backend.offline
        ? backend
        : await collegeApi.getStudentJourney(apaarId);
      if (backend?.offline) {
        setLookupNotice("Connection unavailable; checking locally stored records.");
      }
      const accepted = result.records.find((item) => item.status === "ACCEPTED");
      if (!accepted) {
        setMessage(result.records.length
          ? "The matching record belongs to this institution but is not accepted yet. A certificate cannot be generated."
          : "No matching student record was found for this institution.");
        return;
      }
      setRecord(accepted);
    } catch (lookupError) {
      setError(lookupError.message || "Unable to look up this APAAR ID.");
    } finally {
      setLoading(false);
    }
  };

  const verificationId = record
    ? record.recordReference || `EDU-${record.institutionId}-${record.id}`
    : "";
  const verificationLink = verificationId
    ? `${window.location.origin}/external/verify?reference=${encodeURIComponent(verificationId)}`
    : "";

  return (
    <section className="gov-card student-certificate-section">
      <div className="section-heading">
        <div className="role-card-icon"><Award size={22} /></div>
        <div>
          <h2>Generate Student Certificate</h2>
          <p>Look up an accepted student record by APAAR ID and prepare its certificate.</p>
        </div>
      </div>
      <form onSubmit={lookup} className="certificate-lookup-form">
        <label htmlFor="certificate-apaar">Student APAAR ID</label>
        <div className="certificate-lookup-controls">
          <input
            id="certificate-apaar"
            value={apaarId}
            onChange={(event) => { setApaarId(event.target.value); setRecord(null); setMessage(""); }}
            inputMode="numeric"
            maxLength={12}
            placeholder="12-digit APAAR ID"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={15} />
            {loading ? "Looking up..." : "Find student"}
          </button>
        </div>
      </form>
      {error && <p className="certificate-error" role="alert">{error}</p>}
      {message && <p className="certificate-message" role="status">{message}</p>}
      {lookupNotice && <p className="certificate-message" role="status">{lookupNotice}</p>}
      {record && (
        <div className="certificate-result">
          <dl>
            <dt>Student name</dt><dd>{record.studentName}</dd>
            <dt>Institutional Student ID / PRN</dt><dd>{record.studentId}</dd>
            <dt>Programme</dt><dd>{record.programme}</dd>
            <dt>Academic year</dt><dd>{record.academicYear || "2026-2027"}</dd>
            <dt>APAAR ID</dt><dd>{record.apaarId}</dd>
            <dt>Institution</dt><dd>{record.institutionName}</dd>
            <dt>Institution ID</dt><dd>{record.institutionId}</dd>
            <dt>Verification ID</dt><dd>{verificationId || "Unavailable"}</dd>
          </dl>
          <div className="certificate-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Download size={15} /> Print / Download Certificate
            </button>
          </div>
          <div className="certificate-print-preview">
            <p>EDUVÉRIFY Institutional Certificate</p>
            <h3>Student Credential Certificate</h3>
            <p><strong>{record.studentName}</strong></p>
            <p>{record.programme} · {record.academicYear || "2026-2027"} · APAAR {record.apaarId}</p>
            <p>{record.institutionName} · {record.institutionId}</p>
            {verificationId && <p>Verification ID: {verificationId}</p>}
            {verificationLink && <QRCodeSVG value={verificationLink} size={120} />}
            <small>Accepted record. Not an officially signed government credential.</small>
          </div>
        </div>
      )}
    </section>
  );
}
