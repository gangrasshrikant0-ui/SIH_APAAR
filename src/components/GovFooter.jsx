import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Info } from "lucide-react";

export function GovFooter() {
  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2.5rem", marginBottom: "2.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontWeight: "bold" }}>
                AP
              </div>
              <span style={{ color: "#FFFFFF", fontWeight: "700", fontSize: "1.05rem" }}>
                APAAR Student Data Platform
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", lineHeight: "1.6", color: "#94A3B8" }}>
              A centralized validation, monitoring, and verification layer for AICTE-approved institutions. Validates student enrolment records, tracks anomaly resolution, and delivers verifiable student credentials.
            </p>
          </div>

          <div>
            <h4 style={{ color: "#FFFFFF", fontSize: "0.9375rem", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Quick Navigation
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
              <li><a href="/#about">About Platform</a></li>
              <li><a href="/#benefits">Benefits & Capabilities</a></li>
              <li><a href="/#how-it-works">How It Works</a></li>
              <li><a href="/#faqs">Frequently Asked Questions</a></li>
              <li><Link to="/verify/demo-mode">Public Verification Portal</Link></li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: "#FFFFFF", fontSize: "0.9375rem", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Legal & Compliance
            </h4>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
              <li><a href="#terms" onClick={(e) => { e.preventDefault(); alert("Terms of Service: This prototype operates exclusively on synthetic data for SIH 2026 evaluation."); }}>Terms of Service</a></li>
              <li><a href="#privacy" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: Digilocker and APAAR connections are simulated. No personally identifiable information (PII) is stored."); }}>Privacy Policy</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); alert("Contact: Smart India Hackathon 2026 AICTE Evaluation Team."); }}>Contact Support</a></li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: "#FFFFFF", fontSize: "0.9375rem", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Evaluation Principles
            </h4>
            <div style={{ background: "rgba(255, 255, 255, 0.05)", padding: "0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", fontSize: "0.8125rem", color: "#CBD5E1", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div><strong style={{ color: "#FFF" }}>• ACCEPTED ≠ VERIFIED:</strong> Accepted means automated checks passed. Verified requires an authorized source.</div>
              <div><strong style={{ color: "#FFF" }}>• APAAR Check:</strong> Format-checked (12 digits), not identity-verified.</div>
              <div><strong style={{ color: "#FFF" }}>• Cross-Institution:</strong> Flagged for review, never labeled fraud.</div>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", fontSize: "0.8125rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#CBD5E1" }}>
            <Info size={16} style={{ color: "var(--accent-saffron)" }} />
            <span>
              <strong>SIH 2026 prototype. Synthetic data. Not an official government site.</strong>
            </span>
          </div>
          <div>
            Designed with UX4G Accessibility Standards &bull; Smart India Hackathon 2026
          </div>
        </div>
      </div>
    </footer>
  );
}
