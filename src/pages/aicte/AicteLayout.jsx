import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, AlertCircle, FileText } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { getCurrentUser } from "../../mocks/mockStore";

export function AicteLayout() {
  const currentUser = getCurrentUser();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  const refreshStats = async () => {
    try {
      const data = await aicteApi.getAicteDashboardStats("ALL");
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
      {/* AICTE Bureau Top Banner */}
      <div style={{ background: "linear-gradient(90deg, #1E1B4B 0%, #312E81 100%)", color: "#FFFFFF", padding: "1.25rem 0", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
        <div className="gov-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.2)" }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#C7D2FE", fontWeight: "700" }}>
                  All India Council for Technical Education &bull; Central Review Bureau
                </span>
                <h1 style={{ fontSize: "1.35rem", color: "#FFFFFF", fontWeight: "800", margin: "2px 0" }}>
                  National Student Data Verification &amp; Adjudication Portal
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8125rem", color: "#E0E7FF" }}>
                  <span>Reviewer: <strong>{currentUser?.name || "Dr. M. Jagadesh Kumar"}</strong></span>
                  <span>&bull;</span>
                  <span>Jurisdiction: <strong>National (All AICTE Institutions)</strong></span>
                  <span>&bull;</span>
                  <span style={{ color: "#86EFAC" }}>Central Oversight Active</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            {stats && (
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#CBD5E1", display: "block" }}>Pending Review</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#FDE047" }}>
                    {stats.totalPendingReview}
                  </span>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#CBD5E1", display: "block" }}>Escalated Cases</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#FCA5A5" }}>
                    {stats.totalEscalated}
                  </span>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "center" }}>
                  <span style={{ fontSize: "0.7rem", color: "#CBD5E1", display: "block" }}>Accepted Enrolment</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#86EFAC" }}>
                    {stats.totalAcceptedEnrolment}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subnav Tabs — 3 tabs (audit log merged into National Reports) */}
      <div className="portal-subnav">
        <div className="gov-container portal-subnav-inner">
          <nav className="portal-tabs" aria-label="AICTE Portal Sections">
            <NavLink
              to="/aicte/dashboard"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <LayoutDashboard size={16} />
              <span>1. National Dashboard</span>
            </NavLink>

            <NavLink
              to="/aicte/workbench"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <AlertCircle size={16} />
              <span>2. Review Queue</span>
              {stats?.totalEscalated > 0 && (
                <span style={{ background: "#DC2626", color: "#FFF", borderRadius: "9999px", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>
                  {stats.totalEscalated}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/aicte/reports"
              className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
            >
              <FileText size={16} />
              <span>3. National Reports</span>
            </NavLink>
          </nav>
        </div>
      </div>

      <main style={{ padding: "2rem 0" }}>
        <Outlet context={{ refreshStats, stats }} />
      </main>
    </div>
  );
}
