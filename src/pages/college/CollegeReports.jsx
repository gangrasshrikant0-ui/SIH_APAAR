import React, { useState } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  ShieldAlert,
  Printer,
  Lock,
  Building2
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";

export function CollegeReports() {
  const [downloadSuccess, setDownloadSuccess] = useState("");
  const [securityDeniedMsg, setSecurityDeniedMsg] = useState("");
  const [printableReport, setPrintableReport] = useState(null);

  const handleDownloadIntakeCSV = async () => {
    try {
      const csvText = await collegeApi.exportIntakeCSV("INST-001");
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PICT_Approved_Intake_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("Accepted Intake Report (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  const handleDownloadAnomalyCSV = async () => {
    try {
      const csvText = await collegeApi.exportAnomaliesCSV("INST-001");
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `PICT_Anomalies_Resolution_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setDownloadSuccess("Unresolved Anomalies Report (CSV) downloaded successfully!");
      setTimeout(() => setDownloadSuccess(""), 4000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  // Test Security Guard: College attempting to download another college's data
  const handleTestUnauthorizedDownload = async () => {
    setSecurityDeniedMsg("");
    try {
      // Attempting to download COEP Tech data (INST-002) while logged in as PICT (INST-001)
      await collegeApi.exportIntakeCSV("INST-002");
    } catch (err) {
      setSecurityDeniedMsg(err.message + " An unauthorized download event has been timestamped and logged in the AICTE Security Audit Log.");
      setTimeout(() => setSecurityDeniedMsg(""), 7000);
    }
  };

  // Printable PDF view
  const handlePrintReport = async (type) => {
    const stats = await collegeApi.getDashboardStats();
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
          Official statutory exports for AICTE accreditation, annual reporting, and university audits. Institutions can download only their own data.
        </p>
      </div>

      {downloadSuccess && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {securityDeniedMsg && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong style={{ display: "block", marginBottom: "2px" }}>Data Isolation Policy Enforced (403 Forbidden)</strong>
            <span>{securityDeniedMsg}</span>
          </div>
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
              className="btn btn-secondary"
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
      </div>

      {/* Security Isolation Test Panel */}
      <div className="gov-card" style={{ background: "#F8FAFC", borderColor: "#CBD5E1" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#EFF6FF", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Lock size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: "1rem", color: "var(--gov-navy-900)", marginBottom: "0.25rem" }}>
              Multi-Institution Data Isolation Verification (Compliance Test)
            </h4>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "0.85rem", lineHeight: "1.5" }}>
              Under SIH 2026 data governance rules, colleges are strictly segregated and may never download or view another institution's compliance reports.
            </p>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={handleTestUnauthorizedDownload}
            >
              <ShieldAlert size={13} />
              <span>Test Security: Request COEP Tech Report (INST-002)</span>
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
                Institution: <strong>Pune Institute of Computer Technology (PICT)</strong> &bull; AICTE ID: <strong>AICTE-1-1029384</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "2px" }}>
                Generated: {printableReport.generatedAt} &bull; Prototype Setting
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
