import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Download, Eye, LogOut, ShieldCheck, X, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../mocks/mockStore";
import { logAuditEvent } from "../../mocks/mockAuditLog";
import { authApi } from "../../api/authApi";

const REQUEST_STORAGE_KEY = "apaar_verification_requests_v1";
const STUDENT_VERIFICATION_KEY = "apaar_student_verification_v1";

function readRequests() {
  try {
    const raw = localStorage.getItem(REQUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRequests(requests) {
  localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(requests));
}

function getStudentVerificationRecord(apaarId) {
  try {
    const raw = localStorage.getItem(STUDENT_VERIFICATION_KEY);
    const records = raw ? JSON.parse(raw) : {};
    if (!apaarId) return null;
    return records[apaarId] || null;
  } catch {
    return null;
  }
}

function setStudentVerificationRecord(apaarId, payload) {
  try {
    const raw = localStorage.getItem(STUDENT_VERIFICATION_KEY);
    const records = raw ? JSON.parse(raw) : {};
    records[apaarId] = payload;
    localStorage.setItem(STUDENT_VERIFICATION_KEY, JSON.stringify(records));
  } catch {
    // ignore storage failures during demo mode
  }
}

function generateVerificationCode(apaarId = "", salt = "STUDENT") {
  const digits = (apaarId || "000000000000").replace(/\D/g, "").slice(-6) || "000000";
  const seed = `${digits}${salt}`.split("").reduce((total, character) => (
    (total * 31 + character.charCodeAt(0)) % 90000
  ), 0);
  return `EDU-${digits}-2026-${String(seed + 10000).slice(-5)}`;
}

function seedStudentDemoRequests(currentUser) {
  const allRequests = readRequests();
  const templateRequests = [
    {
      id: "REQ-AARAV-APPROVED",
      requesterName: "AICTE Verification Desk",
      requesterPhone: "+91 98765 43210",
      requesterOrganisation: "AICTE Central Review Bureau",
      apaarId: currentUser.apaarId,
      verificationCode: generateVerificationCode(currentUser.apaarId, "APPROVED"),
      purposes: ["Academic verification", "Government compliance"],
      requestedAt: "2026-10-28T15:30:00.000Z",
      status: "APPROVED",
      decidedAt: "2026-10-28T16:30:00.000Z"
    },
    {
      id: "REQ-AARAV-REJECTED",
      requesterName: "ABC Skills Hiring",
      requesterPhone: "+91 99876 54321",
      requesterOrganisation: "ABC Private Limited",
      apaarId: currentUser.apaarId,
      verificationCode: generateVerificationCode(currentUser.apaarId, "REJECTED"),
      purposes: ["Employment check"],
      requestedAt: "2026-10-28T14:45:00.000Z",
      status: "DENIED",
      decidedAt: "2026-10-28T15:05:00.000Z"
    },
    {
      id: "REQ-AARAV-PENDING",
      requesterName: "National Scholarship Board",
      requesterPhone: "+91 91234 56789",
      requesterOrganisation: "Ministry of Education",
      apaarId: currentUser.apaarId,
      verificationCode: generateVerificationCode(currentUser.apaarId, "PENDING"),
      purposes: ["Government compliance"],
      requestedAt: "2026-10-28T17:20:00.000Z",
      status: "PENDING"
    }
  ];

  const otherRequests = allRequests.filter((request) => request.apaarId !== currentUser?.apaarId);
  const updatedRequests = [...otherRequests, ...templateRequests];
  writeRequests(updatedRequests);
  return templateRequests;
}

export function StudentPortal() {
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("verification");
  const [certificateVisible, setCertificateVisible] = useState(false);
  const [requestFilter, setRequestFilter] = useState("ALL");
  const [verificationRecord, setVerificationRecord] = useState(() => {
    if (!currentUser?.apaarId) return null;
    return getStudentVerificationRecord(currentUser.apaarId) || {
      apaarId: currentUser.apaarId,
      status: "VERIFIED",
      verificationCode: generateVerificationCode(currentUser.apaarId)
    };
  });

  async function handleLogout() {
    await authApi.logout();
    navigate("/");
  }

  useEffect(() => {
    if (!currentUser?.apaarId) {
      setRequests([]);
      return;
    }

    const nextRecord = getStudentVerificationRecord(currentUser.apaarId) || {
      apaarId: currentUser.apaarId,
      status: "VERIFIED",
      verificationCode: generateVerificationCode(currentUser.apaarId)
    };
    setVerificationRecord(nextRecord);
    setStudentVerificationRecord(currentUser.apaarId, nextRecord);

    const seededRequests = seedStudentDemoRequests(currentUser);
    setRequests(seededRequests);
  }, [currentUser]);

  function handleDecision(id, decision) {
    const updated = readRequests().map((request) => {
      if (request.id !== id) return request;
      return { ...request, status: decision, decidedAt: new Date().toISOString() };
    });
    writeRequests(updated);
    setRequests(updated.filter((request) => request.apaarId === currentUser?.apaarId));

    if (decision === "APPROVED" && currentUser?.apaarId) {
      const nextRecord = getStudentVerificationRecord(currentUser.apaarId) || verificationRecord;
      const approvedRecord = {
        ...nextRecord,
        status: "VERIFIED",
        verificationCode: nextRecord?.verificationCode || generateVerificationCode(currentUser.apaarId),
        issuedAt: new Date().toISOString()
      };
      setStudentVerificationRecord(currentUser.apaarId, approvedRecord);
      setVerificationRecord(approvedRecord);
    }

    setMessage(`Request ${decision === "APPROVED" ? "approved" : "denied"} successfully.`);
    logAuditEvent({
      actorName: currentUser?.name || "Student",
      actorRole: "STUDENT",
      actorEmail: currentUser?.email || "student@demo.local",
      actionType: "STUDENT_DATA_SHARE_DECISION",
      resourceType: "VERIFICATION_REQUEST",
      resourceId: id,
      details: `Student decided to ${decision.toLowerCase()} a verification request for APAAR ${currentUser?.apaarId}.`,
      changeSummary: `Data sharing request ${decision.toLowerCase()}`,
      severity: "INFO",
      issuingAuthority: currentUser?.name || "Student"
    });
  }

  function handleDownloadCertificate() {
    const link = document.createElement("a");
    link.href = "/aicte-vidya-certificate.png";
    link.download = `AICTE-VIDYA-Certificate-${currentUser.apaarId}.png`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMessage("Certificate image downloaded successfully.");
  }

  function handleOpenDigiLocker() {
    window.open("https://www.digilocker.gov.in/", "_blank", "noopener,noreferrer");
  }

  if (!currentUser) {
    return <div className="gov-container"><div className="gov-card">Please sign in as a student.</div></div>;
  }

  const activeVerificationCode = verificationRecord?.verificationCode || generateVerificationCode(currentUser.apaarId);
  const visibleRequests = requestFilter === "ALL"
    ? requests
    : requests.filter((request) => request.status === requestFilter);

  return (
    <div className="gov-container-wide student-portal-shell">
      <aside className="student-portal-sidebar">
        <div className="student-portal-sidebar-header">
          <div className="gov-brand-icon" style={{ width: "44px", height: "44px", fontSize: "1.05rem" }}>AP</div>
          <div>
            <div className="student-portal-badge">Academic data verification</div>
            <div className="student-portal-name">{currentUser.name}</div>
          </div>
        </div>

        <nav className="student-portal-nav" aria-label="Student portal navigation">
          <button
            type="button"
            className={activeTab === "verification" ? "student-portal-tab active" : "student-portal-tab"}
            onClick={() => setActiveTab("verification")}
          >
            Verification Status
          </button>
          <button
            type="button"
            className={activeTab === "requests" ? "student-portal-tab active" : "student-portal-tab"}
            onClick={() => setActiveTab("requests")}
          >
            External verifier requests
          </button>
          <button
            type="button"
            className={activeTab === "digilocker" ? "student-portal-tab active" : "student-portal-tab"}
            onClick={handleOpenDigiLocker}
          >
            DigiLocker
          </button>
        </nav>
      </aside>

      <main className="student-portal-main">
        <header className="student-portal-header">
          <div>
            <img src="/aicte-vidya-logo.jpe" alt="AICTE VIDYA logo" className="student-header-logo" />
            <div className="student-portal-overline">Student portal</div>
            <div className="student-portal-title">{currentUser.name}</div>
          </div>
          <button type="button" onClick={handleLogout} className="btn btn-secondary btn-sm student-portal-logout">
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </header>

        {message && (
          <div className="gov-alert gov-alert-success" style={{ marginBottom: "1rem" }}>{message}</div>
        )}

        {activeTab === "verification" ? (
          <div className="gov-card student-verification-card">
            <div className="student-status-banner">
              <ShieldCheck size={20} />
              <span>Congratulations! Your data has been verified.</span>
            </div>

            <div className="verification-metadata">
              <div>
                <span className="verification-label">Unique verification no.</span>
                <strong>{activeVerificationCode}</strong>
              </div>
              <div>
                <span className="verification-label">APAAR ID</span>
                <strong>{currentUser.apaarId}</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCertificateVisible(true);
                setMessage("");
              }}
            >
              <Eye size={16} />
              <span>View certificate</span>
            </button>

            {certificateVisible && (
              <div className="certificate-preview-wrap">
                <div className="certificate-view-toolbar">
                  <button type="button" className="btn btn-primary" onClick={handleDownloadCertificate}>
                    <Download size={16} />
                    <span>Click here to download your approval certificate</span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setCertificateVisible(false)}>
                    <X size={16} />
                    <span>Close certificate</span>
                  </button>
                </div>
              <div className="certificate-image-sheet">
                <img
                  src="/aicte-vidya-certificate.png"
                  alt="AICTE VIDYA verified student certificate"
                  className="certificate-image"
                />
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="gov-card" style={{ padding: "1.25rem" }}>
            <div className="student-request-heading">
              <div>
                <h3 style={{ marginTop: 0, marginBottom: "0.25rem" }}>External verifier requests</h3>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Review and manage requests to access your verified record.</p>
              </div>
              <label className="student-request-filter">
                <span>Filter</span>
                <select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}>
                  <option value="ALL">All requests</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DENIED">Declined</option>
                </select>
              </label>
            </div>
            {visibleRequests.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No external verifier requests for your student record yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "0.9rem" }}>
                {visibleRequests.map((request) => (
                  <div key={request.id} style={{ border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gov-navy-900)" }}>{request.requesterName}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{request.requesterOrganisation || "Organisation not specified"}</div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          padding: "0.25rem 0.6rem",
                          borderRadius: "999px",
                          background: request.status === "APPROVED" ? "#DCFCE7" : request.status === "DENIED" ? "#FEE2E2" : "#F3F4F6",
                          color: request.status === "APPROVED" ? "#166534" : request.status === "DENIED" ? "#991B1B" : "#374151",
                          fontSize: "0.75rem",
                          fontWeight: 700
                        }}
                      >
                        {request.status === "APPROVED" ? <CheckCircle2 size={12} /> : request.status === "DENIED" ? <XCircle size={12} /> : <Clock3 size={12} />}
                        {request.status || "PENDING"}
                      </span>
                    </div>

                    <div style={{ marginTop: "0.75rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      Purpose: {request.purposes?.join(", ") || "Not specified"}
                    </div>
                    <div style={{ marginTop: "0.35rem", color: "var(--text-muted)", fontSize: "0.78rem" }}>
                      Verification code: <strong>{request.verificationCode || activeVerificationCode}</strong>
                    </div>

                    {request.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDecision(request.id, "APPROVED")}>Allow access</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDecision(request.id, "DENIED")}>Deny access</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: "0.8rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Decision recorded: {request.status} on {new Date(request.decidedAt || request.requestedAt).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
