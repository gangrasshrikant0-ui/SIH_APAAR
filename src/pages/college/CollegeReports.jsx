import React, { useEffect, useState } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Printer
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { getCurrentUser } from "../../mocks/mockStore";
import { getBackendDashboard, getBackendReport, isBackendConfigured } from "../../api/ingestionApi";

export function CollegeReports() {
  const institutionId = getCurrentUser()?.id || "INST-001";
  const institutionName = getCurrentUser()?.institutionName || "Institution";
  const [downloadSuccess, setDownloadSuccess] = useState("");
  const [printableReport, setPrintableReport] = useState(null);
  const [backendReport, setBackendReport] = useState(null);
  const [offlineNotice, setOfflineNotice] = useState("");

  const loadBackendReport = async () => {
    if (!isBackendConfigured()) return;
    const result = await getBackendReport("INSTITUTION");
    if (result?.offline) {
      setOfflineNotice("Connection unavailable; showing locally available records.");
    } else {
      setOfflineNotice("");
      setBackendReport(result);
    }
  };

  useEffect(() => {
    loadBackendReport().catch((error) => console.error(error));
    const poll = setInterval(() => { if (!document.hidden) loadBackendReport().catch((error) => console.error(error)); }, 15000);
    const refresh = () => { if (!document.hidden) loadBackendReport().catch((error) => console.error(error)); };
    window.addEventListener("apaar:data-sync", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(poll); window.removeEventListener("apaar:data-sync", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const handleDownloadIntakeCSV = async () => {
    try {
      let csvText;
      if (backendReport?.rows) {
        const headers = "Institution,Programme,Year,Approved Intake,Actual Enrolment,Accepted Enrolment,Utilisation %,Category Counts,Supernumerary Seats\n";
        const rows = backendReport.rows.map((row) => `"${row.institution}","${row.programmeName}","${row.year}",${row.approvedIntake},${row.acceptedEnrolment},${row.acceptedEnrolment},"${row.utilisation}%","${row.programmeName}",${row.supernumerarySeats || ""}`).join("\n");
        csvText = headers + rows;
      } else {
        csvText = await collegeApi.exportIntakeCSV(institutionId);
      }
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${institutionName.replaceAll(" ", "_")}_Approved_Intake_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("Accepted Intake Report (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  const handleDownloadAnomalyCSV = async () => {
    try {
      const csvText = await collegeApi.exportAnomaliesCSV(institutionId);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${institutionName.replaceAll(" ", "_")}_Anomalies_Resolution_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("Unresolved Anomalies Report (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  const handleDownloadCompleteCSV = async () => {
    try {
      const csvText = await collegeApi.exportCompleteCSV(institutionId);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${institutionName.replaceAll(" ", "_")}_Complete_Validation_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloadSuccess("Complete validation report downloaded successfully.");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  // Printable PDF view
  const handlePrintReport = async (type) => {
    const stats = backendReport?.rows
      ? await getBackendDashboard("INSTITUTION").then((result) => result?.offline ? collegeApi.getDashboardStats() : result)
      : await collegeApi.getDashboardStats();
    setPrintableReport({
      type,
      title: type === "INTAKE" ? "Official Enrolment & Intake Compliance Report" : "Unresolved Data Anomalies Audit Report",
      stats,
      generatedAt: new Date().toLocaleString()
    });
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Institutional Compliance Reports & Data Exports
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          CSV and printable exports for accreditation, annual reporting, and university audit workflows. No live submission to those systems is configured.
        </p>
      </div>
      {offlineNotice && <p className="gov-alert gov-alert-warning">{offlineNotice}</p>}

      {downloadSuccess && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>{downloadSuccess}</span>
        </div>
      )}


      {/* Reports Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginBottom: "2.5rem" }}>
        {/* Report 1: Intake & Enrolment Report */}
        <div className="gov-card">
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <FileSpreadsheet size={24} />
          </div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            Accepted Student Enrolment Report
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
            Official export of approved intake vs. accepted enrolment by programme and seat categories (General, OBC, SC, ST, EWS, TFWS, NRI/FN).
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadIntakeCSV}
            >
              <Download size={14} />
              <span>Download Intake CSV</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handlePrintReport("INTAKE")}
            >
              <Printer size={14} />
              <span>Printable View (PDF)</span>
            </button>
          </div>
        </div>

        {/* Report 2: Anomaly Resolution Log */}
        <div className="gov-card">
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            Unresolved Anomalies & Action Plan
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
            Granular breakdown of currently flagged discrepancies, including missing APAAR IDs, in-batch duplicates, responsible owners, and upcoming escalation deadlines.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadAnomalyCSV}
            >
              <Download size={14} />
              <span>Download Anomalies CSV</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handlePrintReport("ANOMALIES")}
            >
              <Printer size={14} />
              <span>Printable View (PDF)</span>
            </button>
          </div>
        </div>

        <div className="gov-card">
          <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#DBEAFE", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
            <FileText size={24} />
          </div>
          <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
            Complete Validation Report
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
            Download the complete student validation and issue-status report for this institution.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
  <button
    type="button"
    className="btn btn-primary"
    onClick={handleDownloadCompleteCSV}
  >
    <Download size={14} />
    <span>Download Complete Report</span>
  </button>

  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handlePrintReport("COMPLETE")}
  >
    <Printer size={14} />
    <span>Printable View (PDF)</span>
  </button>
</div>
        </div>
      </div>

      {/* Printable Modal / View */}
      {printableReport && (
        <div className="modal-backdrop" onClick={() => setPrintableReport(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "780px", padding: "2.5rem" }}>
            <div style={{ textAlign: "center", borderBottom: "2px solid var(--gov-navy-900)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
              <span style={{ fontSize: "0.8125rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", fontWeight: "700" }}>
                All India Council for Technical Education &bull; AICTE Statutory Report
              </span>
              <h2 style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)", marginTop: "4px" }}>
                {printableReport.title}
              </h2>
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "4px" }}>
                Institution: <strong>{institutionName}</strong> &bull; Institution ID: <strong>{institutionId}</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                Generated: {printableReport.generatedAt}
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #CBD5E1" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left" }}>Programme</th>
                    <th style={{ padding: "0.5rem", textAlign: "center" }}>Approved Seats</th>
                    <th style={{ padding: "0.5rem", textAlign: "center" }}>Accepted Enrolment</th>
                    <th style={{ padding: "0.5rem", textAlign: "center" }}>Utilisation %</th>
                  </tr>
                </thead>
                <tbody>
                  {printableReport.stats.programmes.map((p) => (
                    <tr key={p.code} style={{ borderBottom: "1px solid #E2E8F0" }}>
                      <td style={{ padding: "0.5rem" }}>{p.name} ({p.degree})</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>{p.approvedIntake}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center", fontWeight: "bold" }}>{p.acceptedEnrolment}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>{p.utilisation}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#F8FAFC", padding: "1rem", borderRadius: "8px", fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
              <strong>Notice:</strong> ACCEPTED is not VERIFIED. Enrolment numbers include only records that successfully satisfied all automated AICTE Approval Master rules.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPrintableReport(null)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={14} />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
