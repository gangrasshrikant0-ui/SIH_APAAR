import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  Info,
  FastForward,
  Send,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  ChevronRight
} from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { collegeApi } from "../../api/collegeApi";
import {
  StatusBadge,
  SeverityBadge,
  OverdueBadge,
  EscalatedBadge
} from "../../components/StatusBadge";

// ── Lookup helpers ────────────────────────────────────────────────────────────
const ISSUE_TYPE_OPTIONS = [
  { value: "ALL", label: "All Issue Types" },
  { value: "INVALID_APAAR_FORMAT", label: "Invalid APAAR Format" },
  { value: "MISSING_APAAR", label: "Missing APAAR" },
  { value: "PRN_DUPLICATE", label: "PRN Duplicate" },
  { value: "DUPLICATE_IN_REPOSITORY", label: "Duplicate in Repository" },
  { value: "CROSS_INSTITUTION_CONFLICT", label: "Cross-Institution Conflict" },
  { value: "EXCESS_INTAKE", label: "Excess Intake" },
  { value: "CATEGORY_MISMATCH", label: "Category Mismatch" },
  { value: "PROGRAMME_MISMATCH", label: "Programme Mismatch" }
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "ACTION_REQUIRED", label: "Action Required" }
];

const SEVER_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SORTABLE = ["studentName", "institutionName", "severity", "issueType", "status", "dueDate"];
const PAGE_SIZE = 10;

function issueLabel(val) {
  return ISSUE_TYPE_OPTIONS.find((o) => o.value === val)?.label ?? val ?? "—";
}

// ── Sort icon ─────────────────────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
  return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function AicteCaseDrawer({ item, note, onNoteChange, onClose, onConfirm, onSendBack, processing }) {
  if (!item) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(11,25,44,0.35)",
          zIndex: 200, backdropFilter: "blur(2px)"
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={"Review detail for " + item.studentName}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(560px,100vw)",
          background: "#FFFFFF", zIndex: 201,
          boxShadow: "-4px 0 24px rgba(11,25,44,0.14)",
          display: "flex", flexDirection: "column", overflowY: "auto"
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid var(--border-light)", background: "var(--gov-blue-50)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Case Detail</p>
            <h2 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)" }}>{item.studentName}</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {item.institutionName} &bull; Batch <code style={{ fontSize: "0.75rem" }}>{item.batchId}</code>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close detail panel" style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "var(--text-muted)", borderRadius: "6px", display: "flex", alignItems: "center" }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <SeverityBadge severity={item.severity} />
            <StatusBadge status={item.status} />
            <OverdueBadge isOverdue={item.isOverdue} label="Overdue" />
            <EscalatedBadge isEscalated={item.isEscalated} label="Escalated" />
          </div>

          <div className="gov-card" style={{ padding: "1rem", background: "var(--bg-app)" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Student Identity</p>
            <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem 1rem", fontSize: "0.8125rem" }}>
              <div><dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>PRN / Roll No.</dt><dd style={{ fontWeight: 600 }}>{item.studentId ?? "—"}</dd></div>
              <div>
                <dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>APAAR ID</dt>
                <dd><code style={{ fontWeight: 600, color: "#1E3A8A" }}>{item.apaarId || "MISSING"}</code><span style={{ fontSize: "0.7rem", color: "var(--text-dim)", display: "block", marginTop: "1px" }}>Format-checked, not identity-verified</span></dd>
              </div>
              <div><dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Programme</dt><dd style={{ fontWeight: 600 }}>{item.programme ?? "—"}</dd></div>
              <div><dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Seat Category</dt><dd style={{ fontWeight: 600 }}>{item.seatCategory ?? "—"}</dd></div>
              <div><dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Year</dt><dd style={{ fontWeight: 600 }}>{item.year ?? "—"}</dd></div>
              <div><dt style={{ color: "var(--text-muted)", marginBottom: "2px" }}>Assigned Owner</dt><dd style={{ fontWeight: 600 }}>{item.owner ?? "—"}</dd></div>
            </dl>
          </div>

          <div style={{ background: item.isOverdue ? "#FFF7F7" : "#F8FAFC", border: "1px solid " + (item.isOverdue ? "#FCA5A5" : "var(--border-light)"), borderRadius: "8px", padding: "1rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: item.isOverdue ? "#991B1B" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
              Issue: {item.issueTitle || issueLabel(item.issueType)}
            </p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-main)", marginBottom: "0.6rem", lineHeight: 1.55 }}><strong>Diagnostic Reason:</strong> {item.reason}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}><strong>Evidence:</strong> <code style={{ fontSize: "0.75rem" }}>{item.evidence}</code></p>
            <div style={{ paddingTop: "0.6rem", borderTop: "1px solid var(--border-light)", fontSize: "0.8125rem", color: "#1E3A8A" }}><strong>Required Action:</strong> {item.requiredAction}</div>
          </div>

          {item.dueDate && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: item.isOverdue ? "#B91C1C" : "var(--text-muted)" }}>
              <Calendar size={14} />
              <span>Due: <strong>{new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></span>
              {item.isOverdue && <span style={{ color: "#DC2626", fontWeight: 600 }}>(Overdue)</span>}
            </div>
          )}

          <div style={{ background: "#FAF5FF", border: "1px solid #E9D5FF", borderRadius: "8px", padding: "1rem" }}>
            <label htmlFor="adj-note" style={{ display: "block", fontSize: "0.8125rem", fontWeight: 700, color: "#581C87", marginBottom: "0.4rem" }}>
              AICTE Reviewer Adjudication Note
              <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "#7C3AED", marginLeft: "0.4rem" }}>(logged in audit trail)</span>
            </label>
            <textarea
              id="adj-note"
              rows={3}
              placeholder="e.g. Verified valid Transfer Certificate TC-2026-9014 with COEP Registrar."
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              style={{ width: "100%", borderRadius: "6px", border: "1px solid #D8B4FE", padding: "0.6rem 0.75rem", fontSize: "0.875rem", resize: "vertical", fontFamily: "inherit", color: "var(--text-main)", background: "#FFFFFF", outline: "none", lineHeight: 1.5 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-light)", background: "#FAFAFA", display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSendBack} disabled={processing} title="Return to institution as ACTION_REQUIRED">
            <Send size={13} /><span>Send Back to College</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onConfirm} disabled={processing} style={{ background: "#166534" }} title="Confirm evidence — move to READY_TO_ACCEPT">
            {processing ? <RefreshCw size={13} className="spin-slow" /> : <Check size={14} />}
            <span>Confirm Evidence</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Sortable Table ─────────────────────────────────────────────────────────────
function AicteCaseTable({ items, selectedId, onSelect, sortCol, sortDir, onSort }) {
  const thStyle = (col) => ({
    padding: "0.65rem 1rem",
    textAlign: "left",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    cursor: SORTABLE.includes(col) ? "pointer" : "default",
    userSelect: "none",
    whiteSpace: "nowrap",
    background: "var(--gov-blue-50)",
    borderBottom: "2px solid var(--border-light)"
  });

  const cols = [
    { col: "studentName", label: "Student" },
    { col: "institutionName", label: "Institution" },
    { col: "issueType", label: "Issue Type" },
    { col: "severity", label: "Severity" },
    { col: "status", label: "Status" },
    { col: "dueDate", label: "Due Date" },
    { col: null, label: "" }
  ];

  return (
    <div className="gov-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }} aria-label="AICTE Central Review Queue">
          <thead>
            <tr>
              {cols.map(({ col, label }) => (
                <th
                  key={label || "__arrow"}
                  style={thStyle(col)}
                  onClick={col && SORTABLE.includes(col) ? () => onSort(col) : undefined}
                  aria-sort={sortCol === col ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {label}
                    {col && SORTABLE.includes(col) && <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                onClick={() => onSelect(item)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(item)}
                aria-selected={selectedId === item.id}
                style={{
                  background: selectedId === item.id ? "#F5F3FF" : item.isOverdue ? "#FFF7F7" : idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                  borderLeft: item.isOverdue ? "3px solid #FCA5A5" : item.isEscalated ? "3px solid #A78BFA" : "3px solid transparent",
                  cursor: "pointer",
                  transition: "background 0.1s ease",
                  outline: "none"
                }}
              >
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ fontWeight: 600, color: "var(--gov-navy-900)", marginBottom: "2px" }}>{item.studentName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    PRN: {item.studentId}&ensp;
                    {item.apaarId ? <code style={{ color: "#1E3A8A" }}>{item.apaarId}</code> : <span style={{ color: "#B91C1C", fontWeight: 600 }}>APAAR missing</span>}
                  </div>
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
                  <div style={{ fontWeight: 500 }}>{item.institutionName}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{item.programme}</div>
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)", maxWidth: "200px" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{item.issueTitle || issueLabel(item.issueType)}</div>
                  <div style={{ display: "flex", gap: "0.3rem", marginTop: "4px", flexWrap: "wrap" }}>
                    <OverdueBadge isOverdue={item.isOverdue} label="Overdue" />
                    <EscalatedBadge isEscalated={item.isEscalated} label="Escalated" />
                  </div>
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
                  <SeverityBadge severity={item.severity} />
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
                  <StatusBadge status={item.status} />
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)", whiteSpace: "nowrap" }}>
                  {item.dueDate
                    ? <span style={{ fontSize: "0.8125rem", color: item.isOverdue ? "#B91C1C" : "var(--text-muted)", fontWeight: item.isOverdue ? 600 : 400 }}>
                        {new Date(item.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    : <span style={{ color: "var(--text-dim)", fontSize: "0.8125rem" }}>—</span>
                  }
                </td>
                <td style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--border-light)", textAlign: "center", width: "40px" }}>
                  <ChevronRight size={16} style={{ color: "var(--text-dim)" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0.65rem 1rem", background: "var(--gov-blue-50)", borderTop: "1px solid var(--border-light)", fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Showing <strong>{items.length}</strong> case{items.length !== 1 ? "s" : ""} &bull; Click any row to review and adjudicate</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}><Info size={12} /> APAAR IDs are format-checked, not identity-verified</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function AicteReviewQueue() {
  const [searchParams] = useSearchParams();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState({});
  const [actionSuccessMsg, setActionSuccessMsg] = useState("");
  const [simulatingEscalation, setSimulatingEscalation] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [page, setPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState(searchParams.get("institution") || "ALL");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortCol, setSortCol] = useState("severity");
  const [sortDir, setSortDir] = useState("desc");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aicteApi.getReviewQueue({ institutionId: institutionFilter, issueType: issueTypeFilter, search: searchQuery });
      setQueue(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [institutionFilter, issueTypeFilter, searchQuery]);

  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => { setPage(1); }, [institutionFilter, issueTypeFilter, statusFilter, searchQuery]);

  const filteredQueue = queue
    .filter((item) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "ESCALATED") return item.isEscalated;
      return item.status === statusFilter;
    })
    .sort((a, b) => {
      let av = a[sortCol]; let bv = b[sortCol];
      if (sortCol === "severity") { av = SEVER_ORDER[a.severity] ?? 99; bv = SEVER_ORDER[b.severity] ?? 99; }
      if (av == null) av = ""; if (bv == null) bv = "";
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

  const selectedCase = filteredQueue.find((i) => i.id === selectedCaseId) ?? null;
  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleQueue = filteredQueue.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleConfirmEvidence = async (item) => {
    setProcessingId(item.id);
    const note = reviewerNotes[item.id] || "Official transfer/supernumerary documentation verified by Central Reviewer.";
    try {
      await aicteApi.confirmReviewerEvidence(item.batchId, item.id, note);
      setActionSuccessMsg("Evidence confirmed for " + item.studentName + ". Record moved to READY_TO_ACCEPT.");
      setTimeout(() => setActionSuccessMsg(""), 6000);
      setSelectedCaseId(null);
      loadQueue();
    } catch (e) { alert("Error confirming evidence: " + e.message); }
    finally { setProcessingId(null); }
  };

  const handleSendBack = async (item) => {
    setProcessingId(item.id);
    const note = reviewerNotes[item.id] || "Insufficient documentation provided. Please reconcile and resubmit.";
    try {
      await aicteApi.sendBackToCollege(item.batchId, item.id, note);
      setActionSuccessMsg("Record returned to " + item.institutionName + " as ACTION_REQUIRED.");
      setTimeout(() => setActionSuccessMsg(""), 6000);
      setSelectedCaseId(null);
      loadQueue();
    } catch (e) { alert("Error returning record: " + e.message); }
    finally { setProcessingId(null); }
  };

  const handleSimulate8Days = async () => {
    setSimulatingEscalation(true);
    try {
      await collegeApi.triggerSimulateDaysPassing(8);
      setActionSuccessMsg("Simulated 8 days passing. Overdue issues auto-escalated to Central Review Queue.");
      setTimeout(() => setActionSuccessMsg(""), 6000);
      loadQueue();
    } catch (e) { alert("Simulation failed: " + e.message); }
    finally { setSimulatingEscalation(false); }
  };

  const clearFilters = () => { setSearchQuery(""); setInstitutionFilter("ALL"); setIssueTypeFilter("ALL"); setStatusFilter("ALL"); };

  return (
    <div className="gov-container-wide" style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
            <ShieldCheck size={22} style={{ color: "#6B21A8" }} />
            <h2 style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)" }}>Central Review &amp; Escalation Queue</h2>
            {!loading && queue.length > 0 && <span className="tag-badge escalated">{queue.length} Pending</span>}
          </div>
          <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
            Adjudicate escalated issues, cross-institution conflicts, and excess intake warnings.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleSimulate8Days}
          disabled={simulatingEscalation}
          title="Simulate 8 days elapsed — triggers auto-escalation (prototype only)"
          style={{ borderColor: "#9333EA", color: "#6B21A8", background: "#FAF5FF" }}
        >
          {simulatingEscalation
            ? <><RefreshCw size={13} className="spin-slow" /><span>Simulating&hellip;</span></>
            : <><FastForward size={14} /><span>Simulate 8 days passing</span><span style={{ fontSize: "0.7rem", marginLeft: "4px" }}>(demo only)</span></>
          }
        </button>
      </div>

      {/* Toast */}
      {actionSuccessMsg && (
        <div role="status" aria-live="polite" style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1.25rem", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={16} /><span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: "1rem", alignItems: "flex-end", flexWrap: "wrap", gap: "0.75rem" }}>
        <div className="filter-group" style={{ flex: "2 1 220px", minWidth: "200px" }}>
          <label className="filter-label" htmlFor="wrk-search">Search</label>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input id="wrk-search" type="text" placeholder="Student name, PRN, APAAR ID, institution..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" style={{ width: "100%", paddingLeft: "2.25rem" }} />
          </div>
        </div>
        <div className="filter-group" style={{ flex: "1 1 180px" }}>
          <label className="filter-label" htmlFor="wrk-inst">Institution</label>
          <select id="wrk-inst" value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)} className="filter-select">
            <option value="ALL">All Institutions</option>
            <option value="INST-001">PICT Pune (AICTE-1-1029384)</option>
            <option value="INST-002">COEP Tech (AICTE-1-1099231)</option>
            <option value="INST-003">VJTI Mumbai (AICTE-1-1088421)</option>
          </select>
          {institutionFilter !== "ALL" && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInstitutionFilter("ALL")}>Clear institution filter</button>}
        </div>
        <div className="filter-group" style={{ flex: "1 1 180px" }}>
          <label className="filter-label" htmlFor="wrk-issue">Issue Type</label>
          <select id="wrk-issue" value={issueTypeFilter} onChange={(e) => setIssueTypeFilter(e.target.value)} className="filter-select">
            {ISSUE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="filter-group" style={{ flex: "1 1 160px" }}>
          <label className="filter-label" htmlFor="wrk-status">Status</label>
          <select id="wrk-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", paddingBottom: "2px" }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
            <Filter size={13} /><span>Clear</span>
          </button>
          <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", whiteSpace: "nowrap", fontWeight: 600 }}>
            {loading ? "Loading..." :             filteredQueue.length + " case" + (filteredQueue.length !== 1 ? "s" : "") + ` · Page ${currentPage} of ${totalPages}`}
          </span>
        </div>
      </div>

      {/* Student list */}
      {loading ? (
        <div className="gov-card" style={{ textAlign: "center", padding: "3rem" }}>
          <RefreshCw size={24} className="spin-slow" style={{ color: "#4F46E5", margin: "0 auto 0.5rem auto" }} />
          <p style={{ color: "var(--text-muted)" }}>Loading escalated review queue...</p>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="state-box">
          <CheckCircle2 size={36} style={{ color: "#166534", marginBottom: "0.75rem" }} />
          <h3 className="state-title">No cases match the selected filters</h3>
          <p className="state-desc">
            {queue.length === 0
              ? "All issues are under college resolution or verified. Click \"Simulate 8 days passing\" to test escalation."
              : "Try broadening your search or clearing filters."}
          </p>
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "1rem" }} onClick={clearFilters}>Clear Filters</button>
        </div>
      ) : (
        <AicteCaseTable
          items={visibleQueue}
          selectedId={selectedCaseId}
          onSelect={(item) => setSelectedCaseId(item.id)}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={(col) => {
            if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
            else { setSortCol(col); setSortDir("asc"); }
          }}
        />
      )}
      {filteredQueue.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>
      )}

      {/* Detail drawer */}
      {selectedCase && (
        <AicteCaseDrawer
          item={selectedCase}
          note={reviewerNotes[selectedCase.id] || ""}
          onNoteChange={(text) => setReviewerNotes((prev) => ({ ...prev, [selectedCase.id]: text }))}
          onClose={() => setSelectedCaseId(null)}
          onConfirm={() => handleConfirmEvidence(selectedCase)}
          onSendBack={() => handleSendBack(selectedCase)}
          processing={processingId === selectedCase.id}
        />
      )}
    </div>
  );
}
