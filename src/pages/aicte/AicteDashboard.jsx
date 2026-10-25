import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, AlertTriangle, Percent, RefreshCw, Filter, AlertOctagon } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";

const KPI_STYLE = { minHeight: "132px", display: "flex", flexDirection: "column", justifyContent: "space-between" };

export function AicteDashboard() {
  const [institutionFilter, setInstitutionFilter] = useState("ALL");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      setStats(await aicteApi.getAicteDashboardStats(institutionFilter));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [institutionFilter]);

  if (loading || !stats) {
    return <div className="gov-container" style={{ textAlign: "center", padding: "4rem" }}><RefreshCw size={24} className="spin-slow" /><p>Loading National AICTE Enrolment &amp; Compliance Metrics...</p></div>;
  }

  const visibleInstitutions = stats.institutions.filter((institution) => {
    if (!institutionSearch.trim()) return true;
    const query = institutionSearch.toLowerCase();
    return institution.name.toLowerCase().includes(query) || institution.aicteId.toLowerCase().includes(query);
  });

  return (
    <div className="gov-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>National AICTE Intake &amp; Enrolment Dashboard</h2>
          <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>Prototype: synthetic data</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <label className="filter-label" htmlFor="dashboard-institution">Institution</label>
          <select id="dashboard-institution" className="filter-select" value={institutionFilter} onChange={(event) => setInstitutionFilter(event.target.value)}>
            <option value="ALL">All Colleges</option>
            <option value="INST-001">PICT Pune</option>
            <option value="INST-002">COEP Tech Pune</option>
            <option value="INST-003">VJTI Mumbai</option>
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="gov-card" style={KPI_STYLE}><span>APPROVED SEATS</span><Building2 size={18} style={{ color: "#4F46E5" }} /><strong style={{ fontSize: "2rem" }}>{stats.totalApprovedSeats}</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#166534" }}>ACCEPTED ENROLMENT</span><CheckCircle2 size={18} style={{ color: "#166534" }} /><strong style={{ fontSize: "2rem", color: "#166534" }}>{stats.totalAcceptedEnrolment}</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#0369A1" }}>OVERALL UTILISATION</span><Percent size={18} style={{ color: "#0284C7" }} /><strong style={{ fontSize: "2rem", color: stats.overallUtilisationPercentage > 100 ? "#DC2626" : "#0284C7" }}>{stats.overallUtilisationPercentage}%</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#6B21A8" }}>REVIEW QUEUE</span><AlertTriangle size={18} style={{ color: "#9333EA" }} /><strong style={{ fontSize: "2rem", color: "#6B21A8" }}>{stats.totalPendingReview}</strong><span>Escalated {stats.totalEscalated} · Overdue {stats.totalOverdue}</span></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[["Total ACCEPTED records", stats.totalAcceptedRecords], ["Unique students (by APAAR ID)", stats.uniqueStudentsByApaar], ["APAAR IDs with multiple active enrolments", stats.apaarIdsWithMultipleActiveEnrolments]].map(([label, value]) => <div className="gov-card" key={label}><strong>{label}</strong><div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#166534" }}>{value}</div></div>)}
      </div>

      <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
        <div className="gov-card-header"><h3>Institution-wise Intake &amp; Compliance Summary</h3></div>
        <div className="filter-bar">
          <div className="filter-group" style={{ flex: 2 }}><label className="filter-label" htmlFor="institution-summary-search">Search institution</label><input id="institution-summary-search" className="search-input" value={institutionSearch} onChange={(event) => setInstitutionSearch(event.target.value)} placeholder="Name or AICTE ID" /></div>
          <div className="filter-group"><label className="filter-label" htmlFor="institution-summary-filter">Institution</label><select id="institution-summary-filter" className="filter-select" value={institutionFilter} onChange={(event) => setInstitutionFilter(event.target.value)}><option value="ALL">All Colleges</option>{stats.institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.shortName}</option>)}</select></div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="Institution Summary Table">
            <thead><tr><th>Institution &amp; Permanent ID</th><th>Campus Location</th><th>Approved Intake</th><th>Accepted Enrolment</th><th>Open Anomalies</th><th>Utilisation</th><th>Actions</th></tr></thead>
            <tbody>{visibleInstitutions.map((institution) => { const over = institution.acceptedEnrolment > institution.approvedIntake; return <tr key={institution.id}><td><strong>{institution.name}</strong><div><code>{institution.aicteId}</code></div></td><td>{institution.campus}</td><td>{institution.approvedIntake}</td><td>{institution.acceptedEnrolment}</td><td>{institution.openAnomalies}</td><td><span style={{ color: over ? "#DC2626" : "inherit" }}>{institution.utilisation}% {over && <AlertOctagon size={12} />}</span><div style={{ height: "8px", background: "#E2E8F0", borderRadius: "999px", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(institution.utilisation, 100)}%`, background: over ? "#DC2626" : "#16A34A" }} /></div></td><td><Link className="btn btn-secondary btn-sm" to={`/aicte/review?institution=${encodeURIComponent(institution.id)}`}>Review Queue</Link></td></tr>; })}</tbody>
          </table>
        </div>
        {visibleInstitutions.length === 0 && <p role="status">No institutions match this search.</p>}
      </div>

      <div className="gov-card">
        <div className="gov-card-header"><h3>Synthetic monitoring trend</h3><span className="tag-badge" style={{ background: "#DBEAFE", color: "#1E40AF" }}>DEMO ANALYTICS</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", alignItems: "end" }}>{[["Jul", 42], ["Aug", 58], ["Sep", 71], ["Oct", stats.totalAcceptedEnrolment]].map(([month, value]) => <div key={month} style={{ textAlign: "center" }}><div style={{ height: "90px", display: "flex", alignItems: "end", justifyContent: "center" }}><div title={`${value} accepted records`} style={{ width: "42px", height: `${Math.max(8, Math.min(90, value))}px`, background: "#2563EB", borderRadius: "6px 6px 0 0" }} /></div><strong>{month}</strong><div>{value}</div></div>)}</div>
      </div>
    </div>
  );
}
