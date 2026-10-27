import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LogIn, Lock } from "lucide-react";
import { getCurrentUser } from "../mocks/mockStore";

export function AccessDenied({ requiredRole, attemptedPath }) {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  return (
    <div className="gov-container" style={{ padding: "4rem 1.25rem", minHeight: "65vh" }}>
      <div
        className="gov-card"
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          textAlign: "center",
          padding: "3rem 2rem",
          borderColor: "#FECACA",
          boxShadow: "0 10px 25px -5px rgba(220, 38, 38, 0.1)"
        }}
      >
        <div
          style={{
            width: "68px",
            height: "68px",
            borderRadius: "50%",
            background: "#FEE2E2",
            color: "#DC2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem auto"
          }}
        >
          <ShieldAlert size={36} />
        </div>

        <h1 style={{ fontSize: "1.75rem", color: "#991B1B", marginBottom: "0.75rem" }}>
          Access Denied
        </h1>

        <p style={{ fontSize: "1rem", color: "var(--text-main)", marginBottom: "1.5rem", lineHeight: "1.6" }}>
          You do not have permission to access <code>{attemptedPath || "this protected resource"}</code>.
        </p>

        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid var(--border-medium)",
            borderRadius: "8px",
            padding: "1rem",
            textAlign: "left",
            fontSize: "0.875rem",
            marginBottom: "2rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Current Session:</span>
            <strong>{currentUser ? `${currentUser.name} (${currentUser.role})` : "Unauthenticated Guest"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "var(--text-muted)" }}>Required Role:</span>
            <span className="tag-badge severity-high">{requiredRole}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-light)", color: "#B91C1C", fontSize: "0.8125rem" }}>
            <Lock size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>
              <strong>Security Audit Entry Logged:</strong> This unauthorized access attempt has been timestamped and recorded in the AICTE Mock Compliance Audit Log.
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>

          <a href="/roles" className="btn btn-primary">
            <LogIn size={16} />
            Switch Demo Account
          </a>
        </div>
      </div>
    </div>
  );
}
