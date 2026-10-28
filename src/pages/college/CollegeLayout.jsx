import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  UploadCloud,
  AlertCircle,
  LayoutDashboard,
  FileText,
  Route,
  LogOut,
  Building2
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { authApi } from "../../api/authApi";
import { COLLEGE_PORTAL_TABS } from "./collegeNav";
import { CollegeConsentPage } from "./CollegeConsentPage";
import { CollegeNotificationBell } from "../../components/CollegeNotificationBell";
import { getCurrentUser, hasCollegeConsent } from "../../mocks/mockStore";

const TAB_ICONS = {
  "/college/dashboard": LayoutDashboard,
  "/college/upload": UploadCloud,
  "/college/workbench": AlertCircle,
  "/college/reports": FileText,
  "/college/student-journey": Route
};

export function CollegeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [stats, setStats] = useState(null);
  const consentAccepted = hasCollegeConsent(currentUser?.id);

  const handleLogout = async () => {
    await authApi.logout();
    navigate("/");
  };

  const refreshStats = async () => {
    try {
      const data = await collegeApi.getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (consentAccepted) refreshStats();
  }, [location.pathname, consentAccepted]);

  if (!consentAccepted) {
    return <CollegeConsentPage />;
  }

  return (
    <>
      <header
        style={{
          background: "linear-gradient(90deg, #1E1B4B 0%, #312E81 100%)",
          color: "#FFFFFF",
          padding: "1.1rem 0",
          borderBottom: "1px solid rgba(255,255,255,0.12)"
        }}
      >
        <div
          className="gov-container"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap"
          }}
        >
          <img src="/aicte-vidya-logo.jpe" alt="AICTE VIDYA logo" className="portal-header-logo" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.8rem",
              minWidth: 0
            }}
          >
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Building2 size={22} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.72rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#C7D2FE",
                  fontWeight: 700
                }}
              >
                Institutional Portal
              </div>

              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#FFFFFF",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {currentUser?.institutionName || "College / Institution"}
              </div>

              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#E0E7FF",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                AICTE ID:{" "}
                <strong>
                  {currentUser?.aicteId || "AICTE ID unavailable"}
                </strong>
              </div>
            </div>
          </div>

          {/* Notifications and Logout */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <CollegeNotificationBell />

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "rgba(255,255,255,0.08)",
                color: "#FFFFFF",
                border: "1px solid rgba(255,255,255,0.2)",
                boxShadow: "none"
              }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="college-portal-shell">
        <aside className="college-sidebar">
          <nav
            className="college-sidebar-nav"
            aria-label="College Portal Sections"
          >
            {COLLEGE_PORTAL_TABS.map((tab) => {
              const Icon = TAB_ICONS[tab.to];

              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `portal-tab ${isActive ? "active" : ""}`
                  }
                >
                  {Icon ? <Icon size={16} /> : null}
                  <span>{tab.label}</span>

                  {tab.to === "/college/workbench" &&
                    stats?.openAnomalies > 0 && (
                      <span
                        style={{
                          background: "#DC2626",
                          color: "#FFF",
                          borderRadius: "9999px",
                          padding: "1px 6px",
                          fontSize: "0.7rem",
                          fontWeight: "bold"
                        }}
                      >
                        {stats.openAnomalies}
                      </span>
                    )}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="college-portal-content">
          <Outlet context={{ refreshStats, stats }} />
        </main>
      </div>
    </>
  );
}