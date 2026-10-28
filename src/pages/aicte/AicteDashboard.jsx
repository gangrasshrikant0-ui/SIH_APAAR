import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, AlertTriangle, Percent, RefreshCw, Filter, AlertOctagon, MapPinned, Search, FileDown, ShieldAlert } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { getBackendDashboard, isBackendConfigured } from "../../api/ingestionApi";
import { DonutChart, BarChart } from "../../components/MetricsCharts";

const KPI_STYLE = { minHeight: "132px", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const DEMO_STATE_OPTIONS = [
  "Maharashtra",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function AicteDashboard() {
  const [institutionFilter, setInstitutionFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const backend = isBackendConfigured() ? await getBackendDashboard("AICTE", institutionFilter) : null;
      if (backend?.offline) {
        setOfflineNotice("Connection unavailable; showing locally available records.");
        setStats(await aicteApi.getAicteDashboardStats(institutionFilter));
      } else if (backend) {
        setOfflineNotice("");
        setStats(backend);
      } else {
        setStats(await aicteApi.getAicteDashboardStats(institutionFilter));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const poll = setInterval(() => { if (!document.hidden) loadDashboard(); }, 15000);
    const refresh = () => { if (!document.hidden) loadDashboard(); };
    window.addEventListener("apaar:data-sync", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(poll); window.removeEventListener("apaar:data-sync", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [institutionFilter]);

  const visibleInstitutions = useMemo(() => {
    if (!stats) return [];
    return [...stats.institutions]
      .filter((institution) => {
        if (stateFilter !== "ALL" && (institution.state || "Unknown") !== stateFilter) return false;
        if (!institutionSearch.trim()) return true;
        const query = institutionSearch.toLowerCase();
        return institution.name.toLowerCase().includes(query) || institution.aicteId.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const diff = (b.openAnomalies || 0) - (a.openAnomalies || 0);
        return diff !== 0 ? diff : (a.name || "").localeCompare(b.name || "");
      });
  }, [stats, institutionSearch, stateFilter]);

  const availableStates = DEMO_STATE_OPTIONS;

  const displayStats = stats;

  const displayInstitutions = visibleInstitutions.map((institution) => ({
    ...institution,
    approvedIntake: institution.approvedIntake,
    acceptedEnrolment: institution.acceptedEnrolment,
    openAnomalies: institution.openAnomalies,
    utilisation: institution.utilisation
  }));

  const handleDownloadOverallRecords = async () => {
    const rows = await aicteApi.getAcceptedRepository();
    const selectedInstitutionIds = new Set(visibleInstitutions.map((institution) => institution.id));
    const filteredRows = stateFilter === "ALL"
      ? rows
      : rows.filter((record) => selectedInstitutionIds.has(record.institutionId));
    const csvRows = [
      ["Institution", "AICTE ID", "Batch ID", "Student Name", "PRN / Roll No.", "APAAR ID", "Programme", "Status"],
      ...filteredRows.map((record) => [
        record.institutionName,
        record.aicteId || "N/A",
        record.batchId,
        record.studentName,
        record.studentId,
        record.apaarId,
        record.programme,
        record.status
      ])
    ];
    downloadCsv(`aicte-${stateFilter === "ALL" ? "national" : stateFilter.toLowerCase().replace(/\s+/g, "-")}-records.csv`, csvRows);
  };

  if (loading || !stats) {
    return <div className="gov-container" style={{ textAlign: "center", padding: "4rem" }}><RefreshCw size={24} className="spin-slow" /><p>Loading National AICTE Enrolment &amp; Compliance Metrics...</p></div>;
  }

  const dashboardStats = displayStats || stats;

  return (
    <div className="gov-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>National AICTE Intake &amp; Enrolment Dashboard</h2>
        </div>

        <div className="filter-bar" style={{ marginBottom: "1.5rem" }}>
          <div className="filter-group">
            <label className="filter-label" htmlFor="national-state-filter">
              Download / view state
            </label>
            <select
              id="national-state-filter"
              className="filter-select"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              <option value="ALL">All states</option>
              {availableStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <p style={{ margin: "1.6rem 0 0", color: "var(--text-muted)", fontSize: "0.82rem" }}>
            Select a state to filter the dashboard and download only that state&apos;s accepted records.
          </p>
        </div>
        {offlineNotice && <p className="gov-alert gov-alert-warning">{offlineNotice}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadOverallRecords}>
            <FileDown size={13} />
            <span>Download entire records</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadDashboard}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="gov-card" style={KPI_STYLE}><span>APPROVED SEATS</span><Building2 size={18} style={{ color: "#4F46E5" }} /><strong style={{ fontSize: "2rem" }}>{dashboardStats.totalApprovedSeats}</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#166534" }}>ACCEPTED ENROLMENT</span><CheckCircle2 size={18} style={{ color: "#166534" }} /><strong style={{ fontSize: "2rem", color: "#166534" }}>{dashboardStats.totalAcceptedEnrolment}</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#0369A1" }}>OVERALL UTILISATION</span><Percent size={18} style={{ color: "#0284C7" }} /><strong style={{ fontSize: "2rem", color: dashboardStats.overallUtilisationPercentage > 100 ? "#DC2626" : "#0284C7" }}>{dashboardStats.overallUtilisationPercentage}%</strong></div>
        <div className="gov-card" style={KPI_STYLE}><span style={{ color: "#6B21A8" }}>REVIEW QUEUE</span><AlertTriangle size={18} style={{ color: "#9333EA" }} /><strong style={{ fontSize: "2rem", color: "#6B21A8" }}>{dashboardStats.totalPendingReview}</strong><span>Escalated {dashboardStats.totalEscalated} · Overdue {dashboardStats.totalOverdue}</span></div>
      </div>

      <div className="dashboard-chart-grid">
        <div className="gov-card">
          <div className="gov-card-header"><h3>National enrolment overview</h3></div>
          <DonutChart
            label="National approved and accepted enrolment"
            data={[
              { label: "Accepted", value: dashboardStats.totalAcceptedEnrolment, color: "#16A34A" },
              { label: "Available seats", value: Math.max(0, dashboardStats.totalApprovedSeats - dashboardStats.totalAcceptedEnrolment), color: "#2563EB" },
              { label: "Open anomalies", value: dashboardStats.totalOpenAnomalies, color: "#DC2626" }
            ]}
          />
        </div>
        <div className="gov-card">
          <div className="gov-card-header"><h3>Institution comparison</h3></div>
          <BarChart
            label="Accepted enrolment by institution"
            data={displayInstitutions.map((institution) => ({
              label: institution.shortName,
              value: institution.acceptedEnrolment,
              color: institution.openAnomalies > 0 ? "#F59E0B" : "#2563EB"
            }))}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="gov-card" style={{ padding: "1rem", minHeight: "150px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}><MapPinned size={18} /><strong>By State</strong></div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Explore institutions by region</p>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "1rem" }}>12</div>
        </div>
        <div className="gov-card" style={{ padding: "1rem", minHeight: "150px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}><ShieldAlert size={18} /><strong>By Issue</strong></div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Find colleges needing attention</p>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "1rem" }}>{dashboardStats.totalOpenAnomalies}</div>
        </div>
        <div className="gov-card" style={{ padding: "1rem", minHeight: "150px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}><Search size={18} /><strong>Institution Directory</strong></div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Search all registered colleges</p>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "1rem" }}>{dashboardStats.institutions.length}</div>
        </div>
        <div className="gov-card" style={{ padding: "1rem", minHeight: "150px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}><Filter size={18} /><strong>Submission Status</strong></div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Monitor uploads and validation</p>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "1rem" }}>{dashboardStats.institutions.filter((inst) => inst.openAnomalies > 0).length}</div>
        </div>
      </div>

      <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
        <div className="gov-card-header"><h3>Needs Attention</h3><span className="tag-badge" style={{ background: "#FEE2E2", color: "#B91C1C" }}>{dashboardStats.totalOpenAnomalies}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
          {displayInstitutions.map((institution) => (
            <div key={institution.id} className="gov-card" style={{ padding: "1rem", background: "#FFF7F7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                <div>
                  <strong>{institution.name}</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{institution.shortName}</div>
                </div>
                <span style={{ background: "#FECACA", color: "#B91C1C", borderRadius: "999px", padding: "0.2rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>{institution.openAnomalies}</span>
              </div>
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.35rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <div>Approved intake: {institution.approvedIntake}</div>
                <div>Accepted: {institution.acceptedEnrolment}</div>
                <div>Utilisation: {institution.utilisation}%</div>
              </div>
              <Link className="btn btn-secondary btn-sm" to={`/aicte/review?institution=${encodeURIComponent(institution.id)}`} style={{ marginTop: "0.75rem" }}>Review Queue</Link>
            </div>
          ))}
        </div>
      </div>

      <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
        <div className="gov-card-header"><h3>Institution-wise Intake &amp; Compliance Summary</h3></div>
        <div className="filter-bar">
          <div className="filter-group" style={{ flex: 2 }}><label className="filter-label" htmlFor="institution-summary-search">Search institution</label><input id="institution-summary-search" className="search-input" value={institutionSearch} onChange={(event) => setInstitutionSearch(event.target.value)} placeholder="Name or AICTE ID" /></div>
          <div className="filter-group"><label className="filter-label" htmlFor="institution-summary-filter">Institution</label><select id="institution-summary-filter" className="filter-select" value={institutionFilter} onChange={(event) => setInstitutionFilter(event.target.value)}><option value="ALL">All Colleges</option>{dashboardStats.institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.shortName}</option>)}</select></div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="Institution Summary Table">
            <thead><tr><th>Institution &amp; Permanent ID</th><th>Campus Location</th><th>Approved Intake</th><th>Accepted Enrolment</th><th>Open Anomalies</th><th>Utilisation</th><th>Actions</th></tr></thead>
            <tbody>{displayInstitutions.map((institution) => { const over = institution.acceptedEnrolment > institution.approvedIntake; return <tr key={institution.id}><td><strong>{institution.name}</strong><div><code>{institution.aicteId}</code></div></td><td>{institution.campus}</td><td>{institution.approvedIntake}</td><td>{institution.acceptedEnrolment}</td><td>{institution.openAnomalies}</td><td><span style={{ color: over ? "#DC2626" : "inherit" }}>{institution.utilisation}% {over && <AlertOctagon size={12} />}</span><div style={{ height: "8px", background: "#E2E8F0", borderRadius: "999px", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(institution.utilisation, 100)}%`, background: over ? "#DC2626" : "#16A34A" }} /></div></td><td><Link className="btn btn-secondary btn-sm" to={`/aicte/review?institution=${encodeURIComponent(institution.id)}`}>National Dashboard</Link></td></tr>; })}</tbody>
          </table>
        </div>
        {visibleInstitutions.length === 0 && <p role="status">No institutions match this search.</p>}
      </div>
    </div>
  );
}
