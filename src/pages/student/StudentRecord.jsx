import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap, ArrowRight } from "lucide-react";

export function StudentRecord() {
  return (
    <div className="gov-container" style={{ padding: "3rem 1.25rem" }}>
      <div className="gov-card" style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
          <GraduationCap size={28} />
        </div>
        <h2 style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Student Credential & Consent (Phase 3 Preview)
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "1.5rem" }}>
          Student portal with consent management, tamper-evident QR code, and bilingual printable certificates. Will be fully built out in Phase 3.
        </p>
        <Link to="/college/workbench" className="btn btn-secondary">
          <span>Go to College Issue Workbench (Phase 1)</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
