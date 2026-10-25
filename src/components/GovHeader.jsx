import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, LogOut, Menu, X, RotateCcw, Building2, UserCheck } from "lucide-react";
import { getCurrentUser, setCurrentUser, resetDemoState } from "../mocks/mockStore";

export function GovHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const handleLogout = () => {
    setCurrentUser(null);
    navigate("/");
  };

  const handleResetDemo = () => {
    if (window.confirm("Reset mock batches, anomalies, and logs to initial SIH prototype state?")) {
      resetDemoState();
      window.location.reload();
    }
  };

  const getRoleBadge = () => {
    if (!currentUser) return null;
    if (currentUser.role === "COLLEGE") {
      return (
        <span className="user-role-badge college">
          <Building2 size={14} />
          <span>College: {currentUser.institutionName?.split("(")[0]?.trim() || "PICT"}</span>
        </span>
      );
    }
    if (currentUser.role === "AICTE") {
      return (
        <span className="user-role-badge aicte">
          <ShieldCheck size={14} />
          <span>AICTE Central Reviewer</span>
        </span>
      );
    }
    if (currentUser.role === "EXTERNAL_VERIFIER") {
      return (
        <span className="user-role-badge verifier">
          <UserCheck size={14} />
          <span>External Verifier</span>
        </span>
      );
    }
    return null;
  };

  return (
    <header className="gov-header">
      <div className="gov-tricolor-accent"></div>
      <div className="gov-container gov-header-inner">
        {/* Brand / Logo */}
        <Link to="/" className="gov-brand" aria-label="Go to APAAR Platform Home">
          <div className="gov-brand-icon">
            <span>AP</span>
          </div>
          <div className="gov-brand-titles">
            <span className="gov-brand-super">AICTE Higher Education Layer</span>
            <span className="gov-brand-main">APAAR Student Data Platform</span>
            <span className="gov-brand-sub">Validation, Monitoring & Verification</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Main Navigation">
          <ul className={`gov-nav-links ${mobileMenuOpen ? "mobile-open" : ""}`}>
            <li>
              <a href="/#about" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
                About
              </a>
            </li>
            <li>
              <a href="/#benefits" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
                Benefits
              </a>
            </li>
            <li>
              <a href="/#how-it-works" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
                How It Works
              </a>
            </li>
            <li>
              <a href="/#faqs" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
                FAQs
              </a>
            </li>
            <li>
              <Link to="/external/verify" className="gov-nav-link" onClick={() => setMobileMenuOpen(false)}>
                Verify a Record
              </Link>
            </li>
          </ul>
        </nav>

        {/* User Role & Actions */}
        <div className="gov-auth-strip">
          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {getRoleBadge()}
              
              {/* Quick portal shortcut based on role */}
              {currentUser.role === "COLLEGE" && (
                <Link to="/college/dashboard" className="btn btn-secondary btn-sm" title="Go to College Intake Dashboard">
                  Dashboard
                </Link>
              )}
              {currentUser.role === "AICTE" && (
                <Link to="/aicte/workbench" className="btn btn-secondary btn-sm" title="Go to AICTE Workbench">
                  AICTE Portal
                </Link>
              )}
              {currentUser.role === "EXTERNAL_VERIFIER" && (
                <Link to="/external/verify" className="btn btn-secondary btn-sm" title="Verify one record">
                  Verify a Record
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Logout from current session"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <a href="/#logins" className="btn btn-primary btn-sm">
                Login / Portals
              </a>
            </div>
          )}

          {/* Prototype Reset Button */}
          <button
            type="button"
            onClick={handleResetDemo}
            className="btn btn-secondary btn-sm"
            title="Reset mock batches & anomalies to initial demo state"
            style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)" }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ display: "none" }}
            id="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
