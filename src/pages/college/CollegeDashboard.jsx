import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Percent,
  Clock,
  ArrowRight,
  RefreshCw,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  AlertOctagon
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { StatusBadge } from "../../components/StatusBadge";
import { getBackendDashboard, isBackendConfigured } from "../../api/ingestionApi";

export function CollegeDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  const loadStats = async () => {
    try {
      const backend = isBackendConfigured() ? await getBackendDashboard("INSTITUTION") : null;
      const data = backend?.offline || !backend ? await collegeApi.getDashboardStats() : backend;
      setOfflineNotice(backend?.offline ? "Backend offline: using demo data" : "");
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    const poll = setInterval(() => { if (!document.hidden) loadStats(); }, 15000);
    const refresh = () => { if (!document.hidden) loadStats(); };
    window.addEventListener("apaar:data-sync", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(poll); window.removeEventListener("apaar:data-sync", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  if (loading || !stats) {
    return (
      <div className="gov-container" style={{ textAlign: "center", padding: "4rem" }}>
        <RefreshCw size={24} className="spin-slow" style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }} />
        <p style={{ color: "var(--text-muted)" }}>Loading Institutional Enrolment & Intake metrics...</p>
      </div>
    );
  }

  return (
    <div className="gov-container">
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
              Institutional Intake & Enrolment Dashboard
            </h2>
            <span className="tag-badge" style={{ background: "#EFF6FF", color: "#1E40AF" }}>
              Own Data Only &bull; PICT
            </span>
          </div>
          {offlineNotice && <p className="gov-alert gov-alert-warning">{offlineNotice}</p>}
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Refreshable prototype compliance monitoring against the AICTE Approval Master rulebook. Data is synthetic and local; only accepted records count toward enrolment.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadStats}
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={13} />
            <span>Refresh Numbers</span>
          </button>

          <Link to="/college/workbench" className="btn btn-primary btn-sm">
            <span>Issue Workbench</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Approved Intake */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: "700" }}>APPROVED INTAKE</span>
            <Building2 size={18} style={{ color: "var(--gov-navy-600)" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: "var(--gov-navy-900)", lineHeight: "1.1" }}>
            {stats.approvedIntake}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            AICTE Sanction (4 Departments)
          </span>
        </div>

        {/* Accepted Enrolment */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#166534", fontWeight: "700" }}>ACCEPTED ENROLMENT</span>
            <CheckCircle2 size={18} style={{ color: "#166534" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: "#166534", lineHeight: "1.1" }}>
            {stats.acceptedEnrolment}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            Only accepted rows counted
          </span>
        </div>

        {/* Overall Utilisation % */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#0369A1", fontWeight: "700" }}>SEAT UTILISATION %</span>
            <Percent size={18} style={{ color: "#0284C7" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: stats.utilisationPercentage > 100 ? "#DC2626" : "#0284C7", lineHeight: "1.1" }}>
            {stats.utilisationPercentage}%
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            {stats.acceptedEnrolment} of {stats.approvedIntake} approved seats
          </span>
        </div>

        {/* Open Anomalies */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: stats.openAnomalies > 0 ? "#DC2626" : "#166534", fontWeight: "700" }}>OPEN ANOMALIES</span>
            <AlertTriangle size={18} style={{ color: stats.openAnomalies > 0 ? "#DC2626" : "#166534" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: stats.openAnomalies > 0 ? "#DC2626" : "#166534", lineHeight: "1.1" }}>
            {stats.openAnomalies}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", marginTop: "6px" }}>
            <span>Overdue: <strong style={{ color: stats.overdueAnomalies > 0 ? "#DC2626" : "inherit" }}>{stats.overdueAnomalies}</strong></span>
            <span>&bull;</span>
            <span>Escalated: <strong style={{ color: stats.escalatedAnomalies > 0 ? "#7C3AED" : "inherit" }}>{stats.escalatedAnomalies}</strong></span>
          </div>
        </div>
      </div>

      {/* Programme Intake vs Enrolment Table with Utilisation Bars */}
      <div className="gov-card" style={{ marginBottom: "2rem" }}>
        <div className="gov-card-header">
          <div>
            <h3 style={{ fontSize: "1.2rem", color: "var(--gov-navy-900)" }}>
              Programme-wise Intake vs Accepted Enrolment
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Includes visual utilisation progress bar (turns red if enrolment exceeds 100% approved intake).
            </p>
          </div>
          <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
            AY 2026-2027
          </span>
        </div>

        <div className="data-table-wrapper" style={{ border: "none", boxShadow: "none" }}>
          <table className="data-table" aria-label="Programme Intake Table">
            <thead>
              <tr>
                <th scope="col">Department & Programme</th>
                <th scope="col">Degree</th>
                <th scope="col" style={{ textAlign: "center" }}>Approved Intake</th>
                <th scope="col" style={{ textAlign: "center" }}>Accepted Enrolment</th>
                <th scope="col" style={{ textAlign: "center" }}>Pending Ready</th>
                <th scope="col" style={{ textAlign: "center" }}>Open Anomalies</th>
                <th scope="col" style={{ minWidth: "220px" }}>Seat Utilisation Bar</th>
              </tr>
            </thead>
            <tbody>
              {stats.programmes.map((p) => {
                const isOver100 = p.acceptedEnrolment > p.approvedIntake;
                let barColor = "#0284C7";
                if (isOver100) barColor = "#DC2626";
                else if (p.utilisation >= 85) barColor = "#D97706";
                else if (p.utilisation > 0) barColor = "#16A34A";

                return (
                  <tr key={p.code}>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--gov-navy-900)" }}>{p.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Code: {p.code}</div>
                    </td>
                    <td>{p.degree}</td>
                    <td style={{ textAlign: "center", fontWeight: "700" }}>{p.approvedIntake}</td>
                    <td style={{ textAlign: "center", fontWeight: "700", color: "#166534" }}>{p.acceptedEnrolment}</td>
                    <td style={{ textAlign: "center", color: "#0F766E", fontWeight: "600" }}>{p.readyToAccept}</td>
                    <td style={{ textAlign: "center", color: p.anomaliesCount > 0 ? "#DC2626" : "var(--text-muted)", fontWeight: "700" }}>
                      {p.anomaliesCount}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "4px", fontWeight: "700" }}>
                        <span style={{ color: isOver100 ? "#DC2626" : "var(--text-main)" }}>
                          {p.utilisation}%
                        </span>
                        {isOver100 && (
                          <span style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <AlertOctagon size={11} /> OVER 100% INTAKE
                          </span>
                        )}
                      </div>
                      <div style={{ width: "100%", height: "9px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(p.utilisation, 100)}%`,
                            backgroundColor: barColor,
                            borderRadius: "9999px",
                            transition: "width 0.4s ease"
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seat Category Counts Grid */}
      <div className="gov-card">
        <div className="gov-card-header">
          <div>
            <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)" }}>
              Seat-Category Enrolment Breakdown
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Official categorization of accepted records against statutory quota limits.
            </p>
          </div>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Approval Master Compliant
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>GENERAL</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.GENERAL}</strong>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>OBC</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.OBC}</strong>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>SC</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.SC}</strong>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>ST</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.ST}</strong>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>EWS</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.EWS}</strong>
          </div>
          <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", fontWeight: "700" }}>TFWS</span>
            <strong style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>{stats.categoryCounts.TFWS}</strong>
          </div>
          <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "8px", padding: "1rem", textAlign: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "#92400E", display: "block", fontWeight: "700" }}>NRI / OCI / FN</span>
            <strong style={{ fontSize: "1.5rem", color: "#B45309" }}>{stats.categoryCounts.NRI_FN}</strong>
            <span style={{ fontSize: "0.7rem", color: "#92400E", display: "block", marginTop: "2px" }}>
              Limit: <strong>{stats.categoryCounts.NRI_FN_LIMIT} max</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
