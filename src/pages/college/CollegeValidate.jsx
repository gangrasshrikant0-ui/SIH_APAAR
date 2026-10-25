import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Search, RefreshCw, CheckCircle2, ShieldCheck
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { StatusBadge } from "../../components/StatusBadge";

const PAGE_SIZE = 10;

function sourceLabel(source) {
  if (source === "MANUAL_ENTRY") return "Manual entry";
  return "Bulk upload";
}

export function CollegeValidate() {
  const { refreshStats } = useOutletContext() || {};
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [page, setPage] = useState(1);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = await collegeApi.getStagedRecords({
        source: sourceFilter,
        status: statusFilter,
        search: searchQuery
      });
      setRecords(data.records);
      setBatchId(data.batchId);
      setTotalRows(data.totalRows);
      setSelectedIds((prev) => {
        const visible = new Set(data.records.map((r) => r.id));
        return new Set([...prev].filter((id) => visible.has(id)));
      });
    } catch (e) {
      setErrorMsg(e.message || "Failed to load staged records.");
    } finally {
      setIsLoading(false);
    }
  }, [sourceFilter, statusFilter, searchQuery]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setPage(1);
  }, [sourceFilter, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = records.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const visibleIds = visibleRecords.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const stagedCount = records.filter((r) => r.status !== "ACCEPTED").length;
  const nothingSelected = selectedIds.size === 0;
  const nothingStaged = stagedCount === 0;

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const runValidation = async (ids) => {
    setValidating(true);
    setErrorMsg("");
    try {
      const result = await collegeApi.validateStagedRecords(ids);
      setSummary({
        validated: result.validated,
        passed: result.passed,
        flagged: result.flagged,
        blocking: result.blocking,
        warnings: result.warnings
      });
      await loadRecords();
      if (refreshStats) refreshStats();
    } catch (e) {
      setErrorMsg(e.message || "Validation failed.");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
          Validate Records
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem", fontStyle: "italic" }}>
          Prototype: records are stored in synthetic mock data. Format-valid APAAR IDs are not identity-verified.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}

      <div className="filter-bar" role="search" aria-label="Staged record filters">
        <div className="filter-group" style={{ minWidth: "220px", flex: "1.5" }}>
          <label className="filter-label" htmlFor="validate-search">Search (student ID, name or APAAR)</label>
          <div style={{ position: "relative" }}>
            <input
              id="validate-search"
              type="text"
              placeholder="Search student ID, name or APAAR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: "100%", paddingLeft: "2.25rem" }}
            />
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-source">Source</label>
          <select id="filter-source" className="filter-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="MANUAL_ENTRY">Manual entry</option>
            <option value="BULK_UPLOAD">Bulk upload</option>
            <option value="API" disabled>API (planned, not connected)</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-status">Status</label>
          <select id="filter-status" className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="UPLOADED">Uploaded</option>
            <option value="ACTION_REQUIRED">Action Required</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="READY_TO_ACCEPT">Ready to Accept</option>
            <option value="ACCEPTED">Accepted</option>
          </select>
        </div>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: "0.75rem 0 1rem" }}>
        Showing {visibleRecords.length} of {records.length} filtered records (page {currentPage} of {totalPages}; {totalRows} total)
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={validating || nothingSelected || nothingStaged}
          onClick={() => runValidation([...selectedIds])}
        >
          {validating ? <RefreshCw size={13} className="spin-slow" /> : <ShieldCheck size={13} />}
          <span>Validate selected</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={validating || nothingStaged}
          onClick={() => runValidation(null)}
        >
          <span>Validate all staged</span>
        </button>
      </div>

      <div className="data-table-wrapper" style={{ marginBottom: "1.75rem" }}>
        <table className="data-table" aria-label="Staged student records">
          <thead>
            <tr>
              <th scope="col">
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    disabled={records.length === 0}
                    aria-label="Select all"
                  />
                  Select all
                </label>
              </th>
              <th scope="col">Student</th>
              <th scope="col">APAAR ID</th>
              <th scope="col">Programme</th>
              <th scope="col">Year</th>
              <th scope="col">Source</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <RefreshCw size={24} className="spin-slow" style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }} />
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Loading staged records...</span>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem" }}>
                  <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.25rem" }}>
                    No staged records match these filters
                  </h4>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Add students manually or run a batch upload, then return here to validate.
                  </p>
                </td>
              </tr>
            ) : (
              visibleRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.studentName || r.studentId}`}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--gov-navy-900)" }}>{r.studentName || "—"}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      PRN: <code>{r.studentId || "—"}</code>
                    </div>
                  </td>
                  <td>
                    <code style={{ fontWeight: 600 }}>{r.apaarId || "[MISSING]"}</code>
                  </td>
                  <td>{r.programme}</td>
                  <td>{r.yearOfStudy}</td>
                  <td>{sourceLabel(r.source)}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
      </div>

      {summary && (
        <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>Validation result</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block" }}>Checked</span>
              <strong style={{ fontSize: "1.35rem" }}>{summary.validated}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#166534", display: "block" }}>Passed</span>
              <strong style={{ fontSize: "1.35rem", color: "#166534" }}>{summary.passed}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#92400E", display: "block" }}>Flagged</span>
              <strong style={{ fontSize: "1.35rem", color: "#B45309" }}>{summary.flagged}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#991B1B", display: "block" }}>Blocking</span>
              <strong style={{ fontSize: "1.35rem", color: "#991B1B" }}>{summary.blocking}</strong>
            </div>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#6B21A8", display: "block" }}>Warning</span>
              <strong style={{ fontSize: "1.35rem", color: "#6B21A8" }}>{summary.warnings}</strong>
            </div>
          </div>
        </div>
      )}

      {summary && summary.flagged > 0 && (
        <button type="button" className="btn btn-secondary" onClick={() => navigate(`/college/workbench?batch=${encodeURIComponent(batchId)}`)}>
          View issues in Issue Workbench
        </button>
      )}

      {summary && summary.flagged === 0 && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>No blocking or warning issues on the last validation run. Records that passed are READY_TO_ACCEPT (not ACCEPTED until you accept them on the Issue Workbench).</span>
        </div>
      )}

    </div>
  );
}
