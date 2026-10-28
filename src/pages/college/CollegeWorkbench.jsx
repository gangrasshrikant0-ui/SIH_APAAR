import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link, useOutletContext } from "react-router-dom";
import {
  Search,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Clock,
  FastForward,
  CheckSquare,
  SlidersHorizontal,
  FileDown,
  Printer
} from "lucide-react";

import { collegeApi } from "../../api/collegeApi";
import {
  acceptBackendRecord,
  isBackendConfigured,
} from "../../api/ingestionApi";
import { StatusBadge, SeverityBadge } from "../../components/StatusBadge";
import { FixRecordModal } from "../../components/FixRecordModal";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  function downloadAnomaliesCsv(issues) {
    const rows = [
      ["Student", "APAAR ID", "Issue", "Severity", "Status", "Date Flagged", "Date Resolved"],
      ...issues.map((issue) => [
        issue.studentName || "",
        issue.apaarId || "",
        issue.issueTitle || issue.issueType || "",
        issue.severity || "",
        issue.issueStatus || "",
        formatDate(issue.flaggedAt),
        formatDate(issue.resolvedAt)
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "aicte-vidya-anomalies.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return date.toLocaleDateString();
}

export function CollegeWorkbench() {
  const { refreshStats } = useOutletContext() || {};

  const [searchParams, setSearchParams] = useSearchParams();

  const requestedBatchId = searchParams.get("batch") || "";
  const viewParam = searchParams.get("view") || "";
  const issueParam = searchParams.get("issue") || "";

  const [records, setRecords] = useState([]);
  const [issues, setIssues] = useState([]);
  const [batchInfo, setBatchInfo] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecordForFix, setSelectedRecordForFix] = useState(null);

  const [acceptingRecords, setAcceptingRecords] = useState(false);
  const [simulatingEscalation, setSimulatingEscalation] = useState(false);

  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const [dueDaysSetting] = useState(7);

  const [view, setView] = useState(
    viewParam === "resolved" || viewParam === "unresolved"
      ? viewParam
      : "cards"
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState(issueParam);
  const [appliedFilters, setAppliedFilters] = useState({
    course: "ALL",
    year: "ALL",
    category: "ALL",
    issueType: "ALL",
    severity: "ALL",
    status: "ALL",
    search: issueParam
  });

  /*
   * IMPORTANT:
   * Workbench issues must come from collegeApi.getIssues().
   * Do not create synthetic issues in this component.
   * The API owns issue creation, status, resolution and counts.
   */
  const loadIssues = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const data = await collegeApi.getIssues({
        batchId: requestedBatchId || undefined,
        course: appliedFilters.course,
        year: appliedFilters.year,
        category: appliedFilters.category,
        issueType: appliedFilters.issueType,
        severity: appliedFilters.severity,
        status: appliedFilters.status,
        search: appliedFilters.search.trim(),
        bucket:
          view === "resolved" || view === "unresolved"
            ? view
            : undefined,
      });

      setRecords(data.records || []);
      setIssues(
        issueParam
          ? (data.issues || []).filter(
              (issue) => issue.issueId === issueParam
            )
          : data.issues || []
      );

      setBatchInfo({
        batchId: data.batchId,
        batchStatus: data.batchStatus,
        totalRows: data.totalRows,
        flaggedCount: data.flaggedCount,
        readyCount: data.readyCount,
        acceptedCount: data.acceptedCount,

        // These counts are returned by the API's issue ledger.
        // Do not add frontend-generated issue counts here.
        unresolvedIssueCount: data.unresolvedIssueCount || 0,
        resolvedIssueCount: data.resolvedIssueCount || 0,
      });
    } catch (error) {
      console.error("Failed to load Issues Workbench:", error);
      setLoadError(
        error?.message || "Unable to load issues. Please try again."
      );
      setRecords([]);
      setIssues([]);
      setBatchInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    requestedBatchId,
    issueParam,
    appliedFilters,
    view,
  ]);

  useEffect(() => {
    if (viewParam === "resolved" || viewParam === "unresolved") {
      setView(viewParam);
    }
  }, [viewParam]);

  useEffect(() => {
    setSearchQuery(issueParam);
    setAppliedFilters((current) => ({ ...current, search: issueParam }));
  }, [issueParam]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const openView = (nextView) => {
    setView(nextView);

    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);

    setSearchParams(next);
  };

  const returnToWorkbench = () => {
    setView("cards");

    const next = new URLSearchParams(searchParams);
    next.delete("view");
    next.delete("issue");
    setSearchQuery("");
    setAppliedFilters((current) => ({ ...current, search: "" }));

    setSearchParams(next);
  };

  const openFilters = () => {
    setCourseFilter(appliedFilters.course);
    setYearFilter(appliedFilters.year);
    setCategoryFilter(appliedFilters.category);
    setIssueTypeFilter(appliedFilters.issueType);
    setSeverityFilter(appliedFilters.severity);
    setStatusFilter(appliedFilters.status);
    setSearchQuery(appliedFilters.search);
    setFiltersOpen(true);
  };

  const handleRecordFixed = async (updatedRecord) => {
    setSelectedRecordForFix(null);

    const resolved =
      updatedRecord?.issueStatus === "RESOLVED";

    setActionSuccessMsg(
      `Record for ${updatedRecord?.studentName || "student"} ` +
        `(${updatedRecord?.studentId || "PRN unavailable"}) revalidated. ` +
        `Status: ${updatedRecord?.status || "updated"}. ` +
        (resolved
          ? "Issue resolved."
          : "Issue remains open because validation did not pass.")
    );

    window.setTimeout(() => setActionSuccessMsg(""), 6000);

    // Refresh from the API so issue status and counts reflect
    // the persisted revalidation result.
    await loadIssues();

    if (refreshStats) {
      refreshStats();
    }
  };

  const handleRecordRevalidated = async (updatedRecord) => {
    setActionSuccessMsg(
      `Revalidation updated ${updatedRecord?.studentName || "student"}'s issues. ` +
        "Any remaining failed checks are still unresolved."
    );
    window.setTimeout(() => setActionSuccessMsg(""), 6000);
    await loadIssues();
    if (refreshStats) refreshStats();
  };

  const handleDraftSaved = async (updatedRecord) => {
    setSelectedRecordForFix(null);
    setActionSuccessMsg(
      `Draft saved for ${updatedRecord?.studentName || "student"}. ` +
        "The issue remains unresolved until revalidation passes."
    );
    window.setTimeout(() => setActionSuccessMsg(""), 6000);
    await loadIssues();
    if (refreshStats) refreshStats();
  };

  const handleAcceptReadyRecords = async () => {
    if (!batchInfo || batchInfo.readyCount === 0) {
      return;
    }

    setAcceptingRecords(true);

    try {
      const ready = await collegeApi.getIssues({
        batchId: requestedBatchId || undefined,
        status: "READY_TO_ACCEPT",
      });
      const readyRecords = ready.records || [];
      const batchIds = [...new Set(
        readyRecords.map((record) => record.batchId).filter(Boolean)
      )];

      if (!batchIds.length) {
        throw new Error("No ready records were found in the selected batch scope.");
      }

      if (isBackendConfigured()) {
        for (const record of readyRecords.filter((item) =>
          String(item.id).startsWith("INGEST-")
        )) {
          const result = await acceptBackendRecord(record.id);

          if (result.offline) {
            setActionSuccessMsg(
              "Backend offline: changes were not saved to the database."
            );
            return;
          }
        }
      }

      let newlyAcceptedCount = 0;
      for (const batchId of batchIds) {
        const result = await collegeApi.acceptBatchRecords(batchId);
        newlyAcceptedCount += result.newlyAcceptedCount;
      }

      setActionSuccessMsg(
        `Successfully accepted ${newlyAcceptedCount} validated records ` +
          `into Central Repository. Invalid rows remain pending correction.`
      );

      window.setTimeout(() => setActionSuccessMsg(""), 6000);

      await loadIssues();

      if (refreshStats) {
        refreshStats();
      }
    } catch (error) {
      alert("Failed to accept records: " + error.message);
    } finally {
      setAcceptingRecords(false);
    }
  };

  const handleSimulate8Days = async () => {
    setSimulatingEscalation(true);

    try {
      const result = await collegeApi.triggerSimulateDaysPassing(8);

      setActionSuccessMsg(
        `Simulated 8 days elapsed! ${result.escalatedCount} unresolved ` +
          `issues past due date auto-escalated to AICTE Central Reviewer.`
      );

      window.setTimeout(() => setActionSuccessMsg(""), 7000);

      await loadIssues();

      if (refreshStats) {
        refreshStats();
      }
    } catch (error) {
      alert("Simulation failed: " + error.message);
    } finally {
      setSimulatingEscalation(false);
    }
  };

  const resetFilters = () => {
    setCourseFilter("ALL");
    setYearFilter("ALL");
    setCategoryFilter("ALL");
    setIssueTypeFilter("ALL");
    setSeverityFilter("ALL");
    setStatusFilter("ALL");
    setSearchQuery("");
    setAppliedFilters({
      course: "ALL",
      year: "ALL",
      category: "ALL",
      issueType: "ALL",
      severity: "ALL",
      status: "ALL",
      search: ""
    });
  };

  const applyFilters = () => {
    setAppliedFilters({
      course: courseFilter,
      year: yearFilter,
      category: categoryFilter,
      issueType: issueTypeFilter,
      severity: severityFilter,
      status: statusFilter,
      search: searchQuery
    });
    setFiltersOpen(false);
  };

  /*
   * A record may be returned in data.records or attached to an issue
   * as sourceRecord. Match by batch as well as record ID because IDs may
   * recur in different batches.
   */
  const findRecordForIssue = (issue) => {
    const sourceRecord = issue.sourceRecord || issue;
    const recordId = issue.recordId || sourceRecord.id;
    const batchId = issue.batchId || sourceRecord.batchId;
    const matchingRecord = records.find(
      (record) =>
        (!batchId || String(record.batchId) === String(batchId)) &&
        (String(record.id) === String(recordId) ||
          String(record.recordId) === String(recordId))
    );

    const record = {
      ...(matchingRecord || sourceRecord),
      issueId: issue.issueId,
      issueType: issue.issueType,
      issueTitle: issue.issueTitle,
      reason: issue.reason,
      evidence: issue.evidence,
      requiredAction: issue.requiredAction
    };
    return {
      record,
      batchId: batchId || record.batchId
    };
  };

  const filterSidebar = (
    <aside
      className="issue-filter-sidebar"
      aria-label="Issue table filters"
    >
      <div className="filter-group">
        <label className="filter-label" htmlFor="search-input">
          Search
        </label>

        <div style={{ position: "relative" }}>
          <input
            id="search-input"
            type="text"
            placeholder="Name, PRN, APAAR, issue ID"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="search-input"
            style={{
              width: "100%",
              paddingLeft: "2.25rem",
            }}
          />

          <Search
            size={14}
            style={{
              position: "absolute",
              left: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-course">
          Course
        </label>

        <select
          id="filter-course"
          value={courseFilter}
          onChange={(event) => setCourseFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All courses</option>
          <option value="COMP">Computer Engineering</option>
          <option value="IT">Information Technology</option>
          <option value="ENTC">Electronics & Telecom</option>
          <option value="AIDS">AI & Data Science</option>
          <option value="AERO">Aeronautical (Unapproved)</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-year">
          Year of study
        </label>

        <select
          id="filter-year"
          value={yearFilter}
          onChange={(event) => setYearFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All years</option>
          <option value="FE">First Year (FE)</option>
          <option value="SE">Second Year (SE)</option>
          <option value="TE">Third Year (TE)</option>
          <option value="BE">Final Year (BE)</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-category">
          Category
        </label>

        <select
          id="filter-category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All categories</option>
          <option value="GENERAL">GENERAL</option>
          <option value="OBC">OBC</option>
          <option value="SC">SC</option>
          <option value="ST">ST</option>
          <option value="EWS">EWS</option>
          <option value="TFWS">TFWS</option>
          <option value="NRI_FN">NRI / FN</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-issue-type">
          Issue type
        </label>

        <select
          id="filter-issue-type"
          value={issueTypeFilter}
          onChange={(event) => setIssueTypeFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All issue types</option>
          <option value="MISSING_APAAR_ID">Missing APAAR ID</option>
          <option value="MISSING_MANDATORY_FIELD">Missing required field</option>
          <option value="WRONG_FORMAT">Wrong 12-digit Format</option>
          <option value="MISSING_DOB">Missing Date of Birth</option>
          <option value="INVALID_CATEGORY">Invalid Category</option>
          <option value="DUPLICATE_IN_BATCH">Duplicate in Batch</option>
          <option value="DUPLICATE_IN_REPOSITORY">
            Duplicate in Repository
          </option>
          <option value="CROSS_INSTITUTION_CONFLICT">
            Cross-Institution Conflict
          </option>
          <option value="INTAKE_EXCEEDED">Intake Exceeded</option>
          <option value="SEAT_CATEGORY_LIMIT">
            NRI/FN Quota Exceeded
          </option>
          <option value="COURSE_MAPPING_ERROR">
            Course Mapping Error
          </option>
          <option value="APAAR_AUTHENTICITY_REVIEW">
            APAAR Authenticity Review
          </option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-severity">
          Severity
        </label>

        <select
          id="filter-severity"
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All severities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-status">
          Status
        </label>

        <select
          id="filter-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="filter-select"
        >
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="OVERDUE">Overdue</option>
          <option value="ESCALATED">Escalated</option>
          <option value="ACTION_REQUIRED">Action Required</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          {view === "resolved" && (
            <option value="RESOLVED">Resolved</option>
          )}
        </select>
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={resetFilters}
      >
        Reset filters
      </button>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={applyFilters}
      >
        Apply filters
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setFiltersOpen(false)}
      >
        Cancel
      </button>
    </aside>
  );

  return (
    <div className="gov-container-wide">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.75rem",
                color: "var(--gov-navy-900)",
              }}
            >
              Issue Workbench
            </h2>

            {requestedBatchId && batchInfo && (
              <StatusBadge status={batchInfo.batchStatus} />
            )}
          </div>

          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--text-muted)",
            }}
          >
            Review and correct flagged student admissions data for{" "}
            {requestedBatchId ? (
              <>Batch <code>{requestedBatchId}</code>.</>
            ) : (
              "all institution batches."
            )}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {view !== "cards" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={returnToWorkbench}
            >
              Return to Workbench
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSimulate8Days}
            disabled={simulatingEscalation}
            title="Simulate 8 days passing"
          >
            {simulatingEscalation ? (
              <>
                <RefreshCw size={13} className="spin-slow" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <FastForward size={14} />
                <span>Simulate 8 days passing</span>
              </>
            )}
          </button>

          {batchInfo?.readyCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAcceptReadyRecords}
              disabled={acceptingRecords}
              title="Accept validated records into the central repository"
            >
              {acceptingRecords ? (
                <>
                  <RefreshCw size={14} className="spin-slow" />
                  <span>Accepting Records...</span>
                </>
              ) : (
                <>
                  <CheckSquare size={16} />
                  <span>
                    Accept {batchInfo.readyCount} Valid Records
                  </span>
                </>
              )}
            </button>
          )}

          <Link
            to="/college/upload"
            className="btn btn-secondary btn-sm"
          >
            <span>Upload New Batch</span>
          </Link>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="gov-alert-success" role="status">
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {loadError && (
        <div className="gov-alert-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadIssues}
          >
            Retry
          </button>
        </div>
      )}

      {view === "cards" && (
        <>
          <div className="workbench-summary-grid">
            <button
              type="button"
              className="workbench-summary-card unresolved"
              onClick={() => openView("unresolved")}
            >
              <span>Issues Yet to Be Resolved</span>
              <strong>
                {batchInfo?.unresolvedIssueCount ?? 0}
              </strong>
              <small>
                Open, overdue, or escalated validation issues
              </small>
            </button>

            <button
              type="button"
              className="workbench-summary-card resolved"
              onClick={() => openView("resolved")}
            >
              <span>Issues Resolved</span>
              <strong>
                {batchInfo?.resolvedIssueCount ?? 0}
              </strong>
              <small>
                Issues closed after a passing revalidation
              </small>
            </button>
          </div>

          <p className="workbench-due-note">
            <Clock size={14} />
            Default due date: {dueDaysSetting} days
          </p>
        </>
      )}

      {view !== "cards" && (
        <div className={`issue-table-layout${filtersOpen ? " with-filters" : ""}`}>
          {filtersOpen && filterSidebar}

          <div className="issue-table-main workbench-print-area">
            <div className="issue-table-toolbar">
              <h3>
                {view === "resolved"
                  ? "Resolved issues"
                  : "Unresolved issues"}
              </h3>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => downloadAnomaliesCsv(issues)}
              >
                <FileDown size={14} />
                Download anomalies CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => window.print()}
              >
                <Printer size={14} />
                Printable view (PDF)
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={openFilters}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={14} />
                Filter
              </button>
            </div>

            <div className="data-table-wrapper">
              <table
                className="data-table"
                aria-label={
                  view === "resolved"
                    ? "Resolved issues"
                    : "Unresolved issues"
                }
              >
                <thead>
                  {view === "resolved" ? (
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">APAAR ID</th>
                      <th scope="col">Issue Description</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Fix Applied</th>
                      <th scope="col">Date Flagged</th>
                      <th scope="col">Date Resolved</th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">APAAR ID</th>
                      <th scope="col">Issue Description</th>
                      <th scope="col">Severity</th>
                      <th scope="col">Date Flagged</th>
                      <th scope="col">Action</th>
                    </tr>
                  )}
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={view === "resolved" ? 7 : 6}
                        style={{
                          textAlign: "center",
                          padding: "3rem",
                        }}
                      >
                        <RefreshCw
                          size={24}
                          className="spin-slow"
                          style={{
                            color: "var(--gov-navy-600)",
                            margin: "0 auto 0.5rem auto",
                          }}
                        />

                        <span
                          style={{
                            color: "var(--text-muted)",
                            display: "block",
                          }}
                        >
                          Loading issues...
                        </span>
                      </td>
                    </tr>
                  ) : issues.length === 0 ? (
                    <tr>
                      <td
                        colSpan={view === "resolved" ? 7 : 6}
                        className="empty-table-state"
                      >
                        <CheckCircle2 size={28} />

                        <h4>
                          {view === "resolved"
                            ? "No resolved issues yet"
                            : "No unresolved issues"}
                        </h4>

                        <p>
                          {view === "unresolved"
                            ? "No open issues match the selected filters. Upload and validate records to flag issues."
                            : "Resolved issues appear here after a passing revalidation."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    issues.map((issue) => (
                      <tr
                        key={`${issue.batchId || ""}-${issue.issueId}`}
                        className={
                          view === "unresolved"
                            ? "row-flagged"
                            : undefined
                        }
                      >
                        <td>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "var(--gov-navy-900)",
                            }}
                          >
                            {issue.studentName || "Unknown student"}
                          </div>

                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            PRN:{" "}
                            <code>
                              {issue.studentId || "Unavailable"}
                            </code>
                          </div>

                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            {issue.issueId}
                          </div>
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--text-dim)",
                            }}
                          >
                            Batch: <code>{issue.batchId || "Unavailable"}</code>
                          </div>
                        </td>

                        <td>
                          <code
                            style={{
                              fontWeight: 600,
                              color: issue.apaarId
                                ? "var(--gov-navy-900)"
                                : "#DC2626",
                            }}
                          >
                            {issue.apaarId || "[MISSING]"}
                          </code>
                        </td>

                        <td>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.8125rem",
                            }}
                          >
                            {issue.issueTitle || issue.issueType}
                          </div>

                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-main)",
                            }}
                          >
                            {issue.reason || "Validation issue"}
                          </div>
                        </td>

                        <td>
                          <SeverityBadge severity={issue.severity} />
                        </td>

                        {view === "resolved" && (
                          <td style={{ fontSize: "0.8125rem" }}>
                            {issue.fixApplied || "Revalidation passed"}
                          </td>
                        )}

                        <td>{formatDate(issue.flaggedAt)}</td>

                        {view === "resolved" ? (
                          <td>{formatDate(issue.resolvedAt)}</td>
                        ) : (
                          <td>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => setSelectedRecordForFix(findRecordForIssue(issue))}
                            >
                              <Edit3 size={13} />
                              Fix Record
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedRecordForFix && (
        <FixRecordModal
          record={selectedRecordForFix.record}
          batchId={selectedRecordForFix.batchId}
          onClose={() => setSelectedRecordForFix(null)}
          onFixed={handleRecordFixed}
          onRevalidated={handleRecordRevalidated}
          onDraftSaved={handleDraftSaved}
        />
      )}
    </div>
  );
}