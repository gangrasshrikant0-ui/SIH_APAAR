import React, { useState } from "react";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { collegeApi } from "../../api/collegeApi";
import { getBackendStudentJourney, isBackendConfigured } from "../../api/ingestionApi";

export function StudentJourney({ role }) {
  const [apaarId, setApaarId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendNotice, setBackendNotice] = useState("");

  const search = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    if (!/^\d{12}$/.test(apaarId)) {
      setError("APAAR ID must contain exactly 12 numeric digits.");
      return;
    }
    setLoading(true);
    try {
      if (isBackendConfigured()) {
        const backend = await getBackendStudentJourney(apaarId, role);
        if (backend.offline) {
          setBackendNotice("Backend offline: using demo data");
          setResult(role === "AICTE" ? await aicteApi.getStudentJourney(apaarId) : await collegeApi.getStudentJourney(apaarId));
        } else {
          setBackendNotice("");
          setResult(backend);
        }
      } else {
        setResult(role === "AICTE" ? await aicteApi.getStudentJourney(apaarId) : await collegeApi.getStudentJourney(apaarId));
      }
    } catch (searchError) {
      setError(searchError.message || "Unable to search for this APAAR ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>Student Journey</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Search one exact 12-digit APAAR ID across authorised records.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", fontStyle: "italic" }}>
          Prototype: synthetic data. APAAR check is simulated. A correctly formatted APAAR ID is not identity-verified.
        </p>
        {backendNotice && <p role="status" style={{ color: "#92400E", fontSize: "0.8125rem" }}>{backendNotice}</p>}
      </div>

      <form onSubmit={search} className="gov-card" style={{ display: "flex", gap: "0.75rem", alignItems: "end", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <div style={{ flex: "1 1 280px" }}>
          <label className="filter-label" htmlFor="journey-apaar">APAAR ID</label>
          <input
            id="journey-apaar"
            value={apaarId}
            onChange={(event) => setApaarId(event.target.value)}
            inputMode="numeric"
            maxLength={12}
            aria-describedby={error ? "journey-apaar-error" : undefined}
          />
          {error && <div id="journey-apaar-error" role="alert" style={{ color: "#991B1B", fontSize: "0.8125rem", marginTop: "0.35rem" }}>{error}</div>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <RefreshCw size={15} className="spin-slow" /> : <Search size={15} />}
          <span>Search</span>
        </button>
      </form>

      {result && result.records.length === 0 && (
        <div className="gov-card" role="status">No record found for this APAAR ID.</div>
      )}
      {result?.hasActiveElsewhere && (
        <div className="gov-card" role="status" style={{ borderColor: "#F59E0B", background: "#FFFBEB", color: "#92400E", marginBottom: "1rem" }}>
          <AlertTriangle size={18} />           Active enrolment at another institution. AICTE review required.
        </div>
      )}
      {result?.records.length > 0 && (
        <div className="gov-card">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Institution</th><th>Programme</th><th>Year</th><th>Status</th><th>Source</th><th>Open issues</th></tr></thead>
              <tbody>
                {result.records.map((record) => (
                  <tr key={`${record.batchId}-${record.id}`}>
                    <td>{record.institutionName}</td>
                    <td>{record.programme}</td>
                    <td>{record.yearOfStudy}</td>
                    <td>{record.status}</td>
                    <td>{record.source || "BULK_UPLOAD"}</td>
                    <td>{record.issueType || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {role === "AICTE" && <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: "1rem" }}>Prototype: synthetic data. APAAR check is simulated. A correctly formatted APAAR ID is not identity-verified.</p>}
        </div>
      )}
      {result?.activeElsewhere && role === "COLLEGE" && (
        <div className="gov-card" role="status">Active enrolment at another institution. AICTE review required.</div>
      )}
    </div>
  );
}
