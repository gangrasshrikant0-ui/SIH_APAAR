import React, { useState } from "react";
import { Award, Download, Search } from "lucide-react";
import { collegeApi } from "../api/collegeApi";
import { getBackendStudentJourney, isBackendConfigured } from "../api/ingestionApi";

export function StudentCertificate() {
  const [apaarId, setApaarId] = useState("");
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupNotice, setLookupNotice] = useState("");

  const lookup = async (event) => {
    event.preventDefault();
    setRecord(null);
    setMessage("");
    setError("");
    setLookupNotice("");
    if (!/^\d{12}$/.test(apaarId.trim())) {
      setError("APAAR ID must contain exactly 12 numeric digits.");
      return;
    }
    setLoading(true);
    try {
      const backend = isBackendConfigured()
        ? await getBackendStudentJourney(apaarId, "COLLEGE")
        : null;
      const result = backend && !backend.offline
        ? backend
        : await collegeApi.getStudentJourney(apaarId);
      if (backend?.offline) {
        setLookupNotice("Connection unavailable; checking locally stored records.");
      }
      const accepted = result.records.find((item) => item.status === "ACCEPTED");
      if (!accepted) {
        setMessage(result.records.length
          ? "The matching record belongs to this institution but is not accepted yet. A certificate cannot be generated."
          : "No matching student record was found for this institution.");
        return;
      }
      setRecord(accepted);
    } catch (lookupError) {
      setError(lookupError.message || "Unable to look up this APAAR ID.");
    } finally {
      setLoading(false);
    }
  };

  const verificationId = record ? (record.recordReference || `EDU-${record.institutionId}-${record.id}`) : "";
  const verificationLink = verificationId
    ? `${window.location.origin}/external/verify?reference=${encodeURIComponent(verificationId)}`
    : "";

  return (
    <section className="gov-card student-certificate-section">
      <div className="section-heading">
        <div className="role-card-icon"><Award size={22} /></div>
        <div>
          <h2>Generate Student Certificate</h2>
          <p>Look up an accepted student record by APAAR ID and prepare its certificate.</p>
        </div>
      </div>
      <form onSubmit={lookup} className="certificate-lookup-form">
        <label htmlFor="certificate-apaar">Student APAAR ID</label>
        <div className="certificate-lookup-controls">
          <input
            id="certificate-apaar"
            value={apaarId}
            onChange={(event) => { setApaarId(event.target.value); setRecord(null); setMessage(""); }}
            inputMode="numeric"
            maxLength={12}
            placeholder="12-digit APAAR ID"
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Search size={15} />
            {loading ? "Looking up..." : "Find student"}
          </button>
        </div>
      </form>
      {error && <p className="certificate-error" role="alert">{error}</p>}
      {message && <p className="certificate-message" role="status">{message}</p>}
      {lookupNotice && <p className="certificate-message" role="status">{lookupNotice}</p>}
      {record && (
        <div className="certificate-result">
          <div className="certificate-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Download size={15} /> Print / Download Certificate
            </button>
          </div>

          <div className="certificate-print-preview">
            <div className="certificate-template">
              <div className="certificate-template-frame">
                <div className="certificate-template-pattern" />
                <div className="certificate-template-gold-frame">
                  <div className="certificate-template-canvas">
                    <div className="certificate-template-emblem">
                      <svg viewBox="0 0 100 115" aria-hidden="true"><path d="M50 8 C40 8 36 16 36 24 C36 29 39 34 43 37 C39 40 37 45 37 50 C37 54 39 57 41 59 C37 63 35 69 35 75 L35 84 L65 84 L65 75 C65 69 63 63 59 59 C61 57 63 54 63 50 C63 45 61 40 57 37 C61 34 64 29 64 24 C64 16 60 8 50 8 Z M22 28 C18 28 14 34 14 42 C14 48 17 54 22 57 C20 62 21 68 23 72 L32 72 L32 60 C30 57 28 53 28 47 C28 42 30 38 33 35 C31 31 27 28 22 28 Z M78 28 C73 28 69 31 67 35 C70 38 72 42 72 47 C72 53 70 57 68 60 L68 72 L77 72 C79 68 80 62 78 57 C83 54 86 48 86 42 C86 34 82 28 78 28 Z M25 86 H75 V95 H25 Z" /></svg>
                      <span>SATYAMEV JAYATE</span>
                    </div>
                    <div className="certificate-template-government">Government of India - Ministry of Education</div>
                    <div className="certificate-template-council">All India Council for Technical Education</div>
                    <div className="certificate-template-title">Certificate of Verified Student Credential</div>
                    <div className="certificate-template-subtitle">National APAAR Academic Identity &amp; Enrolment Verification</div>

                    <div className="certificate-template-info">
                      <div className="certificate-template-row">
                        <div><span>Full Name:</span><strong>{record.studentName}</strong></div>
                        <div><span>Academic Session:</span><strong>{record.academicYear || "2024-2028"}</strong></div>
                      </div>
                      <div className="certificate-template-row three">
                        <div><span>12-Digit APAAR ID:</span><strong>{record.apaarId.replace(/(\d{4})(?=\d)/g, "$1 ")}</strong></div>
                        <div><strong>{record.institutionName}</strong><small>Bachelor of Technology in {record.programme}</small></div>
                        <div><span>Year of Study:</span><strong>{record.yearOfStudy || "SE"}</strong></div>
                      </div>
                      <div className="certificate-template-row">
                        <div><span>Institutional PRN:</span><strong>{record.studentId || "PICT-CS-2024-089"}</strong></div>
                        <div><span>Status:</span><strong>AUTHENTICATED &amp; ACCEPTED</strong></div>
                      </div>
                    </div>

                    <div className="certificate-template-footer">
                      <div className="certificate-template-verification">VERIFICATION ID:<br /><strong>{verificationId}</strong></div>
                      <div className="certificate-template-seal"><span>AICTE</span><small>RECOGNIZED</small><b>⚖</b></div>
                      <div className="certificate-template-signatures">
                        <div><em>Asharma</em><span>Registrar</span><small>06-05-2024</small></div>
                        <div className="certificate-template-stamp">ALL INDIA COUNCIL<br /><b>♜</b><br />MINISTRY OF EDUCATION</div>
                        <div><em>R.Signnt</em><span>R.S. Registrar</span><small>06-06-2023</small></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
