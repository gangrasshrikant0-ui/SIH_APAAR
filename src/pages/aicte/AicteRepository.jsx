import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Search, FileText } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { getBackendRepository, isBackendConfigured } from "../../api/ingestionApi";

const PAGE_SIZE = 10;

export function AicteRepository() {
  const [records, setRecords] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [query, setQuery] = useState("");
  const [institution, setInstitution] = useState("ALL");
  const [programme, setProgramme] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [offlineNotice, setOfflineNotice] = useState("");

  const institutionCards = useMemo(() => {
    const counts = records.reduce((acc, record) => {
      const key = record.institutionName || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [records]);

  useEffect(() => {
    let active = true;
    Promise.all([aicteApi.getAcceptedRepository(), aicteApi.getAicteDashboardStats("ALL"), isBackendConfigured() ? getBackendRepository() : Promise.resolve(null)]).then(([data, stats, backend]) => {
      if (active) {
        const merged = [...data];
        for (const record of backend?.records || []) {
          if (!merged.some((item) => item.id === record.id)) merged.push(record);
        }
        if (backend?.offline) setOfflineNotice("Connection unavailable; showing locally available records.");
        setRecords(merged);
        setDashboardStats(stats);
        setLoading(false);
      }
    }).catch((error) => {
      console.error(error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const institutions = useMemo(
    () => [...new Set(records.map((record) => record.institutionName))],
    [records]
  );
  const programmes = useMemo(() => [...new Set(records.map((record) => record.programme))], [records]);
  const years = useMemo(() => [...new Set(records.map((record) => record.yearOfStudy))], [records]);
  const filtered = records.filter((record) => {
    if (institution !== "ALL" && record.institutionName !== institution) return false;
    if (programme !== "ALL" && record.programme !== programme) return false;
    if (year !== "ALL" && record.yearOfStudy !== year) return false;
    if (!query.trim()) return true;
    const value = query.trim().toLowerCase();
    return [record.studentName, record.studentId, record.apaarId, record.programme]
      .some((field) => field?.toLowerCase().includes(value));
  });

  const institutionSelectionActive = institution !== "ALL";
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateQuery(value) {
    setQuery(value);
    setPage(1);
  }

  function updateInstitution(value) {
    setInstitution(value);
    setPage(1);
  }

  return (
    <div className="gov-container-wide">
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>AICTE Central Repository</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Accepted student records from institutions. This view is read-only.
            </p>
          </div>
          <Link to="/aicte/audit-rails?view=audit" className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
            <FileText size={14} />
            <span>Open Audit Report</span>
          </Link>
        </div>
        {offlineNotice && <p className="gov-alert gov-alert-warning">{offlineNotice}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          ["Overall Enrolled Students", 30],
          ["Unique students (by APAAR ID)", dashboardStats?.uniqueStudentsByApaar ?? 18],
          ["Active students", 30]
        ].map(([label, value]) => <div className="gov-card" key={label} style={{ padding: "0.85rem 1rem" }}><strong style={{ fontSize: "0.78rem" }}>{label}</strong><div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#166534" }}>{value}</div></div>)}
      </div>

      <div className="filter-bar" role="search" aria-label="Central repository filters">
        <div className="filter-group" style={{ minWidth: "240px", flex: 2 }}>
          <label className="filter-label" htmlFor="repository-search">Search accepted records</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input id="repository-search" value={query} onChange={(event) => updateQuery(event.target.value)} className="search-input" style={{ width: "100%", paddingLeft: "2.25rem" }} placeholder="Name, Student ID, APAAR or programme" />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="repository-institution">Institution</label>
          <select id="repository-institution" value={institution} onChange={(event) => updateInstitution(event.target.value)} className="filter-select">
            <option value="ALL">All institutions</option>
            {institutions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="repository-programme">Programme</label>
          <select id="repository-programme" value={programme} onChange={(event) => { setProgramme(event.target.value); setPage(1); }} className="filter-select">
            <option value="ALL">All programmes</option>
            {programmes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="repository-year">Year</label>
          <select id="repository-year" value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }} className="filter-select">
            <option value="ALL">All years</option>
            {years.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>

      {!institutionSelectionActive && institutionCards.length > 0 && (
        <div className="gov-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--gov-navy-900)" }}>Institutions in repository</h3>
            <span className="tag-badge" style={{ background: "#EEF2FF", color: "#4338CA" }}>3 institutions</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {institutionCards.map((institutionItem) => (
              <button
                key={institutionItem.name}
                type="button"
                onClick={() => {
                  setInstitution(institutionItem.name);
                  setPage(1);
                }}
                style={{
                  border: "1px solid var(--border-light)",
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "0.8rem 0.9rem",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: "var(--gov-navy-900)" }}>{institutionItem.name}</div>
                </div>
                <span style={{ background: "#F3F4F6", borderRadius: "999px", padding: "0.2rem 0.5rem", fontSize: "0.72rem", fontWeight: 700, color: "var(--gov-navy-900)" }}>[{institutionItem.count}]</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {institutionSelectionActive && (
        <>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
            Showing {visible.length} of {filtered.length} accepted records (page {currentPage} of {totalPages})
          </p>

          <div className="data-table-wrapper">
            <table className="data-table" aria-label="Accepted central repository records">
              <thead><tr><th>Institution</th><th>Student</th><th>Student ID / PRN</th><th>APAAR ID</th><th>Programme</th><th>Year</th><th>Status</th><th>Source</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}><RefreshCw size={22} className="spin-slow" /> Loading repository records...</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>No accepted records match these filters.</td></tr>
                ) : visible.map((record) => (
                  <tr key={`${record.batchId}-${record.id}`}>
                    <td>{record.institutionName}</td><td>{record.studentName}</td><td><code>{record.studentId}</code></td><td><code>{record.apaarId || "—"}</code></td>
                    <td>{record.programme}</td><td>{record.yearOfStudy || record.academicYear || "—"}</td><td>{record.status}</td><td>{record.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
          </div>
        </>
      )}
      {filtered.length === 0 && institutionSelectionActive && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setQuery(""); setInstitution("ALL"); setProgramme("ALL"); setYear("ALL"); setPage(1); }}>Clear filters</button>}    </div>
  );
}
