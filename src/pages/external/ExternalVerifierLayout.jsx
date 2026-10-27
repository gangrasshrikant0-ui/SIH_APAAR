import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export function ExternalVerifierLayout() {
  return (
    <div className="gov-container-wide" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
          <ShieldCheck size={24} style={{ color: "var(--gov-navy-700)" }} />
          <h1 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>External Verifier Portal</h1>
        </div>
        <p style={{ color: "var(--text-muted)", lineHeight: "1.5" }}>
          Prototype: records are synthetic. Verification is simulated. External verifiers can see only the permitted fields of one consented record.
        </p>
      </div>

      <nav className="portal-tabs" aria-label="External Verifier navigation">
        <NavLink to="/external/verify" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}>
          1. Record Review
        </NavLink>
        <NavLink to="/external/history" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}>
          2. My Verification History
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
