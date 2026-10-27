import React, { useState, useEffect } from "react";
import { PhoneCall, HelpCircle, Globe, Check } from "lucide-react";

export function TopGovStrip() {
  const [fontScale, setFontScale] = useState(1);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [lang, setLang] = useState("en");

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", fontScale.toString());
  }, [fontScale]);

  return (
    <>
      <div className="gov-top-strip">
        <div className="gov-container gov-top-strip-inner">
          <div className="gov-strip-left">
            <span className="gov-emblem-placeholder">
              <span className="gov-flag-bar">
                <span></span>
                <span></span>
                <span></span>
              </span>
              Academic Data Verification Portal
            </span>
            <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>|</span>
            <span style={{ color: "#CBD5E1" }}>
              Student Record Verification
            </span>
          </div>

          <div className="gov-strip-right">
            {/* Accessibility Font Size Controls */}
            <div className="accessibility-controls" aria-label="Text size accessibility controls">
              <button
                type="button"
                className={`accessibility-btn ${fontScale === 0.9 ? "active" : ""}`}
                onClick={() => setFontScale(0.9)}
                title="Decrease font size"
                aria-label="Decrease font size"
              >
                A-
              </button>
              <button
                type="button"
                className={`accessibility-btn ${fontScale === 1.0 ? "active" : ""}`}
                onClick={() => setFontScale(1.0)}
                title="Standard font size"
                aria-label="Standard font size"
              >
                A
              </button>
              <button
                type="button"
                className={`accessibility-btn ${fontScale === 1.15 ? "active" : ""}`}
                onClick={() => setFontScale(1.15)}
                title="Increase font size"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>

            <span style={{ color: "rgba(255, 255, 255, 0.3)" }}>|</span>

            {/* Helpline Placeholder */}
            <span className="top-strip-link" title="Official Helpline placeholder">
              <PhoneCall size={12} />
              <span>Helpline: 1800-111-667</span>
            </span>

            {/* Get Help Link */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="top-strip-link"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <HelpCircle size={12} />
              <span>Get Help</span>
            </button>

            {/* Language Selector */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Globe size={12} style={{ color: "#CBD5E1" }} />
              <select
                aria-label="Select portal language"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                style={{
                  background: "transparent",
                  color: "#FFFFFF",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "3px",
                  fontSize: "0.75rem",
                  padding: "1px 4px",
                  cursor: "pointer"
                }}
              >
                <option value="en" style={{ color: "#000" }}>English</option>
                <option value="hi" style={{ color: "#000" }}>हिन्दी</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "540px", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)" }}>Portal Help & Guidelines</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowHelpModal(false)}
              >
                Close
              </button>
            </div>
            <div style={{ fontSize: "0.9375rem", color: "var(--text-main)", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <p>
                <strong>About this Platform:</strong> This is a centralized validation, monitoring, and verification layer for AICTE under SIH 2026.
              </p>
              <div style={{ background: "#F1F5F9", padding: "0.85rem", borderRadius: "8px", fontSize: "0.85rem" }}>
                <strong>Key Principles:</strong>
                <ul style={{ paddingLeft: "1.25rem", marginTop: "0.35rem" }}>
                  <li>It does NOT replace college ERPs; CSV is available and API integration is planned, not connected.</li>
                  <li>It does NOT generate APAAR IDs (issued by central government).</li>
                  <li>It NEVER modifies the approved intake rulebook.</li>
                  <li>APAAR IDs are format-checked (12 digits), not identity-verified.</li>
                </ul>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                For technical queries, review institution batch details or switch between College, AICTE, and Student portals.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
