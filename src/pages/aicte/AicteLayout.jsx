import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, AlertCircle, FileText, Route, Database, UserPlus, LogOut } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { authApi } from "../../api/authApi";
import { getCurrentUser } from "../../mocks/mockStore";

export function AicteLayout() {
  const currentUser = getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  const handleLogout = async () => {
    await authApi.logout();
    navigate("/");
  };

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1 }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "rgba(255, 255, 255, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.2)" }}>
                <ShieldCheck size={26} />
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#C7D2FE", fontWeight: "700" }}>
                  All India Council for Technical Education &bull; Central Review Bureau
                </div>
                <div style={{ fontSize: "1.15rem", color: "#FFFFFF", fontWeight: "800", margin: "2px 0 0" }}>
                  National Student Data Verification &amp; Adjudication Portal
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#FFFFFF",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                padding: "0.7rem 1rem",
                cursor: "pointer",
                fontWeight: "700",
                marginLeft: "auto"
              }}
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="gov-container" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "1.5rem", alignItems: "flex-start" }}>
          <aside className="gov-card" style={{ padding: "1rem 0.75rem" }}>
            <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: 700, padding: "0 0.75rem 0.75rem" }}>AICTE Bureau</div>
            <nav className="portal-tabs" aria-label="AICTE Portal Sections" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <NavLink
                to="/aicte/dashboard"
                className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
              >
                <LayoutDashboard size={16} />
                <span>National Dashboard</span>
              </NavLink>

              <NavLink
                to="/aicte/repository"
                className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
              >
                <Database size={16} />
                <span>Central Repository</span>
              </NavLink>
              <NavLink to="/aicte/workbench" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`} style={{ justifyContent: "flex-start" }}>
                <AlertCircle size={16} />
                <span>Review Queue</span>
                {stats?.totalEscalated > 0 && (
                  <span style={{ background: "#DC2626", color: "#FFF", borderRadius: "9999px", padding: "1px 6px", fontSize: "0.7rem", fontWeight: "bold" }}>
                    {stats.totalEscalated}
                  </span>
                )}
              </NavLink>
              <NavLink to="/aicte/audit-rails" className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`} style={{ justifyContent: "flex-start" }}>
                <FileText size={16} />
                <span>Compliance Ledger</span>
              </NavLink>
              <NavLink
                to="/aicte/create-user"
                className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
              >
                <UserPlus size={16} />
                <span>Create User</span>
              </NavLink>
              <NavLink
                to="/aicte/student-journey"
                className={({ isActive }) => `portal-tab ${isActive ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
              >
                <Route size={16} />
                <span>Student Journey</span>
              </NavLink>
            </nav>
          </aside>

          <main style={{ minWidth: 0 }}>
            <Outlet context={{ refreshStats, stats }} />
          </main>
        </div>
      </div>
    </div>
  );
}
