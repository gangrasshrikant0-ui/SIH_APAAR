import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser, setCollegeConsent } from "../../mocks/mockStore";
import { COLLEGE_DEFAULT_PATH } from "./collegeNav";

export function CollegeConsentPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [declined, setDeclined] = useState(false);

  const accept = () => {
    setCollegeConsent(user?.id, true);
    navigate(COLLEGE_DEFAULT_PATH, { replace: true });
  };

  const decline = () => {
    setCollegeConsent(user?.id, false);
    setDeclined(true);
  };

  return (
    <main className="gov-container" style={{ padding: "2.5rem 1rem 4rem" }}>
      <div className="gov-card" style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <ShieldAlert size={28} color="#1E40AF" />
          <div>
            <p className="landing-eyebrow" style={{ marginBottom: "0.2rem" }}>Institutional consent</p>
            <h1 style={{ fontSize: "1.5rem" }}>Institutional Data Sharing & Verification Consent</h1>
          </div>
        </div>
        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
          Signed in as <strong>{user?.name}</strong> for <strong>{user?.institutionName}</strong> ({user?.id}). This declaration does not replace legally required consent or official data-sharing authorization.
        </p>
        <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1.25rem", lineHeight: 1.6, fontSize: "0.9375rem" }}>
          <p>By proceeding, I confirm that I am an authorized representative of the institution assigned to this account.</p>
          <p>I acknowledge that EDUVÉRIFY processes academic student data for institutional submission, validation, and monitoring.</p>
          <p>I understand that submitted records may contain sensitive student information, including student identifiers and academic details.</p>
          <p>I consent, on behalf of the institution, to the processing and display of student records submitted through this portal for the purposes of:</p>
          <ul style={{ margin: "0.75rem 0 0.75rem 1.25rem" }}>
            <li>Academic data validation</li>
            <li>Identity and record consistency checks</li>
            <li>Duplicate and cross-institution conflict detection</li>
            <li>Institutional reporting and compliance monitoring</li>
            <li>Issue resolution and verification</li>
          </ul>
          <p>I understand that records flagged by the system may require review or correction by the institution.</p>
          <p>This portal does not connect to APAAR or AICTE systems and does not perform official identity verification.</p>
          <p>I understand that I may not proceed to the institution portal unless I accept this declaration.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={accept}>I Agree & Continue</button>
          <button type="button" className="btn btn-secondary" onClick={decline}>Decline</button>
        </div>
      </div>
      {declined && (
        <div className="modal-backdrop">
          <div
            className="modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="consent-restricted-title"
            aria-describedby="consent-restricted-message"
          >
            <h2 id="consent-restricted-title">Access restricted</h2>
            <p id="consent-restricted-message" style={{ margin: "0.75rem 0 1.25rem" }}>
              Access is restricted until permissions are granted.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setDeclined(false)}>
              Review consent
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
