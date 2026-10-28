import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut } from "lucide-react";
import { authApi } from "../../api/authApi";

export function ExternalVerifierLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await authApi.logout();
    navigate("/");
  }

  return (
    <div className="gov-container-wide" style={{ paddingTop: "2rem", paddingBottom: "3rem" }}>
      <header style={{ background: "linear-gradient(90deg, #1E1B4B 0%, #312E81 100%)", color: "#FFFFFF", padding: "1rem 1.25rem", borderRadius: "14px", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <img src="/aicte-vidya-logo.jpe" alt="AICTE VIDYA logo" className="portal-header-logo" />
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#C7D2FE", fontWeight: 700 }}>External verification</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800 }}>Verification access portal</div>
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

      <nav className="portal-tabs" aria-label="External Verifier navigation">
        <NavLink to="/external/verify" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}>
          1. Generate request
        </NavLink>
        <NavLink to="/external/history" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}>
          2. Verfication History
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
