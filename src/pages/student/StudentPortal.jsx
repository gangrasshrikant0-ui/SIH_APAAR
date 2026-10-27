import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, XCircle, ShieldCheck, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../../mocks/mockStore";
import { logAuditEvent } from "../../mocks/mockAuditLog";
import { authApi } from "../../api/authApi";

const REQUEST_STORAGE_KEY = "apaar_verification_requests_v1";

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

export function StudentPortal() {
  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");

  async function handleLogout() {
    await authApi.logout();
    navigate("/");
  }

  useEffect(() => {
    const allRequests = readRequests();
    const myRequests = allRequests.filter((request) => request.apaarId === currentUser?.apaarId);

    if (currentUser?.apaarId && myRequests.length === 0) {
      const demoRequest = {
        id: `REQ-DEMO-${Date.now()}`,
        requesterName: "AICTE Verification Desk",
        requesterPhone: "+91 98765 43210",
        apaarId: currentUser.apaarId,
        purposes: ["Academic verification", "Government compliance"],
        requestedAt: new Date().toISOString(),
        status: "PENDING"
      };
      const updatedRequests = [demoRequest, ...allRequests];
      writeRequests(updatedRequests);
      setRequests([demoRequest]);
      return;
    }

    setRequests(myRequests);
  }, [currentUser]);

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "PENDING"),
    [requests]
  );

  function handleDecision(id, decision) {
    const updated = readRequests().map((request) => {
      if (request.id !== id) return request;
      return { ...request, status: decision, decidedAt: new Date().toISOString() };
    });
    writeRequests(updated);
    setRequests(updated.filter((request) => request.apaarId === currentUser?.apaarId));
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

  if (!currentUser) {
    return <div className="gov-container"><div className="gov-card">Please sign in as a student.</div></div>;
  }

  return (
    <div className="gov-container-wide">
      <header style={{ background: "linear-gradient(90deg, #1E1B4B 0%, #312E81 100%)", color: "#FFFFFF", padding: "1rem 1.25rem", borderRadius: "14px", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#C7D2FE", fontWeight: 700 }}>Student portal</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{currentUser.name}</div>
              <div style={{ fontSize: "0.8rem", color: "#E0E7FF" }}>PRN / Enrollment: <strong>{currentUser.prn || currentUser.apaarId}</strong></div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            style={{ background: "rgba(255,255,255,0.08)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)", display: "inline-flex", alignItems: "center", gap: "0.45rem" }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {message && (
        <div className="gov-alert gov-alert-success" style={{ marginBottom: "1rem" }}>{message}</div>
      )}

      <div className="gov-card" style={{ padding: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Verification access requests</h3>
        {requests.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No verification requests for your student record yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {requests.map((request) => (
              <div key={request.id} style={{ border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--gov-navy-900)" }}>{request.requesterName}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{request.requesterPhone}</div>
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

                <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Requested on {new Date(request.requestedAt).toLocaleString("en-IN")}
                </div>

                {request.status === "PENDING" ? (
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDecision(request.id, "APPROVED")}>Approve</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDecision(request.id, "DENIED")}>Deny</button>
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
    </div>
  );
}
