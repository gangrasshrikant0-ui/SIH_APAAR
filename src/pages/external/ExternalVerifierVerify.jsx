import React, { useState } from "react";
import { AlertCircle, CheckCircle, FileSearch, LockKeyhole, XCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { verificationApi } from "../../api/verificationApi";

const PURPOSES = [
  "Employment check",
  "Regulatory check",
  "Admission check",
  "Other"
];

function ResultIcon({ status }) {
  if (status === "VALID") return <CheckCircle size={28} aria-hidden="true" />;
  if (status === "NOT_FOUND") return <FileSearch size={28} aria-hidden="true" />;
  if (status === "REVOKED") return <XCircle size={28} aria-hidden="true" />;
  return <AlertCircle size={28} aria-hidden="true" />;
}

export function ExternalVerifierVerify() {
  const [searchParams] = useSearchParams();
  const [reference, setReference] = useState(searchParams.get("reference") || "");
  const [purpose, setPurpose] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const canVerify = reference.trim() && purpose && authorised && !loading;

  async function handleVerify(event) {
    event.preventDefault();
    if (!canVerify) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await verificationApi.verifyToken(reference.trim(), { purpose }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 520px) minmax(280px, 1fr)", gap: "1.5rem", alignItems: "start" }}>
      <section className="gov-card" aria-labelledby="verify-record-title">
        <h2 id="verify-record-title" style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "1rem" }}>
          Verify a Record
        </h2>
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label className="filter-label" htmlFor="record-reference">Record reference</label>
            <input
              id="record-reference"
              type="text"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="search-input"
              style={{ width: "100%" }}
              aria-describedby="reference-help"
            />
            <span id="reference-help" style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
              Enter the exact reference or QR link value.
            </span>
          </div>
          <div>
            <label className="filter-label" htmlFor="verification-purpose">Purpose of verification</label>
            <select id="verification-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} className="filter-select" style={{ width: "100%" }}>
              <option value="">Select a purpose</option>
              {PURPOSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", lineHeight: "1.4" }}>
            <input type="checkbox" checked={authorised} onChange={(event) => setAuthorised(event.target.checked)} />
            <span>I am authorised to verify this record for the stated purpose</span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={!canVerify}>
            <LockKeyhole size={16} />
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </section>

      <section className="gov-card" aria-live="polite" aria-labelledby="verification-result-title">
        <h2 id="verification-result-title" style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "1rem" }}>
          Verification result
        </h2>
        {!result ? (
          <p style={{ color: "var(--text-muted)" }}>Enter one exact record reference to begin verification.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", color: result.status === "VALID" ? "#166534" : "#991B1B", marginBottom: "1rem" }}>
              <ResultIcon status={result.status} />
              <strong>{result.status === "CONSENT_MISSING" ? "CONSENT NOT RECORDED" : result.status}</strong>
            </div>
            {result.status === "VALID" ? (
              <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, auto) 1fr", gap: "0.65rem 1rem", margin: 0 }}>
                <dt>Student name</dt><dd>{result.studentName}</dd>
                <dt>Institution</dt><dd>{result.institutionName}</dd>
                <dt>Programme</dt><dd>{result.programme}</dd>
                <dt>Academic year</dt><dd>{result.academicYear}</dd>
                <dt>APAAR ID</dt><dd>{result.apaarId}</dd>
                <dt>Record status</dt><dd>{result.recordStatus}</dd>
              </dl>
            ) : (
              <p style={{ color: "var(--text-muted)", lineHeight: "1.5" }}>{result.message}</p>
            )}
            <p style={{ borderTop: "1px solid var(--border-light)", marginTop: "1.25rem", paddingTop: "1rem", color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: "1.5" }}>
                Verification mode: DEMO (simulated). Not an officially signed credential. A correctly formatted APAAR ID is not identity-verified.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
