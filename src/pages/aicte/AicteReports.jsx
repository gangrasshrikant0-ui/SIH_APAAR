import React, { useState } from "react";
import { FileText, Download, CheckCircle2, FileSpreadsheet, Printer, Globe } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";

export function AicteReports() {
  const [downloadSuccess, setDownloadSuccess] = useState("");

  const handleDownloadNationalIntake = async () => {
    try {
      const csvText = await aicteApi.exportNationalIntakeCSV();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AICTE_National_Intake_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("National Intake Report (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  const handleDownloadAuditTrail = async () => {
    try {
      const logs = await aicteApi.getAuditTrail();
      const headers = "ID,Timestamp,Actor Name,Role,Email,Action Type,Resource ID,Details,Change Summary,Severity\n";
      const rows = logs.map((l) => 
        `${l.id},"${l.timestamp}","${l.actorName}","${l.actorRole}","${l.actorEmail}","${l.actionType}","${l.resourceId}","${l.details.replace(/"/g, '""')}","${l.changeSummary}","${l.severity}"`
      ).join("\n");

      const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `AICTE_Compliance_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("AICTE Compliance Audit Trail (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          National AICTE Reports & Data Exports
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          Official central downloads covering all institutions for parliamentary inquiries, national data audits, and statutory archiving.
        </p>
      </div>

      {downloadSuccess && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>{downloadSuccess}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        {/* National Intake Report */}
        <div className="gov-card">
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#EFF6FF", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <Globe size={24} />
          </div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            All-India Institutional Intake Report
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
            Consolidated intake vs. accepted enrolment metrics across all AICTE-approved institutions in India, including utilisation percentages and open anomaly tallies.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadNationalIntake}
          >
            <Download size={14} />
            <span>Download National Intake CSV</span>
          </button>
        </div>

        {/* Full Audit Trail Export */}
        <div className="gov-card">
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#F3E8FF", color: "#6B21A8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            Complete Statutory Audit Trail
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
            Immutable CSV export of all system activity logs: batch submissions, automated revalidations, route guard violations, reviewer adjudications, and status updates.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadAuditTrail}
          >
            <Download size={14} />
            <span>Download Audit Trail CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
