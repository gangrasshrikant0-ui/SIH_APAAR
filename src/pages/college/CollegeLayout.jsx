import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Building2, UploadCloud, AlertCircle, LayoutDashboard, FileText, CheckCircle2 } from "lucide-react";
import { getCurrentUser } from "../../mocks/mockStore";
import { collegeApi } from "../../api/collegeApi";

export function CollegeLayout() {
  const currentUser = getCurrentUser();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  const refreshStats = async () => {
    try {
      const data = await collegeApi.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshStats();
  }, [location.pathname]);

  return (
    <div>
      {/* College Info Top Bar */}
      <div style={{ background: "linear-gradient(90deg, #0E2A47 0%, #133E68 100%)", color: "#FFFFFF", padding: "1.25rem 0", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
        <div className="gov-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.2)" }}>
                <Building2 size={26} />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#93C5FD", fontWeight: "700" }}>
                  Institutional Portal &bull; AICTE Approved Campus
                </span>
                <h1 style={{ fontSize: "1.35rem", color: "#FFFFFF", fontWeight: "800", margin: "2px 0" }}>
                  {currentUser?.institutionName || "Pune Institute of Computer Technology (PICT)"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem", color: "#CBD5E1" }}>
                  <span>Permanent ID: <strong>{currentUser?.aicteId || "AICTE-1-1029384"}</strong></span>
                  <span>&bull;</span>
                  <span>Nodal Officer: <strong>{currentUser?.name || "Dr. Arvind Kulkarni"}</strong></span>
                  <span>&bull;</span>
                  <span style={{ color: "#86EFAC" }}>Campus Data Isolation: Active</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            {stats && (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block" }}>Open Anomalies</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: stats.openAnomalies > 0 ? "#FCA5A5" : "#86EFAC" }}>
                    {stats.openAnomalies}
                  </span>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block" }}>Ready to Accept</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#99F6E4" }}>
                    {stats.readyToAccept}
                  </span>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#94A3B8", display: "block" }}>Accepted Records</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#86EFAC" }}>
                    {stats.acceptedEnrolment}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subnav Tabs */}
      <div className="portal-subnav">
        <div className="gov-container portal-subnav-inner">
          <nav className="portal-tabs" aria-label="College Portal Sections">
            <NavLink
              to="/college/upload"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <UploadCloud size={16} />
              <span>1. Batch Upload & Ingestion</span>
            </NavLink>

            <NavLink
              to="/college/workbench"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <AlertCircle size={16} />
              <span>2. Issue Workbench</span>
              {stats?.openAnomalies > 0 && (
                <span style={{ background: "#DC2626", color: "#FFF", borderRadius: "9999px", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>
                  {stats.openAnomalies}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/college/dashboard"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <LayoutDashboard size={16} />
              <span>3. Intake Dashboard</span>
            </NavLink>

            <NavLink
              to="/college/reports"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <FileText size={16} />
              <span>4. Compliance Reports</span>
            </NavLink>
          </nav>
        </div>
      </div>

      {/* Main Outlet for sub-screens */}
      <main style={{ padding: "2rem 0" }}>
        <Outlet context={{ refreshStats, stats }} />
      </main>
    </div>
  );
}
