import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, AlertTriangle, EyeOff, Search, ArrowLeft, CheckCircle2 } from "lucide-react";
import { verificationApi } from "../../api/verificationApi";

export function PublicVerify() {
  const { token } = useParams();
  const [currentToken, setCurrentToken] = useState(token || "111122223333");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const performVerification = async (tok) => {
    setLoading(true);
    try {
      const data = await verificationApi.verifyToken(tok);
      setResult(data);
    } catch (e) {
      setResult({ status: "INVALID", message: "Verification failed." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performVerification(currentToken);
  }, []);

  const handleTestToken = (tok) => {
    setCurrentToken(tok);
    performVerification(tok);
  };

  return (
    <div className="gov-container" style={{ padding: "3rem 1.25rem", maxWidth: "780px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          <ArrowLeft size={14} />
          <span>Back to Home</span>
        </Link>
        <h1 style={{ fontSize: "1.85rem", color: "var(--gov-navy-900)", marginBottom: "0.35rem" }}>
          Public Credential Verification
        </h1>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          Official single-record verification service for external employers, universities, and regulators.
        </p>
      </div>

      {/* Demo Test Token Switcher */}
      <div style={{ background: "#F1F5F9", borderRadius: "8px", padding: "0.85rem 1rem", marginBottom: "1.75rem", border: "1px solid var(--border-light)", fontSize: "0.8125rem" }}>
        <span style={{ fontWeight: "700", color: "var(--gov-navy-900)", display: "block", marginBottom: "0.5rem" }}>
          Test Prototype Verification States (Demo Mode):
        </span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn btn-sm ${currentToken === "111122223333" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTestToken("111122223333")}
          >
            1. Valid Record (Consent Granted)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${currentToken === "no-consent" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTestToken("no-consent")}
          >
            2. No-Consent (Withdrawn)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${currentToken === "revoked" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTestToken("revoked")}
          >
            3. Revoked Credential
          </button>
          <button
            type="button"
            className={`btn btn-sm ${currentToken === "unknown-random" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => handleTestToken("unknown-random")}
          >
            4. Invalid Token
          </button>
        </div>
      </div>

      {/* Verification Result Card */}
      {loading ? (
        <div className="gov-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--text-muted)" }}>Verifying token against Central Student Enrolment Repository...</p>
        </div>
      ) : (
        <div className="gov-card">
          {/* STATE 1: VALID */}
          {result?.status === "VALID" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border-light)", marginBottom: "1.25rem" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <span className="status-badge ACCEPTED">Credential Accepted</span>
                  <h3 style={{ fontSize: "1.35rem", color: "var(--gov-navy-900)", marginTop: "2px" }}>
                    Verified Enrolment Record
                  </h3>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "1.25rem", border: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.9375rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Student Name:</span>
                  <strong>{result.studentName}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Institutional PRN:</span>
                  <code>{result.studentId}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>APAAR ID:</span>
                  <div>
                    <code>{result.apaarId}</code>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                      format-checked, not identity-verified
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-light)", paddingBottom: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Institution:</span>
                  <strong>{result.institutionName}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Programme:</span>
                  <strong>{result.programme}</strong>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Verified At: {new Date(result.verifiedAt).toLocaleString()}</span>
                <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
                  {result.demoSource}
                </span>
              </div>
            </div>
          )}

          {/* STATE 2: NO CONSENT */}
          {result?.status === "NO_CONSENT" && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <EyeOff size={28} />
              </div>
              <h3 style={{ fontSize: "1.35rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
                Consent Withdrawn by Student
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 1.5rem auto", lineHeight: "1.6" }}>
                {result.message} Under student privacy regulations, verification details cannot be displayed without explicit affirmative student consent.
              </p>
              <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
                {result.demoSource}
              </span>
            </div>
          )}

          {/* STATE 3: REVOKED */}
          {result?.status === "REVOKED" && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#FEE2E2", color: "#B91C1C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <AlertTriangle size={28} />
              </div>
              <h3 style={{ fontSize: "1.35rem", color: "#991B1B", marginBottom: "0.5rem" }}>
                Credential Revoked
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 1.5rem auto", lineHeight: "1.6" }}>
                {result.message}
              </p>
              <span className="tag-badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                Status: REVOKED &bull; {result.demoSource}
              </span>
            </div>
          )}

          {/* STATE 4: INVALID */}
          {result?.status === "INVALID" && (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#F1F5F9", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <ShieldAlert size={28} />
              </div>
              <h3 style={{ fontSize: "1.35rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
                Invalid Verification Token
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", maxWidth: "460px", margin: "0 auto 1.5rem auto", lineHeight: "1.6" }}>
                {result.message} Ensure that the URL token was copied accurately from an official certificate.
              </p>
              <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
                {result.demoSource}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
