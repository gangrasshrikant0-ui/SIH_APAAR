import React, { useState } from "react";
import { Search, RefreshCw, AlertTriangle } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { collegeApi } from "../../api/collegeApi";
import { getBackendStudentJourney, isBackendConfigured } from "../../api/ingestionApi";
import { StudentCertificate } from "../../components/StudentCertificate";

const REQUEST_STORAGE_KEY = "apaar_verification_requests_v1";

function getVerifierRequests(apaarId) {
  try {
    const raw = localStorage.getItem(REQUEST_STORAGE_KEY);
    const requests = raw ? JSON.parse(raw) : [];
    return requests.filter((request) => request.apaarId === apaarId);
  } catch {
    return [];
  }
}

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
          setBackendNotice("Connection unavailable; showing locally available records.");
          const data = role === "AICTE" ? await aicteApi.getStudentJourney(apaarId) : await collegeApi.getStudentJourney(apaarId);
          setResult({ ...data, verifierRequests: getVerifierRequests(apaarId) });
        } else {
          setBackendNotice("");
          setResult({ ...backend, verifierRequests: getVerifierRequests(apaarId) });
        }
      } else {
        const data = role === "AICTE" ? await aicteApi.getStudentJourney(apaarId) : await collegeApi.getStudentJourney(apaarId);
        setResult({ ...data, verifierRequests: getVerifierRequests(apaarId) });
      }
    } catch (searchError) {
      setError(searchError.message || "Unable to search for this APAAR ID.");
    } finally {
      setLoading(false);
    }
  };

  const resultRecord = result?.records?.[0] || null;
  const recordsForDisplay = result?.records || [];
  const belongsToCollege = role !== "COLLEGE" || recordsForDisplay.length > 0;

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>Student Journey</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Search one exact 12-digit APAAR ID across authorised records.
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
      {role === "COLLEGE" && result && result.records.length === 0 && result.allRecords?.length > 0 && (
        <div className="gov-card" role="status" style={{ borderColor: "#F59E0B", background: "#FFFBEB", color: "#92400E", marginBottom: "1rem" }}>
          This student record exists in the national database, but does not belong to your institution.
        </div>
      )}
      {result?.hasActiveElsewhere && (
        <div className="gov-card" role="status" style={{ borderColor: "#F59E0B", background: "#FFFBEB", color: "#92400E", marginBottom: "1rem" }}>
          <AlertTriangle size={18} /> Active enrolment at another institution. AICTE review required.
        </div>
      )}
      {recordsForDisplay.length > 0 && (
        <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <div className="verification-label">Student name</div>
              <strong>{resultRecord?.studentName || "—"}</strong>
            </div>
            <div>
              <div className="verification-label">Category</div>
              <strong>{resultRecord?.category || "—"}</strong>
            </div>
            <div>
              <div className="verification-label">Verification status</div>
              <strong>{resultRecord?.status === "ACCEPTED" ? "VERIFIED" : resultRecord?.status || "NOT_FOUND"}</strong>
            </div>
            <div>
              <div className="verification-label">Admission date</div>
              <strong>{resultRecord?.admissionDate || "—"}</strong>
            </div>
            <div>
              <div className="verification-label">Branch / programme</div>
              <strong>{resultRecord?.programme || "—"}</strong>
            </div>
            <div>
              <div className="verification-label">Year of study</div>
              <strong>{resultRecord?.yearOfStudy || "—"}</strong>
            </div>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Institution</th><th>Programme</th><th>Year</th><th>Category</th><th>Admission</th><th>Verification status</th><th>Source</th></tr></thead>
              <tbody>
                {recordsForDisplay.map((record) => (
                  <tr key={`${record.batchId}-${record.id}`}>
                    <td>{record.institutionName}</td>
                    <td>{record.programme}</td>
                    <td>{record.yearOfStudy}</td>
                    <td>{record.category || "—"}</td>
                    <td>{record.admissionDate || "—"}</td>
                    <td>{record.status === "ACCEPTED" ? "VERIFIED" : record.status}</td>
                    <td>{record.source || "BULK_UPLOAD"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="journey-request-list">
            <h3>External verifier requests</h3>
            {result?.verifierRequests?.length ? result.verifierRequests.map((request) => (
              <div className="journey-request-item" key={request.id}>
                <strong>{request.requesterName}</strong>
                <span>{request.requesterOrganisation || "Organisation not provided"}</span>
                <span>{request.status || "PENDING"} · {request.purposes?.join(", ") || "Purpose not specified"}</span>
              </div>
            )) : <p>No external verifier requests are recorded for this APAAR ID.</p>}
          </div>
        </div>
      )}
      {result?.activeElsewhere && role === "COLLEGE" && (
        <div className="gov-card" role="status">Active enrolment at another institution. AICTE review required.</div>
      )}
      {role === "COLLEGE" && belongsToCollege && <StudentCertificate />}
    </div>
  );
}
