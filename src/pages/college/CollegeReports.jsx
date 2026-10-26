import React, { useEffect, useState } from "react";
import {
  FileText,
  Download,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Award
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { collegeApi } from "../../api/collegeApi";
import { getBackendDashboard, getBackendReport, isBackendConfigured } from "../../api/ingestionApi";

export function CollegeReports() {
  const [downloadSuccess, setDownloadSuccess] = useState("");
  const [printableReport, setPrintableReport] = useState(null);
  const [certificateRecords, setCertificateRecords] = useState([]);
  const [certificateRecord, setCertificateRecord] = useState(null);
  const [certificateError, setCertificateError] = useState("");
  const [copiedReference, setCopiedReference] = useState("");
  const [backendReport, setBackendReport] = useState(null);
  const [offlineNotice, setOfflineNotice] = useState("");

  const loadBackendReport = async () => {
    if (!isBackendConfigured()) return;
    const result = await getBackendReport("INSTITUTION");
    if (result?.offline) {
      setOfflineNotice("Backend offline: using demo data");
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
        csvText = await collegeApi.exportIntakeCSV("INST-001");
      }
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

  const handleOpenCertificate = async () => {
    setCertificateError("");
    try {
      const records = await collegeApi.getAcceptedRecords();
      setCertificateRecords(records);
      setCertificateRecord(records[0] || null);
      if (records.length === 0) {
        setCertificateError("No accepted student records are available for certificate printing.");
      }
    } catch (error) {
      setCertificateError(error.message || "Unable to load accepted records.");
    }
  };

  const getVerificationLink = (record) =>
    record?.recordReference
      ? `${window.location.origin}/verify/${encodeURIComponent(record.recordReference)}`
      : "";

  const handleCopyVerificationLink = async () => {
    const link = getVerificationLink(certificateRecord);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedReference(certificateRecord.recordReference);
      setTimeout(() => setCopiedReference(""), 2500);
    } catch (error) {
      setCertificateError(error.message || "Unable to copy the verification link.");
    }
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.75rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Institutional Compliance Reports & Data Exports
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)" }}>
          Prototype CSV and printable exports for AICTE accreditation, annual reporting, and university audit workflows. No live submission to those systems is configured.
        </p>
      </div>
      {offlineNotice && <p className="gov-alert gov-alert-warning">{offlineNotice}</p>}

      {downloadSuccess && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <CheckCircle2 size={18} />
          <span>{downloadSuccess}</span>
        </div>
      )}


      {certificateError && (
        <div role="alert" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {certificateError}
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

      {/* Report 3: Student Certificate */}
      <div className="gov-card" style={{ marginBottom: "2.5rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "10px", background: "#EFF6FF", color: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
          <Award size={24} />
        </div>
        <h3 style={{ fontSize: "1.15rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          Student Credential Certificate
        </h3>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: "1.5" }}>
          Preview and print a certificate for an accepted student record. The certificate includes the institutional Student ID / PRN and APAAR ID.
        </p>
        <button type="button" className="btn btn-primary" onClick={handleOpenCertificate}>
          <Award size={14} />
          <span>Open Certificate Preview</span>
        </button>
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

      {certificateRecord && (
        <div className="modal-backdrop print-certificate-backdrop" onClick={() => setCertificateRecord(null)}>
          <div className="modal-dialog print-certificate-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "820px", padding: "2.5rem" }}>
            <div className="print-certificate">
              <div style={{ textAlign: "center", borderBottom: "3px solid var(--gov-navy-900)", paddingBottom: "1.25rem", marginBottom: "1.75rem" }}>
                <div style={{ fontSize: "0.8125rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: "700" }}>
                  Government Credential Record
                </div>
                <h2 style={{ fontSize: "1.8rem", color: "var(--gov-navy-900)", margin: "0.5rem 0" }}>
                  Student Credential Certificate
                </h2>
                <div style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>
                  Pune Institute of Computer Technology (PICT)
                </div>
              </div>

              <p style={{ textAlign: "center", color: "var(--text-muted)", lineHeight: "1.5", marginBottom: "1.75rem" }}>
                This certificate confirms that the following synthetic student record is accepted in the institutional repository.
              </p>

              <dl style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.8fr) 1.2fr", gap: "0.9rem 1.25rem", margin: 0, padding: "1.25rem", border: "1px solid var(--border-medium)", borderRadius: "8px" }}>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>Student name</dt>
                <dd style={{ margin: 0, fontWeight: "700", color: "var(--gov-navy-900)" }}>{certificateRecord.studentName}</dd>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>Institutional Student ID / PRN</dt>
                <dd style={{ margin: 0, fontFamily: "monospace" }}>{certificateRecord.studentId}</dd>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>APAAR ID</dt>
                <dd style={{ margin: 0, fontFamily: "monospace", fontWeight: "700" }}>{certificateRecord.apaarId || "[MISSING]"}</dd>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>Programme</dt>
                <dd style={{ margin: 0 }}>{certificateRecord.programme}</dd>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>Academic year</dt>
                <dd style={{ margin: 0 }}>{certificateRecord.academicYear || "2026-2027"}</dd>
                <dt style={{ fontWeight: "700", color: "var(--text-muted)" }}>Record status</dt>
                <dd style={{ margin: 0 }}>{certificateRecord.status}</dd>
              </dl>

              <div className="certificate-verification" style={{ marginTop: "1.75rem", paddingTop: "1rem", borderTop: "1px solid var(--border-light)", textAlign: "center" }}>
                {certificateRecord.recordReference ? (
                  <>
                    <div className="certificate-qr" role="img" aria-label={`QR code for record reference ${certificateRecord.recordReference}`}>
                      <QRCodeSVG
                        value={getVerificationLink(certificateRecord)}
                        size={240}
                        level="H"
                        includeMargin
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                      />
                    </div>
                    <p style={{ margin: "0.75rem 0 0.25rem", fontWeight: "700", color: "var(--gov-navy-900)" }}>
                      Verification reference: <code>{certificateRecord.recordReference}</code>
                    </p>
                    <a href={getVerificationLink(certificateRecord)} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", overflowWrap: "anywhere" }}>
                      {getVerificationLink(certificateRecord)}
                    </a>
                    <div className="print-certificate-actions" style={{ marginTop: "0.75rem" }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyVerificationLink}>
                        {copiedReference === certificateRecord.recordReference ? "Copied" : "Copy verification link"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>No verification reference yet</p>
                )}
                <p style={{ margin: "1rem 0 0", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                  Verification mode: DEMO (simulated). Not an officially signed credential. A correctly formatted APAAR ID is not identity-verified.
                </p>
              </div>
            </div>

            <div className="print-certificate-actions" style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "1.75rem" }}>
              <label className="filter-group" style={{ maxWidth: "360px" }}>
                <span className="filter-label">Accepted record</span>
                <select
                  className="filter-select"
                  value={certificateRecord.id}
                  onChange={(event) => setCertificateRecord(certificateRecords.find((record) => record.id === event.target.value) || null)}
                >
                  {certificateRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.studentName} — {record.studentId}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCertificateRecord(null)}>
                  Close Preview
                </button>
                <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                  <Printer size={14} />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
