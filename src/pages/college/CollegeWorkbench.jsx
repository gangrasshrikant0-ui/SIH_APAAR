import React, { useState, useEffect } from "react";
import { useOutletContext, Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Eye,
  Info,
  Clock,
  FastForward,
  CheckSquare,
  Sparkles,
  Sliders
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { acceptBackendRecord, isBackendConfigured } from "../../api/ingestionApi";
import { StatusBadge, SeverityBadge, OverdueBadge, EscalatedBadge } from "../../components/StatusBadge";
import { FixRecordModal } from "../../components/FixRecordModal";

export function CollegeWorkbench() {
  const { refreshStats } = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const requestedBatchId = searchParams.get("batch") || "";

  const [records, setRecords] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecordForFix, setSelectedRecordForFix] = useState(null);
  const [acceptingRecords, setAcceptingRecords] = useState(false);
  const [simulatingEscalation, setSimulatingEscalation] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");

  // Prototype configurable settings state
  const [dueDaysSetting, setDueDaysSetting] = useState(7);

  // Filter States
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadIssues = async () => {
    setIsLoading(true);
    try {
      const data = await collegeApi.getIssues({
        batchId: requestedBatchId || undefined,
        course: courseFilter,
        year: yearFilter,
        issueType: issueTypeFilter,
        severity: severityFilter,
        status: statusFilter,
        search: searchQuery
      });
      setRecords(data.records);
      setBatchInfo({
        batchId: data.batchId,
        batchStatus: data.batchStatus,
        totalRows: data.totalRows,
        flaggedCount: data.flaggedCount,
        readyCount: data.readyCount,
        acceptedCount: data.acceptedCount,
        unresolvedIssueCount: data.unresolvedIssueCount,
        resolvedIssueCount: data.resolvedIssueCount
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [courseFilter, yearFilter, issueTypeFilter, severityFilter, statusFilter, searchQuery, requestedBatchId]);

  const handleRecordFixed = (updatedRecord) => {
    setActionSuccessMsg(`Record for ${updatedRecord.studentName} (${updatedRecord.studentId}) successfully revalidated: Status is now ${updatedRecord.status}!`);
    setTimeout(() => setActionSuccessMsg(""), 6000);
    loadIssues();
    if (refreshStats) refreshStats();
  };

  const handleAcceptReadyRecords = async () => {
    if (!batchInfo || batchInfo.readyCount === 0) return;
    setAcceptingRecords(true);
    try {
      if (isBackendConfigured()) {
        const ready = await collegeApi.getIssues({ status: "READY_TO_ACCEPT" });
        for (const record of ready.records.filter((item) => String(item.id).startsWith("INGEST-"))) {
          const result = await acceptBackendRecord(record.id);
          if (result.offline) {
            setActionSuccessMsg("Backend offline: changes not saved to the database");
            break;
          }
        }
      }
      const res = await collegeApi.acceptBatchRecords(batchInfo.batchId);
      setActionSuccessMsg(`Successfully accepted ${res.newlyAcceptedCount} validated records into Central Repository. Invalid rows remain pending correction.`);
      setTimeout(() => setActionSuccessMsg(""), 6000);
      loadIssues();
      if (refreshStats) refreshStats();
    } catch (e) {
      alert("Failed to accept records: " + e.message);
    } finally {
      setAcceptingRecords(false);
    }
  };

  // Simulate 8 days passing (triggers auto-escalation of overdue issues)
  const handleSimulate8Days = async () => {
    setSimulatingEscalation(true);
    try {
      const res = await collegeApi.triggerSimulateDaysPassing(8);
      setActionSuccessMsg(`Simulated 8 days elapsed! ${res.escalatedCount} unresolved issues past due date auto-escalated to AICTE Central Reviewer.`);
      setTimeout(() => setActionSuccessMsg(""), 7000);
      loadIssues();
      if (refreshStats) refreshStats();
    } catch (e) {
      alert("Simulation failed: " + e.message);
    } finally {
      setSimulatingEscalation(false);
    }
  };

  return (
    <div className="gov-container-wide">
      {/* Workbench Header & Batch Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
              Issue Workbench & Correction Loop
            </h2>
            {batchInfo && <StatusBadge status={batchInfo.batchStatus} />}
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Review, correct, and revalidate flagged student admissions data for Batch <code>{batchInfo?.batchId || "Loading..."}</code>.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {/* SIMULATE 8 DAYS PASSING BUTTON (Demo only, labelled) */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSimulate8Days}
            disabled={simulatingEscalation}
            title="Simulate 8 days elapsed: Triggers auto-escalation of open issues past deadline to AICTE Reviewer"
            style={{ borderColor: "#9333EA", color: "#6B21A8", background: "#FAF5FF" }}
          >
            {simulatingEscalation ? (
              <>
                <RefreshCw size={13} className="spin-slow" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <FastForward size={14} />
                <span>Simulate 8 days passing (demo only)</span>
              </>
            )}
          </button>

          {batchInfo?.readyCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAcceptReadyRecords}
              disabled={acceptingRecords}
              style={{ background: "#0F766E" }}
              title="Accept all records that passed automated checks into central repository"
            >
              {acceptingRecords ? (
                <>
                  <RefreshCw size={14} className="spin-slow" />
                  <span>Accepting Records...</span>
                </>
              ) : (
                <>
                  <CheckSquare size={16} />
                  <span>Accept {batchInfo.readyCount} Valid Records</span>
                </>
              )}
            </button>
          )}

          <Link to="/college/upload" className="btn btn-secondary btn-sm">
            <span>Upload New Batch</span>
          </Link>
        </div>
      </div>

      <div className="workbench-summary-grid">
        <div className="workbench-summary-card unresolved">
          <span>Issues Yet to Be Resolved</span>
          <strong>{batchInfo?.unresolvedIssueCount ?? 0}</strong>
          <small>Records requiring correction or review</small>
          <Link to="/college/workbench?status=ACTION_REQUIRED">View affected records</Link>
        </div>
        <div className="workbench-summary-card resolved">
          <span>Issues Resolved</span>
          <strong>{batchInfo?.resolvedIssueCount ?? 0}</strong>
          <small>Corrected or accepted issue records</small>
          <Link to="/college/reports">View resolution reports</Link>
        </div>
      </div>

      {/* Compliance Notice Banner & Settings indicator */}
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.8125rem", color: "#166534", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Info size={16} style={{ color: "#16A34A", flexShrink: 0 }} />
          <span>
            Issues are sorted by severity and due date.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ background: "rgba(22, 101, 52, 0.1)", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem" }}>
            <Clock size={11} style={{ display: "inline", marginRight: "3px" }} />
            Default Due Date: <strong>{dueDaysSetting} days (prototype setting)</strong>
          </span>
          <span style={{ fontWeight: "700" }}>
            Unresolved Anomalies: <span style={{ color: "#DC2626" }}>{batchInfo?.flaggedCount || 0}</span>
          </span>
        </div>
      </div>

      {/* Success Banner */}
      {actionSuccessMsg && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.25rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar" role="search" aria-label="Issue table filters">
        {/* Search */}
        <div className="filter-group" style={{ minWidth: "220px", flex: "1.5" }}>
          <label className="filter-label" htmlFor="search-input">Search Student / PRN / APAAR</label>
          <div style={{ position: "relative" }}>
            <input
              id="search-input"
              type="text"
              placeholder="Search name, PRN, 12-digit APAAR, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{ width: "100%", paddingLeft: "2.25rem" }}
            />
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          </div>
        </div>

        {/* Filter: Course */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-course">Course / Department</label>
          <select
            id="filter-course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Approved Courses</option>
            <option value="COMP">Computer Engineering</option>
            <option value="IT">Information Technology</option>
            <option value="ENTC">Electronics & Telecom</option>
            <option value="AIDS">AI & Data Science</option>
            <option value="AERO">Aeronautical (Unapproved)</option>
          </select>
        </div>

        {/* Filter: Year */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-year">Year of Study</label>
          <select
            id="filter-year"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Years</option>
            <option value="FE">First Year (FE)</option>
            <option value="SE">Second Year (SE)</option>
            <option value="TE">Third Year (TE)</option>
            <option value="BE">Final Year (BE)</option>
          </select>
        </div>

        {/* Filter: Issue Type */}
        <div className="filter-group">
          <label className="filter-label" htmlFor="filter-issue-type">Issue Type</label>
          <select
            id="filter-issue-type"
            value={issueTypeFilter}
            onChange={(e) => setIssueTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Issue Types</option>
            <option value="MISSING_APAAR_ID">Missing APAAR ID</option>
            <option value="WRONG_FORMAT">Wrong 12-digit Format</option>
            <option value="DUPLICATE_IN_BATCH">Duplicate in Batch</option>
            <option value="DUPLICATE_IN_REPOSITORY">Duplicate in Repository</option>
            <option value="CROSS_INSTITUTION_CONFLICT">Cross-Institution Conflict</option>
            <option value="INTAKE_EXCEEDED">Intake Exceeded</option>
            <option value="SEAT_CATEGORY_LIMIT">NRI/FN Quota Exceeded</option>
            <option value="COURSE_MAPPING_ERROR">Course Mapping Error</option>
            <option value="NONE">Passing / No Issue</option>
          </select>
        </div>

        {/* Filter: Severity */}
        <div className="filter-group" style={{ minWidth: "120px" }}>
          <label className="filter-label" htmlFor="filter-severity">Severity</label>
          <select
            id="filter-severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Filter: Status */}
        <div className="filter-group" style={{ minWidth: "140px" }}>
          <label className="filter-label" htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTION_REQUIRED">Action Required</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="READY_TO_ACCEPT">Ready to Accept</option>
            <option value="ACCEPTED">Accepted</option>
          </select>
        </div>

        {/* Reset Filters */}
        <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setCourseFilter("ALL");
              setYearFilter("ALL");
              setIssueTypeFilter("ALL");
              setSeverityFilter("ALL");
              setStatusFilter("ALL");
              setSearchQuery("");
            }}
            title="Clear all active filters"
            style={{ marginTop: "1rem" }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Table Wrapper */}
      <div className="data-table-wrapper">
        <table className="data-table" aria-label="Student Issue Workbench Records">
          <thead>
            <tr>
              <th scope="col">Student Details</th>
              <th scope="col">APAAR ID (12 Digits)</th>
              <th scope="col">Course & Year</th>
              <th scope="col">Issue Type & Severity</th>
              <th scope="col" style={{ minWidth: "260px" }}>Reason & Evidence</th>
              <th scope="col">Owner & Required Action</th>
              <th scope="col">Due Date & Badges</th>
              <th scope="col">Status</th>
              <th scope="col" style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem" }}>
                  <RefreshCw size={24} className="spin-slow" style={{ color: "var(--gov-navy-600)", margin: "0 auto 0.5rem auto" }} />
                  <span style={{ color: "var(--text-muted)", display: "block" }}>Loading issues from mock validation engine...</span>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "3rem" }}>
                  <CheckCircle2 size={32} style={{ color: "#166534", margin: "0 auto 0.5rem auto" }} />
                  <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.25rem" }}>
                    No Records Match Filters
                  </h4>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Try clearing search query or adjusting course and severity filters.
                  </p>
                </td>
              </tr>
            ) : (
              records.map((r) => {
                const isFlagged = r.status === "ACTION_REQUIRED" || r.status === "PENDING_REVIEW";

                return (
                  <tr key={r.id} className={isFlagged ? "row-flagged" : ""}>
                    {/* Student Name & PRN */}
                    <td>
                      <div style={{ fontWeight: "700", color: "var(--gov-navy-900)" }}>
                        {r.studentName}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        PRN: <code>{r.studentId}</code> &bull; {r.gender}
                      </div>
                    </td>

                    {/* APAAR ID */}
                    <td>
                      <div style={{ fontFamily: "monospace", fontWeight: "600", fontSize: "0.875rem", color: r.apaarId ? "var(--gov-navy-900)" : "#DC2626" }}>
                        {r.apaarId ? (
                          <span>{r.apaarId}</span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "#DC2626" }}>[MISSING]</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        format-checked, not identity-verified
                      </div>
                    </td>

                    {/* Programme & Year */}
                    <td>
                      <div style={{ fontWeight: "600", fontSize: "0.8125rem", color: "var(--gov-navy-900)" }}>
                        {r.programme}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {r.yearOfStudy} &bull; Cat: <strong>{r.category}</strong>
                      </div>
                    </td>

                    {/* Issue Type & Severity */}
                    <td>
                      {r.issueType ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: "700", fontSize: "0.78125rem", color: "#991B1B" }}>
                            {r.issueTitle || r.issueType}
                          </span>
                          <SeverityBadge severity={r.severity} />
                        </div>
                      ) : (
                        <span style={{ color: "#166534", fontSize: "0.75rem", fontWeight: "600" }}>
                          ✓ Passed Checks
                        </span>
                      )}
                    </td>

                    {/* Reason & Evidence */}
                    <td>
                      <div style={{ fontSize: "0.8125rem", color: isFlagged ? "#78350F" : "var(--text-main)", marginBottom: "0.25rem", lineHeight: "1.4" }}>
                        {r.reason}
                      </div>
                      {r.evidence && (
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "rgba(0,0,0,0.03)", padding: "2px 6px", borderRadius: "4px" }}>
                          <code>{r.evidence}</code>
                        </div>
                      )}
                    </td>

                    {/* Owner & Required Action */}
                    <td>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", color: r.owner === "AICTE Central Reviewer" ? "#6B21A8" : "var(--gov-navy-800)" }}>
                        {r.owner || "Institution Data Officer"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px", lineHeight: "1.3" }}>
                        {r.requiredAction || "None"}
                      </div>
                    </td>

                    {/* Due Date & Badges */}
                    <td>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-main)", fontWeight: "600" }}>
                        {r.dueDate || "N/A"}
                      </div>
                      {r.dueDateLabel && (
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {r.dueDateLabel}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
                        <OverdueBadge isOverdue={r.isOverdue} label="Overdue" />
                        <EscalatedBadge isEscalated={r.isEscalated} label="Escalated" />
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <StatusBadge status={r.status} />
                    </td>

                    {/* Action Button: Fix Record */}
                    <td style={{ textAlign: "right" }}>
                      {isFlagged ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setSelectedRecordForFix(r)}
                          style={{ background: "#B45309", whiteSpace: "nowrap" }}
                        >
                          <Edit3 size={13} />
                          <span>Fix Record</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedRecordForFix(r)}
                          style={{ whiteSpace: "nowrap" }}
                          title="Inspect or edit passing record"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Fix Record Dialog Modal */}
      {selectedRecordForFix && (
        <FixRecordModal
          record={selectedRecordForFix}
          batchId={batchInfo?.batchId}
          onClose={() => setSelectedRecordForFix(null)}
          onFixed={handleRecordFixed}
        />
      )}
    </div>
  );
}
