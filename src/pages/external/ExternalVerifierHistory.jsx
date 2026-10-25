import React, { useState } from "react";
import { Search } from "lucide-react";
import { verificationApi } from "../../api/verificationApi";

export function ExternalVerifierHistory() {
  const [history] = useState(() => verificationApi.getVerificationHistory());
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");

  const filtered = history.filter((entry) => {
    if (query.trim() && !entry.reference.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (resultFilter !== "ALL" && entry.result !== resultFilter) return false;
    return true;
  });

  return (
    <section className="gov-card" aria-labelledby="history-title">
      <h2 id="history-title" style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "1rem" }}>
        My Verification History
      </h2>
      <div className="filter-bar">
        <div className="filter-group" style={{ minWidth: "220px", flex: 2 }}>
          <label className="filter-label" htmlFor="history-reference">Search by reference</label>
          <div style={{ position: "relative" }}>
            <input id="history-reference" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="search-input" style={{ width: "100%", paddingLeft: "2.25rem" }} />
            <Search size={14} aria-hidden="true" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="history-result">Result</label>
          <select id="history-result" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="filter-select">
            <option value="ALL">All results</option>
            <option value="VALID">VALID</option>
            <option value="NOT_FOUND">NOT FOUND</option>
            <option value="REVOKED">REVOKED</option>
            <option value="CONSENT_MISSING">CONSENT NOT RECORDED</option>
          </select>
        </div>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Showing {filtered.length} of {history.length}</p>
      {history.length === 0 ? (
        <p style={{ color: "var(--text-muted)", padding: "1rem 0" }}>You have not verified any records yet.</p>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table" aria-label="My verification history">
            <thead><tr><th>Timestamp</th><th>Reference</th><th>Purpose</th><th>Result</th></tr></thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td><code>{entry.reference}</code></td>
                  <td>{entry.purpose}</td>
                  <td>{entry.result === "CONSENT_MISSING" ? "CONSENT NOT RECORDED" : entry.result}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4}>No verification attempts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
