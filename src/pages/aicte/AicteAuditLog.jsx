import React, { useState, useEffect } from "react";
import { History, Search, Filter, ShieldCheck, RefreshCw, AlertTriangle, Lock } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";

export function AicteAuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await aicteApi.getAuditTrail();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

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

  return (
    <div className="gov-container-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
              Statutory Compliance & Security Audit Log
            </h2>
            <span className="tag-badge" style={{ background: "#F1F5F9", color: "#475569" }}>
              Immutable AICTE Trail
            </span>
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Cryptographically indexed historical record of who, what, when, and changes across all institutions.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadLogs}
          title="Refresh audit logs"
        >
          <RefreshCw size={13} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-group" style={{ minWidth: "220px", flex: 2 }}>
          <label className="filter-label" htmlFor="audit-search">Search Audit Trail</label>
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
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="audit-sev">Severity</label>
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
          <label className="filter-label" htmlFor="audit-action">Action Type</label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Actions</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">Route Guard Violations</option>
            <option value="UNAUTHORIZED_REPORT_DOWNLOAD_ATTEMPT">Report Access Denied</option>
            <option value="RECORD_VERIFICATION_REQUESTED">Record Verification Requests</option>
            <option value="AUTO_ESCALATION">Auto Escalation</option>
            <option value="RECORD_RESUBMIT">Record Resubmission</option>
            <option value="RECORDS_ACCEPTED">Batch Acceptance</option>
            <option value="AICTE_EVIDENCE_CONFIRMED">Evidence Confirmed</option>
            <option value="AICTE_SENT_BACK_TO_COLLEGE">Returned to College</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="data-table-wrapper">
        <table className="data-table" aria-label="AICTE Compliance Audit Log">
          <thead>
            <tr>
              <th scope="col">Timestamp (UTC)</th>
              <th scope="col">Actor & Role</th>
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
                  <RefreshCw size={24} className="spin-slow" style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }} />
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Loading audit logs...</span>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <p style={{ color: "var(--text-muted)" }}>No audit events found matching filters.</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isCritical = log.severity === "CRITICAL";

                return (
                  <tr key={log.id} style={{ background: isCritical ? "#FFF5F5" : "inherit" }}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.75rem", fontFamily: "monospace" }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--gov-navy-900)" }}>{log.actorName}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <span className={`user-role-badge ${log.actorRole?.toLowerCase() || ""}`} style={{ padding: "1px 6px", fontSize: "0.7rem" }}>
                          {log.actorRole}
                        </span>
                        <span style={{ marginLeft: "4px" }}>{log.actorEmail}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.75rem", color: isCritical ? "#991B1B" : "#1E40AF", fontWeight: "700" }}>
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
                      <span className={`tag-badge severity-${log.severity?.toLowerCase() || "low"}`}>
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
