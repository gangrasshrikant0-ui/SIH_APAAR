import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, LogOut, RotateCcw, Building2, UserCheck } from "lucide-react";
import { getCurrentUser, setCurrentUser, resetDemoState } from "../mocks/mockStore";
import { CollegeNotificationBell } from "./CollegeNotificationBell";

export function GovHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();
  const isPublicRoute = location.pathname === "/" || location.pathname === "/roles" || location.pathname.startsWith("/login/");
  const isCollegePortal = location.pathname.startsWith("/college");

  const handleLogout = () => {
    setCurrentUser(null);
    navigate("/");
  };

  const handleResetDemo = () => {
    if (window.confirm("Reset local portal records and activity logs to their initial state?")) {
      resetDemoState();
      window.location.reload();
    }
  };

  if (isCollegePortal) {
    if (!currentUser || currentUser.role !== "COLLEGE") return null;
    return (
      <header className="college-auth-header">
        <div className="college-auth-header-inner">
          <Link to="/college/upload" className="college-auth-brand" aria-label="College portal home">
            <Building2 size={20} />
            <span>{currentUser.institutionName}</span>
          </Link>
          <div className="college-auth-actions">
            <CollegeNotificationBell />
            <button type="button" onClick={handleLogout} className="btn btn-secondary btn-sm">
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>
    );
  }

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
      <div className="gov-container gov-header-inner">
        {/* Brand / Logo */}
        <Link to="/" className="gov-brand" aria-label="Go to APAAR Platform Home">
          <div className="gov-brand-icon">
            <span>AP</span>
          </div>
          <div className="gov-brand-titles">
            <span className="gov-brand-super">Academic Data Verification</span>
            <span className="gov-brand-main">EDUVÉRIFY</span>
            <span className="gov-brand-sub">Trusted records. Clear decisions.</span>
          </div>
        </Link>

        {/* User Role & Actions */}
        <div className="gov-auth-strip">
          {currentUser && !isPublicRoute ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {getRoleBadge()}
              
              {/* Quick portal shortcut based on role */}
              {currentUser.role === "COLLEGE" && (
                <Link to="/college/upload" className="btn btn-secondary btn-sm" title="Go to College Batch Upload">
                  College Portal
                </Link>
              )}
              {currentUser.role === "AICTE" && (
                <Link to="/aicte/workbench" className="btn btn-secondary btn-sm" title="Go to AICTE Workbench">
                  AICTE Portal
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
            null
          )}

          <button
            type="button"
            onClick={handleResetDemo}
            className="btn btn-secondary btn-sm"
            title="Reset local portal data"
            style={{ padding: "0.35rem 0.5rem", color: "var(--text-muted)" }}
          >
            <RotateCcw size={13} />
          </button>

        </div>
      </div>
    </header>
  );
}
