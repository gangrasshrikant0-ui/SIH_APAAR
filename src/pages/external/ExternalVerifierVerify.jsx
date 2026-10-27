import React, { useState } from "react";
import { AlertCircle, CheckCircle, FileSearch, LockKeyhole, XCircle, Send, SearchCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { verificationApi } from "../../api/verificationApi";
import { logAuditEvent } from "../../mocks/mockAuditLog";

const PURPOSE_OPTIONS = [
  "Employment check",
  "Academic verification",
  "Admission check",
  "Government compliance",
  "Other"
];

const REQUEST_STORAGE_KEY = "apaar_verification_requests_v1";

function ResultIcon({ status }) {
  if (status === "VALID") return <CheckCircle size={28} aria-hidden="true" />;
  if (status === "NOT_FOUND") return <FileSearch size={28} aria-hidden="true" />;
  if (status === "REVOKED") return <XCircle size={28} aria-hidden="true" />;
  return <AlertCircle size={28} aria-hidden="true" />;
}

function readRequests() {
  try {
    const raw = localStorage.getItem(REQUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ExternalVerifierVerify() {
  const [searchParams] = useSearchParams();
  const [reference, setReference] = useState(searchParams.get("reference") || "");
  const [purpose, setPurpose] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("request");
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requestApaarId, setRequestApaarId] = useState("");
  const [selectedPurposes, setSelectedPurposes] = useState(["Employment check"]);
  const [requestFeedback, setRequestFeedback] = useState("");
  const [statusLookup, setStatusLookup] = useState({ name: "", phone: "", apaarId: "" });
  const [statusResult, setStatusResult] = useState(null);

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

  function togglePurpose(value) {
    setSelectedPurposes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  }

  function handleSubmitRequest(event) {
    event.preventDefault();
    if (!requesterName.trim() || !requesterPhone.trim() || !requestApaarId.trim() || selectedPurposes.length === 0) {
      setRequestFeedback("Please enter your name, phone, APAAR ID and at least one verification purpose.");
      return;
    }

    const item = {
      id: `REQ-${Date.now()}`,
      requesterName: requesterName.trim(),
      requesterPhone: requesterPhone.trim(),
      apaarId: requestApaarId.trim(),
      purposes: selectedPurposes,
      requestedAt: new Date().toISOString(),
      status: "PENDING"
    };

    const requests = readRequests();
    requests.unshift(item);
    localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(requests));
    setRequestFeedback("Request submitted successfully. The student can approve or deny your access request.");
    setRequesterName("");
    setRequesterPhone("");
    setRequestApaarId("");
    setSelectedPurposes(["Employment check"]);
    logAuditEvent({
      actorName: requesterName.trim(),
      actorRole: "EXTERNAL_VERIFIER",
      actorEmail: "verifier@credential-review.example",
      actionType: "VERIFICATION_REQUEST_CREATED",
      resourceType: "STUDENT_DATA_REQUEST",
      resourceId: requestApaarId.trim(),
      details: `External verifier requested access to student record for purposes: ${selectedPurposes.join(", ")}.`,
      changeSummary: "Verification request sent to student consent queue",
      severity: "INFO",
      issuingAuthority: "External verifier"
    });
  }

  function handleCheckStatus(event) {
    event.preventDefault();
    const requests = readRequests();
    const item = [...requests].find((entry) =>
      entry.requesterName?.toLowerCase() === statusLookup.name.trim().toLowerCase() &&
      entry.requesterPhone === statusLookup.phone.trim() &&
      entry.apaarId === statusLookup.apaarId.trim()
    );

    setStatusResult(item
      ? { status: item.status || "PENDING", requestId: item.id, requestedAt: item.requestedAt }
      : { status: "NOT_FOUND", requestId: "—", requestedAt: null }
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 560px) minmax(280px, 1fr)", gap: "1.5rem", alignItems: "start" }}>
      <section className="gov-card" aria-labelledby="verify-record-title">
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button type="button" className={activeTab === "request" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("request")}>
            <Send size={14} /> Generate request
          </button>
          <button type="button" className={activeTab === "status" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("status")}>
            <SearchCheck size={14} /> Check status
          </button>
        </div>

        {activeTab === "request" ? (
          <form onSubmit={handleSubmitRequest} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="filter-label" htmlFor="requester-name">Your name</label>
              <input id="requester-name" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label" htmlFor="requester-phone">Phone number</label>
              <input id="requester-phone" value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label" htmlFor="requester-apaar">Student APAAR ID</label>
              <input id="requester-apaar" value={requestApaarId} onChange={(e) => setRequestApaarId(e.target.value)} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label">Information requested</label>
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.4rem" }}>
                {PURPOSE_OPTIONS.map((option) => (
                  <label key={option} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <input type="checkbox" checked={selectedPurposes.includes(option)} onChange={() => togglePurpose(option)} />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              <Send size={16} /> Send access request
            </button>
            {requestFeedback && <div className="gov-alert gov-alert-warning">{requestFeedback}</div>}
          </form>
        ) : (
          <form onSubmit={handleCheckStatus} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="filter-label" htmlFor="status-name">Name</label>
              <input id="status-name" value={statusLookup.name} onChange={(e) => setStatusLookup({ ...statusLookup, name: e.target.value })} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label" htmlFor="status-phone">Phone number</label>
              <input id="status-phone" value={statusLookup.phone} onChange={(e) => setStatusLookup({ ...statusLookup, phone: e.target.value })} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label" htmlFor="status-apaar">APAAR ID</label>
              <input id="status-apaar" value={statusLookup.apaarId} onChange={(e) => setStatusLookup({ ...statusLookup, apaarId: e.target.value })} className="search-input" style={{ width: "100%" }} />
            </div>
            <button type="submit" className="btn btn-secondary">
              <SearchCheck size={16} /> Check status
            </button>
          </form>
        )}
      </section>

      <section className="gov-card" aria-live="polite" aria-labelledby="verification-result-title">
        <h2 id="verification-result-title" style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "1rem" }}>
          {activeTab === "request" ? "Record verification" : "Request status"}
        </h2>

        {activeTab === "request" ? (
          !result ? (
            <p style={{ color: "var(--text-muted)" }}>Enter a record reference to begin direct verification.</p>
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
                  This is not an officially signed credential. A correctly formatted APAAR ID is not identity-verified.
              </p>
            </>
          )
        ) : (
          !statusResult ? (
            <p style={{ color: "var(--text-muted)" }}>Enter the requester details to check the current status.</p>
          ) : statusResult.status === "NOT_FOUND" ? (
            <div className="gov-alert gov-alert-warning">No request found for this person and APAAR ID.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
                <span style={{ borderRadius: "999px", padding: "0.35rem 0.7rem", background: statusResult.status === "APPROVED" ? "#DCFCE7" : statusResult.status === "DENIED" ? "#FEE2E2" : "#F3F4F6", color: statusResult.status === "APPROVED" ? "#166534" : statusResult.status === "DENIED" ? "#991B1B" : "#374151", fontWeight: 700 }}>{statusResult.status}</span>
                <strong>Request ID: {statusResult.requestId}</strong>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                Requested on: {statusResult.requestedAt ? new Date(statusResult.requestedAt).toLocaleString("en-IN") : "—"}
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                {statusResult.status === "PENDING" ? "The student has not yet approved or denied your request." : statusResult.status === "APPROVED" ? "The student has approved access. You can proceed with the requested verification." : "The student denied access for this purpose."}
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}
