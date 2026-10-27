import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { UploadCloud, AlertCircle, LayoutDashboard, FileText, Route } from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { COLLEGE_PORTAL_TABS } from "./collegeNav";

const TAB_ICONS = {
  "/college/dashboard": LayoutDashboard,
  "/college/upload": UploadCloud,
  "/college/workbench": AlertCircle,
  "/college/reports": FileText,
  "/college/student-journey": Route
};

export function CollegeLayout() {
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
    <div className="college-portal-shell">
      <aside className="college-sidebar">
        <nav className="college-sidebar-nav" aria-label="College Portal Sections">
            {COLLEGE_PORTAL_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.to];
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
                >
                  {Icon ? <Icon size={16} /> : null}
                  <span>{tab.label}</span>
                  {tab.to === "/college/workbench" && stats?.openAnomalies > 0 && (
                    <span style={{ background: "#DC2626", color: "#FFF", borderRadius: "9999px", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>
                      {stats.openAnomalies}
                    </span>
                  )}
                </NavLink>
              );
            })}
        </nav>
      </aside>

      {/* Main Outlet for sub-screens */}
      <main className="college-portal-content">
        <Outlet context={{ refreshStats, stats }} />
      </main>
    </div>
  );
}
