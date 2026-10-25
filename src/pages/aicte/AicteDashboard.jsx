import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Percent,
  RefreshCw,
  ArrowRight,
  Filter,
  ShieldCheck,
  AlertOctagon,
  Download
} from "lucide-react";
import { aicteApi } from "../../api/aicteApi";

export function AicteDashboard() {
  const [institutionFilter, setInstitutionFilter] = useState("ALL");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await aicteApi.getAicteDashboardStats(institutionFilter);
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [institutionFilter]);

  if (loading || !stats) {
    return (
      <div className="gov-container" style={{ textAlign: "center", padding: "4rem" }}>
        <RefreshCw size={24} className="spin-slow" style={{ color: "#4F46E5", margin: "0 auto 0.5rem auto" }} />
        <p style={{ color: "var(--text-muted)" }}>Loading National AICTE Enrolment & Compliance Metrics...</p>
      </div>
    );
  }

  return (
    <div className="gov-container">
      {/* Title & Institution Filter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            National AICTE Intake & Enrolment Dashboard
          </h2>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Central monitoring layer across all approved technical institutions in India. Numbers reflect verified repository enrolments.
          </p>
        </div>

        {/* Institution Filter Dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#FFFFFF", padding: "0.35rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-medium)" }}>
            <Filter size={14} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: "700", color: "var(--gov-navy-900)" }}>Institution:</span>
            <select
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.875rem", color: "var(--gov-navy-800)", fontWeight: "600", cursor: "pointer" }}
            >
              <option value="ALL">All Approved Institutions (3)</option>
              <option value="INST-001">PICT Pune (AICTE-1-1029384)</option>
              <option value="INST-002">COEP Tech Pune (AICTE-1-1099231)</option>
              <option value="INST-003">VJTI Mumbai (AICTE-1-1088421)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadDashboard}
            title="Refresh statistics"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Total Approved Seats */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: "700" }}>APPROVED SEATS</span>
            <Building2 size={18} style={{ color: "#4F46E5" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: "var(--gov-navy-900)", lineHeight: "1.1" }}>
            {stats.totalApprovedSeats}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            Across {stats.institutions.length} institutions in view
          </span>
        </div>

        {/* Accepted Enrolment */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#166534", fontWeight: "700" }}>ACCEPTED ENROLMENT</span>
            <CheckCircle2 size={18} style={{ color: "#166534" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: "#166534", lineHeight: "1.1" }}>
            {stats.totalAcceptedEnrolment}
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            Passing records accepted into repository
          </span>
        </div>

        {/* Overall Utilisation */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#0369A1", fontWeight: "700" }}>OVERALL UTILISATION</span>
            <Percent size={18} style={{ color: "#0284C7" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: stats.overallUtilisationPercentage > 100 ? "#DC2626" : "#0284C7", lineHeight: "1.1" }}>
            {stats.overallUtilisationPercentage}%
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginTop: "6px" }}>
            Enrolled vs approved capacity
          </span>
        </div>

        {/* Escalated & Pending Review */}
        <div className="gov-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "#6B21A8", fontWeight: "700" }}>REVIEW QUEUE</span>
            <AlertTriangle size={18} style={{ color: "#9333EA" }} />
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", color: "#6B21A8", lineHeight: "1.1" }}>
            {stats.totalPendingReview}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", marginTop: "6px" }}>
            <span>Escalated: <strong style={{ color: "#DC2626" }}>{stats.totalEscalated}</strong></span>
            <span>&bull;</span>
            <span>Overdue: <strong style={{ color: "#DC2626" }}>{stats.totalOverdue}</strong></span>
          </div>
        </div>
      </div>

      {/* Per-Institution Summary Table with Utilisation Bars */}
      <div className="gov-card" style={{ marginBottom: "2rem" }}>
        <div className="gov-card-header">
          <div>
            <h3 style={{ fontSize: "1.2rem", color: "var(--gov-navy-900)" }}>
              Institution-wise Intake & Compliance Summary
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Comparative oversight across AICTE-approved colleges. Only accepted records count toward enrolment.
            </p>
          </div>
          <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
            National Rulebook Enforced
          </span>
        </div>

        <div className="data-table-wrapper" style={{ border: "none", boxShadow: "none" }}>
          <table className="data-table" aria-label="Institution Summary Table">
            <thead>
              <tr>
                <th scope="col">Institution & Permanent ID</th>
                <th scope="col">Campus Location</th>
                <th scope="col" style={{ textAlign: "center" }}>Approved Intake</th>
                <th scope="col" style={{ textAlign: "center" }}>Accepted Enrolment</th>
                <th scope="col" style={{ textAlign: "center" }}>Open Anomalies</th>
                <th scope="col" style={{ textAlign: "center" }}>Escalated Cases</th>
                <th scope="col" style={{ minWidth: "220px" }}>Seat Utilisation Bar</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stats.institutions.map((inst) => {
                const isOver100 = inst.acceptedEnrolment > inst.approvedIntake;
                let barColor = "#0284C7";
                if (isOver100) barColor = "#DC2626";
                else if (inst.utilisation >= 85) barColor = "#D97706";
                else if (inst.utilisation > 0) barColor = "#16A34A";

                return (
                  <tr key={inst.id}>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--gov-navy-900)" }}>{inst.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>AICTE ID: <code>{inst.aicteId}</code></div>
                    </td>
                    <td>{inst.campus}</td>
                    <td style={{ textAlign: "center", fontWeight: "700" }}>{inst.approvedIntake}</td>
                    <td style={{ textAlign: "center", fontWeight: "700", color: "#166534" }}>{inst.acceptedEnrolment}</td>
                    <td style={{ textAlign: "center", fontWeight: "700", color: inst.openAnomalies > 0 ? "#DC2626" : "var(--text-muted)" }}>
                      {inst.openAnomalies}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {inst.escalatedCount > 0 ? (
                        <span className="tag-badge escalated">{inst.escalatedCount} Escalated</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>0</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "4px", fontWeight: "700" }}>
                        <span style={{ color: isOver100 ? "#DC2626" : "var(--text-main)" }}>
                          {inst.utilisation}%
                        </span>
                        {isOver100 && (
                          <span style={{ color: "#DC2626", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <AlertOctagon size={11} /> OVER 100%
                          </span>
                        )}
                      </div>
                      <div style={{ width: "100%", height: "9px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(inst.utilisation, 100)}%`,
                            backgroundColor: barColor,
                            borderRadius: "9999px",
                            transition: "width 0.4s ease"
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to="/aicte/workbench" className="btn btn-secondary btn-sm" style={{ whiteSpace: "nowrap" }}>
                        <span>Review Queue</span>
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
