import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, FileSearch, LockKeyhole, SearchCheck, Send, XCircle } from "lucide-react";
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
const STUDENT_VERIFICATION_KEY = "apaar_student_verification_v1";

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

function readVerificationRecords() {
  try {
    const raw = localStorage.getItem(STUDENT_VERIFICATION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function seedVerifierDemoRequests() {
  const existing = readRequests();
  const hasDemoVerifierRequests = existing.some((entry) => entry.requesterName === "Meera Kapoor");
  if (hasDemoVerifierRequests) return existing;

  const demoEntries = [
    {
      id: "REQ-MEERA-APPROVED",
      requesterName: "Meera Kapoor",
      requesterPhone: "+91 98765 10101",
      requesterOrganisation: "National Credential Review Office",
      apaarId: "984251638019",
      verificationCode: "EDU-222333-2026-24567",
      purposes: ["Academic verification"],
      requestedAt: "2026-10-27T13:00:00.000Z",
      status: "APPROVED",
      decidedAt: "2026-10-27T17:00:00.000Z"
    },
    {
      id: "REQ-MEERA-REJECTED",
      requesterName: "Meera Kapoor",
      requesterPhone: "+91 98765 10101",
      requesterOrganisation: "National Credential Review Office",
      apaarId: "984251638019",
      verificationCode: "EDU-222333-2026-99812",
      purposes: ["Employment check"],
      requestedAt: "2026-10-26T13:00:00.000Z",
      status: "DENIED",
      decidedAt: "2026-10-26T17:00:00.000Z"
    }
  ];

  const next = [...demoEntries, ...existing];
  localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(next));
  return next;
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
  const [requesterOrganisation, setRequesterOrganisation] = useState("");
  const [requestApaarId, setRequestApaarId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [selectedPurposes, setSelectedPurposes] = useState(["Employment check"]);
  const [requestFeedback, setRequestFeedback] = useState("");
  const [statusLookup, setStatusLookup] = useState({ name: "", phone: "", verificationCode: "" });
  const [statusResult, setStatusResult] = useState(null);
  const [directVerificationResult, setDirectVerificationResult] = useState(null);

  useEffect(() => {
    seedVerifierDemoRequests();
  }, []);

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
    if (!requesterName.trim() || !requesterPhone.trim() || !requesterOrganisation.trim() || !requestApaarId.trim() || selectedPurposes.length === 0) {
      setRequestFeedback("Please fill in all required fields: your name, organisation, phone, student's APAAR ID and at least one purpose. The unique verification code is optional.");
      return;
    }

    const enteredCode = verificationCode.trim();
    if (enteredCode) {
      const verificationRecords = readVerificationRecords();
      const matchedRecord = Object.values(verificationRecords).find((entry) =>
        entry.verificationCode?.toLowerCase() === enteredCode.toLowerCase()
      );
      const matchedStudent = matchedRecord && matchedRecord.apaarId === requestApaarId.trim()
        ? matchedRecord
        : null;
      setDirectVerificationResult({
        status: matchedStudent?.status === "VERIFIED" ? "VERIFIED" : "NOT_VERIFIED",
        apaarId: requestApaarId.trim()
      });
      setRequestFeedback("");
      return;
    }

    const item = {
      id: `REQ-${Date.now()}`,
      requesterName: requesterName.trim(),
      requesterPhone: requesterPhone.trim(),
      requesterOrganisation: requesterOrganisation.trim(),
      apaarId: requestApaarId.trim(),
      verificationCode: "",
      purposes: selectedPurposes,
      requestedAt: new Date().toISOString(),
      status: "PENDING"
    };

    const requests = readRequests();
    requests.unshift(item);
    localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(requests));
    setRequestFeedback("Request submitted successfully.");
    setRequesterName("");
    setRequesterPhone("");
    setRequesterOrganisation("");
    setRequestApaarId("");
    setVerificationCode("");
    setSelectedPurposes(["Employment check"]);
    logAuditEvent({
      actorName: requesterName.trim(),
      actorRole: "EXTERNAL_VERIFIER",
      actorEmail: "verifier@credential-review.example",
      actionType: "VERIFICATION_REQUEST_CREATED",
      resourceType: "STUDENT_DATA_REQUEST",
      resourceId: verificationCode.trim(),
      details: `External verifier requested access to student record with code ${verificationCode.trim()} for purposes: ${selectedPurposes.join(", ")}.`,
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
      entry.requesterPhone === statusLookup.phone.trim()
    );

    if (!item) {
      setStatusResult({ status: "NOT_FOUND", requestId: "—", requestedAt: null });
      return;
    }

    const finalStatus = item.status || "PENDING";
    setStatusResult({ status: finalStatus, requestId: item.id, requestedAt: item.requestedAt });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 560px) minmax(280px, 1fr)", gap: "1.5rem", alignItems: "start" }}>
      <section className="gov-card" aria-labelledby="verify-record-title">
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <button type="button" className={activeTab === "request" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("request")}>
            <Send size={14} /> Generate request
          </button>
          <button type="button" className={activeTab === "status" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setActiveTab("status")}>
            <SearchCheck size={14} /> Check Status
          </button>
        </div>

        {activeTab === "request" ? (
          <form onSubmit={handleSubmitRequest} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label className="filter-label" htmlFor="requester-name">Your name <span className="required-asterisk">*</span></label>
              <input id="requester-name" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} className="search-input" style={{ width: "100%" }} required />
            </div>
            <div>
              <label className="filter-label" htmlFor="requester-organisation">Organisation name <span className="required-asterisk">*</span></label>
              <input id="requester-organisation" value={requesterOrganisation} onChange={(e) => setRequesterOrganisation(e.target.value)} className="search-input" style={{ width: "100%" }} required />
            </div>
            <div>
              <label className="filter-label" htmlFor="requester-phone">Phone number <span className="required-asterisk">*</span></label>
              <input id="requester-phone" value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} className="search-input" style={{ width: "100%" }} required />
            </div>
            <div>
              <label className="filter-label" htmlFor="requester-apaar">Student APAAR ID <span className="required-asterisk">*</span></label>
              <input id="requester-apaar" value={requestApaarId} onChange={(e) => setRequestApaarId(e.target.value)} className="search-input" style={{ width: "100%" }} required />
            </div>
            <div>
              <label className="filter-label" htmlFor="verification-code">Unique verification code</label>
              <input id="verification-code" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="search-input" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="filter-label">Information requested <span className="required-asterisk">*</span></label>
              <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.4rem" }}>
                {PURPOSE_OPTIONS.map((option) => (
                  <label key={option} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <input type="checkbox" checked={selectedPurposes.includes(option)} onChange={() => togglePurpose(option)} required={selectedPurposes.length === 0} />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              <Send size={16} /> Send access request
            </button>
            {requestFeedback && <div className="gov-alert gov-alert-warning">{requestFeedback}</div>}
            {directVerificationResult && (
              <div className={`gov-alert ${directVerificationResult.status === "VERIFIED" ? "gov-alert-success" : "gov-alert-warning"}`}>
                Student verification status: <strong>{directVerificationResult.status === "VERIFIED" ? "VERIFIED" : "NOT VERIFIED"}</strong>
              </div>
            )}
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
            <p style={{ color: "var(--text-muted)" }}>Enter the verification code to check if the student has approved your request.</p>
          ) : statusResult.status === "NOT_FOUND" ? (
            <div className="gov-alert gov-alert-warning">No request found for this code.</div>
          ) : (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
                <span style={{ borderRadius: "999px", padding: "0.35rem 0.7rem", background: statusResult.status === "VERIFIED" ? "#DCFCE7" : statusResult.status === "DENIED" ? "#FEE2E2" : statusResult.status === "PENDING" ? "#F3F4F6" : "#E0F2FE", color: statusResult.status === "VERIFIED" ? "#166534" : statusResult.status === "DENIED" ? "#991B1B" : "#374151", fontWeight: 700 }}>{statusResult.status}</span>
                <strong>Request ID: {statusResult.requestId}</strong>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                Requested on: {statusResult.requestedAt ? new Date(statusResult.requestedAt).toLocaleString("en-IN") : "—"}
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                {statusResult.status === "VERIFIED" ? "The student has verified their record and approved access. You can view the verified tag." : statusResult.status === "PENDING" ? "The student has not yet approved or denied your request." : statusResult.status === "APPROVED" ? "The student has approved access but the verification record is still pending confirmation." : "The student denied access for this purpose."}
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}
