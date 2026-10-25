import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  FileText, Globe, ArrowLeft, Download, Search, RefreshCw,
  AlertTriangle, X, ChevronRight
} from "lucide-react";
import { aicteApi } from "../../api/aicteApi";

// ─── CSV helpers ────────────────────────────────────────────────────────────

/** Escape a cell value for RFC-4180 CSV */
function csvCell(val) {
  const s = val == null ? "" : String(val);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a UTF-8 BOM-prefixed CSV blob and trigger download */
function downloadCsv(filename, headers, rows) {
  const BOM = "\uFEFF";
  const headerLine = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([BOM + headerLine + "\n" + body], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Shared sub-components ───────────────────────────────────────────────────

/** Row count + Clear-filters footer bar */
function RecordCountBar({ shown, total, hasFilters, onClear }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.5rem",
        marginBottom: "0.75rem"
      }}
    >
      <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        Showing <strong style={{ color: "var(--gov-navy-900)" }}>{shown}</strong> of{" "}
        <strong style={{ color: "var(--gov-navy-900)" }}>{total}</strong> records
      </span>
      {hasFilters && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClear}
          title="Clear all filters"
        >
          <X size={13} />
          <span>Clear Filters</span>
        </button>
      )}
    </div>
  );
}

/** Download CSV button with dynamic label and disabled-with-tooltip when 0 rows */
function DownloadCsvButton({ rowCount, filtersActive, onClick, disabled }) {
  const label = filtersActive
    ? `Download CSV (filtered: ${rowCount} records)`
    : `Download CSV (all ${rowCount} records)`;

  return (
    <span
      title={
        disabled
          ? "No records match these filters. Clear filters to enable download."
          : undefined
      }
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      >
        <Download size={13} />
        <span>{label}</span>
      </button>
    </span>
  );
}

// ─── VIEW A: Complete Statutory Audit Trail ──────────────────────────────────

function AuditTrailView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aicteApi.getAuditTrail();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const hasFilters =
    searchQuery.trim() !== "" ||
    severityFilter !== "ALL" ||
    actionFilter !== "ALL";

  const filteredLogs = logs.filter((log) => {
    if (severityFilter !== "ALL" && log.severity !== severityFilter) return false;
    if (actionFilter !== "ALL" && log.actionType !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.actorName?.toLowerCase().includes(q) ||
        log.actorEmail?.toLowerCase().includes(q) ||
        log.actionType?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.changeSummary?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function clearFilters() {
    setSearchQuery("");
    setSeverityFilter("ALL");
    setActionFilter("ALL");
  }

  function handleDownload() {
    const headers = [
      "ID", "Timestamp", "Actor Name", "Role", "Email",
      "Action Type", "Resource ID", "Event Details", "Change Summary", "Severity"
    ];
    const rows = filteredLogs.map((l) => [
      l.id, l.timestamp, l.actorName, l.actorRole, l.actorEmail,
      l.actionType, l.resourceId, l.details, l.changeSummary, l.severity
    ]);
    downloadCsv(`statutory-audit-trail-${todayIso()}.csv`, headers, rows);
    aicteApi.logReportDownload({
      reportName: "Statutory Audit Trail",
      rowCount: filteredLogs.length,
      filtersActive: hasFilters
    });
    // Reload so the freshly-written REPORT_DOWNLOADED entry appears
    loadLogs();
  }

  return (
    <div className="gov-container-wide">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div>
          <Link
            to="/aicte/reports"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8125rem",
              color: "var(--gov-navy-600)",
              marginBottom: "0.5rem"
            }}
          >
            <ArrowLeft size={14} />
            Back to National Reports
          </Link>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem"
            }}
          >
            <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
              Statutory Compliance &amp; Security Audit Log
            </h2>
            <span
              className="tag-badge"
              style={{ background: "#F1F5F9", color: "#475569" }}
            >
              AUDIT TRAIL (PROTOTYPE)
            </span>
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Record of who, what, when and what changed across all institutions.
            Prototype log using synthetic data.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadLogs}
            title="Refresh audit logs"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
          <DownloadCsvButton
            rowCount={filteredLogs.length}
            totalCount={logs.length}
            filtersActive={hasFilters}
            onClick={handleDownload}
            disabled={filteredLogs.length === 0}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group" style={{ minWidth: "220px", flex: 2 }}>
          <label className="filter-label" htmlFor="audit-search">
            Search Audit Trail
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="audit-search"
              type="text"
              placeholder="Search actor, action type, student ID, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: "100%", paddingLeft: "2.25rem" }}
            />
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)"
              }}
            />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="audit-sev">
            Severity
          </label>
          <select
            id="audit-sev"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical (Security Violations)</option>
            <option value="WARNING">Warning (Anomalies / Escalations)</option>
            <option value="INFO">Info (Logins / Revalidation)</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="audit-action">
            Action Type
          </label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Actions</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">Route Guard Violations</option>
            <option value="UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT">Report Access Denied</option>
            <option value="REPORT_DOWNLOADED">Report Downloads</option>
            <option value="RECORD_VERIFICATION_REQUESTED">Record Verification Requests</option>
            <option value="APAAR_LOOKUP">APAAR Lookups</option>
            <option value="APAAR_CHECK_RUN">Simulated APAAR Checks</option>
            <option value="AUTO_ESCALATION">Auto Escalation</option>
            <option value="RECORD_RESUBMIT">Record Resubmission</option>
            <option value="RECORDS_ACCEPTED">Batch Acceptance</option>
            <option value="AICTE_EVIDENCE_CONFIRMED">Evidence Confirmed</option>
            <option value="AICTE_SENT_BACK_TO_COLLEGE">Returned to College</option>
          </select>
        </div>
      </div>

      <RecordCountBar
        shown={filteredLogs.length}
        total={logs.length}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      {/* Audit Log Table */}
      <div className="data-table-wrapper">
        <table className="data-table" aria-label="AICTE Statutory Compliance Audit Trail">
          <thead>
            <tr>
              <th scope="col">Timestamp (UTC)</th>
              <th scope="col">Actor &amp; Role</th>
              <th scope="col">Action Type</th>
              <th scope="col">Resource ID</th>
              <th scope="col" style={{ minWidth: "260px" }}>Event Details</th>
              <th scope="col" style={{ minWidth: "220px" }}>Change Summary</th>
              <th scope="col">Severity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <RefreshCw
                    size={24}
                    className="spin-slow"
                    style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }}
                  />
                  <span style={{ color: "var(--text-muted)", display: "block" }}>
                    Loading audit logs…
                  </span>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>
                    No records match these filters.{" "}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={clearFilters}
                      style={{ marginLeft: "0.5rem" }}
                    >
                      Clear filters to see all records.
                    </button>
                  </p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isCritical = log.severity === "CRITICAL";
                return (
                  <tr
                    key={log.id}
                    style={{ background: isCritical ? "#FFF5F5" : "inherit" }}
                  >
                    <td
                      style={{
                        whiteSpace: "nowrap",
                        fontSize: "0.75rem",
                        fontFamily: "monospace"
                      }}
                    >
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <div
                        style={{ fontWeight: "700", color: "var(--gov-navy-900)" }}
                      >
                        {log.actorName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span
                          className={`user-role-badge ${log.actorRole?.toLowerCase() || ""}`}
                          style={{ padding: "1px 6px", fontSize: "0.7rem" }}
                        >
                          {log.actorRole}
                        </span>
                        <span style={{ marginLeft: "4px" }}>{log.actorEmail}</span>
                      </div>
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: "0.75rem",
                          color: isCritical ? "#991B1B" : "#1E40AF",
                          fontWeight: "700"
                        }}
                      >
                        {log.actionType}
                      </code>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.75rem" }}>{log.resourceId}</code>
                    </td>
                    <td style={{ fontSize: "0.8125rem", lineHeight: "1.4" }}>
                      {log.details}
                    </td>
                    <td style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                      {log.changeSummary}
                    </td>
                    <td>
                      <span
                        className={`tag-badge severity-${log.severity?.toLowerCase() || "low"}`}
                      >
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── VIEW B: All-India Institutional Intake Report ───────────────────────────

const UTILISATION_OPTS = [
  { value: "ALL", label: "All Utilisation" },
  { value: "OVER_100", label: "Over 100%" },
  { value: "80_TO_100", label: "80 to 100%" },
  { value: "UNDER_80", label: "Under 80%" }
];

function utilisationInBucket(u, bucket) {
  if (bucket === "ALL") return true;
  if (bucket === "OVER_100") return u > 100;
  if (bucket === "80_TO_100") return u >= 80 && u <= 100;
  if (bucket === "UNDER_80") return u < 80;
  return true;
}

function IntakeReportView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [instFilter, setInstFilter] = useState("ALL");
  const [progFilter, setProgFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [utilFilter, setUtilFilter] = useState("ALL");

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aicteApi.getIntakeReportRows();
      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Unique lists for dropdowns
  const institutions = [...new Set(rows.map((r) => r.institution))];
  const programmes = [...new Set(rows.map((r) => r.programmeName))];
  const years = [...new Set(rows.map((r) => r.year))];

  const hasFilters =
    searchQuery.trim() !== "" ||
    instFilter !== "ALL" ||
    progFilter !== "ALL" ||
    yearFilter !== "ALL" ||
    utilFilter !== "ALL";

  const filtered = rows.filter((r) => {
    if (instFilter !== "ALL" && r.institution !== instFilter) return false;
    if (progFilter !== "ALL" && r.programmeName !== progFilter) return false;
    if (yearFilter !== "ALL" && r.year !== yearFilter) return false;
    if (!utilisationInBucket(r.utilisation, utilFilter)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.institution?.toLowerCase().includes(q) ||
        r.institutionFull?.toLowerCase().includes(q) ||
        r.programme?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function clearFilters() {
    setSearchQuery("");
    setInstFilter("ALL");
    setProgFilter("ALL");
    setYearFilter("ALL");
    setUtilFilter("ALL");
  }

  function handleDownload() {
    const headers = [
      "Institution", "Programme", "Year",
      "Approved Intake", "Accepted Enrolment", "Utilisation %",
      "Open Anomalies", "Escalated"
    ];
    const csvRows = filtered.map((r) => [
      r.institutionFull, r.programme, r.year,
      r.approvedIntake, r.acceptedEnrolment, `${r.utilisation}%`,
      r.openAnomalies, r.escalated
    ]);
    downloadCsv(`national-intake-report-${todayIso()}.csv`, headers, csvRows);
    aicteApi.logReportDownload({
      reportName: "All-India Institutional Intake Report",
      rowCount: filtered.length,
      filtersActive: hasFilters
    });
  }

  return (
    <div className="gov-container-wide">
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem"
        }}
      >
        <div>
          <Link
            to="/aicte/reports"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8125rem",
              color: "var(--gov-navy-600)",
              marginBottom: "0.5rem"
            }}
          >
            <ArrowLeft size={14} />
            Back to National Reports
          </Link>
          <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
            All-India Institutional Intake Report
          </h2>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Consolidated approved-intake vs. accepted-enrolment across all AICTE
            institutions and programmes. Data is live and matches the National Dashboard.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadRows}
            title="Refresh data"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>
          <DownloadCsvButton
            rowCount={filtered.length}
            totalCount={rows.length}
            filtersActive={hasFilters}
            onClick={handleDownload}
            disabled={filtered.length === 0}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group" style={{ minWidth: "220px", flex: 2 }}>
          <label className="filter-label" htmlFor="intake-search">
            Search
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="intake-search"
              type="text"
              placeholder="Search institution or programme…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: "100%", paddingLeft: "2.25rem" }}
            />
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)"
              }}
            />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="intake-inst">
            Institution
          </label>
          <select
            id="intake-inst"
            value={instFilter}
            onChange={(e) => setInstFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Institutions</option>
            {institutions.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="intake-prog">
            Programme
          </label>
          <select
            id="intake-prog"
            value={progFilter}
            onChange={(e) => setProgFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Programmes</option>
            {programmes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="intake-year">
            Year
          </label>
          <select
            id="intake-year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="intake-util">
            Utilisation
          </label>
          <select
            id="intake-util"
            value={utilFilter}
            onChange={(e) => setUtilFilter(e.target.value)}
            className="filter-select"
          >
            {UTILISATION_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <RecordCountBar
        shown={filtered.length}
        total={rows.length}
        hasFilters={hasFilters}
        onClear={clearFilters}
      />

      {/* Intake Table */}
      <div className="data-table-wrapper">
        <table
          className="data-table"
          aria-label="All-India Institutional Intake Report"
        >
          <thead>
            <tr>
              <th scope="col">Institution</th>
              <th scope="col">Programme</th>
              <th scope="col">Year</th>
              <th scope="col" style={{ textAlign: "right" }}>Approved Intake</th>
              <th scope="col" style={{ textAlign: "right" }}>Accepted Enrolment</th>
              <th scope="col" style={{ textAlign: "right" }}>Utilisation %</th>
              <th scope="col" style={{ textAlign: "right" }}>Open Anomalies</th>
              <th scope="col" style={{ textAlign: "right" }}>Escalated</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                  <RefreshCw
                    size={24}
                    className="spin-slow"
                    style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }}
                  />
                  <span style={{ color: "var(--text-muted)", display: "block" }}>
                    Loading intake data…
                  </span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "3rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>
                    No records match these filters.{" "}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={clearFilters}
                      style={{ marginLeft: "0.5rem" }}
                    >
                      Clear filters to see all records.
                    </button>
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const isOver = row.utilisation > 100;
                return (
                  <tr key={`${row.institutionId}-${row.programmeName}-${idx}`}>
                    <td style={{ fontWeight: "600", color: "var(--gov-navy-900)" }}>
                      {row.institution}
                    </td>
                    <td style={{ fontSize: "0.875rem" }}>{row.programme}</td>
                    <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                      {row.year}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      {row.approvedIntake}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      {row.acceptedEnrolment}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {isOver ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            background: "#FEE2E2",
                            color: "#991B1B",
                            border: "1px solid #FCA5A5",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontWeight: "700",
                            fontSize: "0.8125rem"
                          }}
                          title="Utilisation exceeds 100% of approved intake"
                        >
                          <AlertTriangle size={12} />
                          {row.utilisation}%
                        </span>
                      ) : (
                        <span
                          style={{
                            fontFamily: "monospace",
                            color:
                              row.utilisation >= 80
                                ? "var(--gov-navy-900)"
                                : "var(--text-muted)"
                          }}
                        >
                          {row.utilisation}%
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.openAnomalies > 0 ? (
                        <span
                          className="tag-badge severity-medium"
                          style={{ display: "inline-block" }}
                        >
                          {row.openAnomalies}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.escalated > 0 ? (
                        <span className="tag-badge severity-high" style={{ display: "inline-block" }}>
                          {row.escalated}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LANDING PAGE ────────────────────────────────────────────────────────────

export function AicteReports() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view"); // "audit" | "intake" | null

  // When the old /aicte/audit route redirected here it passes ?view=audit
  if (view === "audit") {
    return <AuditTrailView />;
  }
  if (view === "intake") {
    return <IntakeReportView />;
  }

  // ── Landing: two clickable cards ──
  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2
          style={{
            fontSize: "1.75rem",
            color: "var(--gov-navy-900)",
            marginBottom: "0.5rem"
          }}
        >
          National AICTE Reports
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          Official central reports covering all institutions for parliamentary
          inquiries, national data audits, and statutory archiving.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "1.5rem"
        }}
      >
        {/* Intake Report Card */}
        <Link
          to="/aicte/reports?view=intake"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
          aria-label="Open All-India Institutional Intake Report"
        >
          <div
            className="gov-card"
            style={{
              cursor: "pointer",
              transition: "box-shadow 0.2s, border-color 0.2s",
              height: "100%"
            }}
            tabIndex={-1}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "#EFF6FF",
                color: "#1E40AF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem"
              }}
            >
              <Globe size={24} />
            </div>
            <h3
              style={{
                fontSize: "1.15rem",
                color: "var(--gov-navy-900)",
                marginBottom: "0.5rem"
              }}
            >
              All-India Institutional Intake Report
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-muted)",
                marginBottom: "1.25rem",
                lineHeight: "1.5"
              }}
            >
              Consolidated intake vs. accepted enrolment metrics across all
              AICTE-approved institutions in India, including utilisation
              percentages and open anomaly tallies.
            </p>
            <span
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              aria-hidden="true"
            >
              <ChevronRight size={14} />
              Open report
            </span>
          </div>
        </Link>

        {/* Audit Trail Card */}
        <Link
          to="/aicte/reports?view=audit"
          style={{ textDecoration: "none", color: "inherit", display: "block" }}
          aria-label="Open Complete Statutory Audit Trail"
        >
          <div
            className="gov-card"
            style={{
              cursor: "pointer",
              transition: "box-shadow 0.2s, border-color 0.2s",
              height: "100%"
            }}
            tabIndex={-1}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                background: "#F3E8FF",
                color: "#6B21A8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem"
              }}
            >
              <FileText size={24} />
            </div>
            <h3
              style={{
                fontSize: "1.15rem",
                color: "var(--gov-navy-900)",
                marginBottom: "0.5rem"
              }}
            >
              Complete Statutory Audit Trail
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-muted)",
                marginBottom: "1.25rem",
                lineHeight: "1.5"
              }}
            >
              Full record of all system activity: batch submissions, automated
              revalidations, route guard violations, reviewer adjudications, and
              status updates. AUDIT TRAIL (PROTOTYPE) — synthetic data.
            </p>
            <span
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              aria-hidden="true"
            >
              <ChevronRight size={14} />
              Open report
            </span>
          </div>
        </Link>
      </div>

    </div>
  );
}
