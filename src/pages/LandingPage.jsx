import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  UserCheck,
  CheckCircle,
  FileSpreadsheet,
  AlertOctagon,
  QrCode,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Lock,
  ExternalLink,
  Sparkles,
  Info
} from "lucide-react";
import { authApi } from "../api/authApi";
import { DEMO_ACCOUNTS } from "../mocks/mockStore";

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Login states for each card
  const [verifierEmail, setVerifierEmail] = useState(DEMO_ACCOUNTS.EXTERNAL_VERIFIER.email);
  const [verifierPass, setVerifierPass] = useState(DEMO_ACCOUNTS.EXTERNAL_VERIFIER.passwordHint);
  const [collegeEmail, setCollegeEmail] = useState(DEMO_ACCOUNTS.COLLEGE.email);
  const [collegePass, setCollegePass] = useState(DEMO_ACCOUNTS.COLLEGE.passwordHint);
  const [aicteEmail, setAicteEmail] = useState(DEMO_ACCOUNTS.AICTE.email);
  const [aictePass, setAictePass] = useState(DEMO_ACCOUNTS.AICTE.passwordHint);

  const [loadingRole, setLoadingRole] = useState(null);
  const [loginError, setLoginError] = useState("");

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(null);

  const handleExternalVerifierLogin = async (e) => {
    e.preventDefault();
    setLoadingRole("EXTERNAL_VERIFIER");
    setLoginError("");
    try {
      await authApi.login({ role: "EXTERNAL_VERIFIER", identifier: verifierEmail, password: verifierPass });
      navigate(searchParams.get("returnTo") || "/external/verify");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoadingRole(null);
    }
  };

  const handleCollegeLogin = async (e) => {
    e.preventDefault();
    setLoadingRole("COLLEGE");
    setLoginError("");
    try {
      await authApi.login({ role: "COLLEGE", identifier: collegeEmail, password: collegePass });
      navigate("/college/dashboard");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoadingRole(null);
    }
  };

  const handleAicteLogin = async (e) => {
    e.preventDefault();
    setLoadingRole("AICTE");
    setLoginError("");
    try {
      await authApi.login({ role: "AICTE", identifier: aicteEmail, password: aictePass });
      navigate("/aicte/workbench");
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoadingRole(null);
    }
  };

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: "Does this platform replace existing college ERP systems?",
      a: "No. The platform is strictly a validation, monitoring, and verification layer for AICTE. Colleges continue to use their existing ERPs and submit student data either via CSV ingestion with column mapping or via REST API."
    },
    {
      q: "Does the platform generate APAAR IDs for students?",
      a: "No. APAAR IDs are issued exclusively by the Government of India through central education authorities. Our platform validates that submitted APAAR IDs adhere to the 12-digit format and do not conflict across institutions. APAAR checks are format-checked, not identity-verified."
    },
    {
      q: "Can a college modify the approved intake of any course?",
      a: "Never. The AICTE Approval Master acts as an immutable rulebook. If an institution submits 125 students for a course with 120 approved seats, our automated engine flags the excess immediately for administrative review."
    },
    {
      q: "What is the difference between ACCEPTED and VERIFIED statuses?",
      a: "ACCEPTED means that all internal platform validation checks (format, duplicate detection, intake limits, course matching) have successfully passed and the record is stored in the repository. VERIFIED means the record has been officially confirmed by an external authorized source (e.g. DigiLocker or statutory verification body)."
    },
    {
      q: "How does the correction loop handle flagged anomalies?",
      a: "Every flagged record is assigned an owner, a specific required action, and a due date (default 7 days). When the institution fixes the record, the platform runs automatic revalidation. If unresolved past due date, issues automatically escalate to the AICTE Reviewer."
    }
  ];

  return (
    <div style={{ paddingBottom: "3rem" }}>
      {/* Hero Section */}
      <section style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)", padding: "3.5rem 0 4rem 0", borderBottom: "1px solid var(--border-light)" }}>
        <div className="gov-container" style={{ textAlign: "center", maxWidth: "960px", margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "var(--gov-blue-50)", border: "1px solid var(--border-light)", padding: "0.35rem 0.85rem", borderRadius: "9999px", fontSize: "0.8125rem", color: "var(--gov-navy-700)", fontWeight: "600", marginBottom: "1.25rem" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-green)" }}></span>
            AICTE Higher Education Compliance & Data Standardisation Layer
          </div>

          <h1 style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)", color: "var(--gov-navy-900)", marginBottom: "1rem", letterSpacing: "-0.02em" }}>
            Student data you can trust.
          </h1>

          <p style={{ fontSize: "clamp(1.05rem, 2.5vw, 1.25rem)", color: "var(--text-muted)", lineHeight: "1.6", maxWidth: "780px", margin: "0 auto 2rem auto" }}>
            A unified validation, monitoring, and verification platform that automatically checks institution data against AICTE Approval Masters, tracks fixes until resolved, and delivers verifiable student credentials.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "3rem" }}>
            <a href="#about" className="btn btn-secondary btn-lg">
              Learn More
            </a>
            <a href="#logins" className="btn btn-primary btn-lg">
              <span>Access Role Portals</span>
              <ArrowRight size={18} />
            </a>
          </div>

          {/* Error Banner if any */}
          {loginError && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", color: "#991B1B", padding: "0.75rem", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
              {loginError}
            </div>
          )}

          {/* Three Login Cards */}
          <div id="logins" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "1.5rem", textAlign: "left" }}>
            {/* 1. External Verifier Login Card */}
            <div className="gov-card" style={{ display: "flex", flexDirection: "column", borderColor: "#BBF7D0", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", color: "var(--gov-navy-900)" }}>External Verifier</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Employer / Regulator</span>
                </div>
              </div>

              <div style={{ background: "#F0FDF4", border: "1px solid #DCFCE7", padding: "0.6rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", color: "#166534", marginBottom: "1rem" }}>
                <strong>Demo Mode:</strong> Authorised stakeholder access.
              </div>

              <form onSubmit={handleExternalVerifierLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Verifier Email
                  </label>
                  <input
                    type="email"
                    value={verifierEmail}
                    onChange={(e) => setVerifierEmail(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Password (Demo: <code>demo123</code>)
                  </label>
                  <input
                    type="password"
                    value={verifierPass}
                    onChange={(e) => setVerifierPass(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", background: "#166534" }}
                    disabled={loadingRole === "EXTERNAL_VERIFIER"}
                  >
                    {loadingRole === "EXTERNAL_VERIFIER" ? "Logging in..." : "Login as External Verifier"}
                  </button>
                </div>
              </form>
            </div>

            {/* 2. College Login Card */}
            <div className="gov-card" style={{ display: "flex", flexDirection: "column", borderColor: "#BFDBFE" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#DBEAFE", color: "#1E40AF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", color: "var(--gov-navy-900)" }}>College Portal</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Upload CSV & Issue Workbench</span>
                </div>
              </div>

              <div style={{ background: "#EFF6FF", border: "1px solid #DBEAFE", padding: "0.6rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", color: "#1E40AF", marginBottom: "1rem" }}>
                <strong>Institution:</strong> PICT Pune (<code>AICTE-1-1029384</code>)
              </div>

              <form onSubmit={handleCollegeLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Institutional Officer Email
                  </label>
                  <input
                    type="email"
                    value={collegeEmail}
                    onChange={(e) => setCollegeEmail(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Password (Demo: <code>demo123</code>)
                  </label>
                  <input
                    type="password"
                    value={collegePass}
                    onChange={(e) => setCollegePass(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", background: "#1E40AF" }}
                    disabled={loadingRole === "COLLEGE"}
                  >
                    {loadingRole === "COLLEGE" ? "Logging in..." : "Login as College"}
                  </button>
                </div>
              </form>
            </div>

            {/* 3. AICTE Central Login Card */}
            <div className="gov-card" style={{ display: "flex", flexDirection: "column", borderColor: "#E9D5FF" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#F3E8FF", color: "#6B21A8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.125rem", color: "var(--gov-navy-900)" }}>AICTE Portal</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>National monitoring & review queue</span>
                </div>
              </div>

              <div style={{ background: "#FAF5FF", border: "1px solid #F3E8FF", padding: "0.6rem 0.75rem", borderRadius: "6px", fontSize: "0.75rem", color: "#6B21A8", marginBottom: "1rem" }}>
                <strong>Role:</strong> AICTE Central Reviewer (All Institutions)
              </div>

              <form onSubmit={handleAicteLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Official AICTE Email
                  </label>
                  <input
                    type="email"
                    value={aicteEmail}
                    onChange={(e) => setAicteEmail(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "700", color: "var(--gov-navy-800)", marginBottom: "3px" }}>
                    Password (Demo: <code>demo123</code>)
                  </label>
                  <input
                    type="password"
                    value={aictePass}
                    onChange={(e) => setAictePass(e.target.value)}
                    className="search-input"
                    style={{ width: "100%", fontSize: "0.875rem" }}
                  />
                </div>

                <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", background: "#6B21A8" }}
                    disabled={loadingRole === "AICTE"}
                  >
                    {loadingRole === "AICTE" ? "Logging in..." : "Login as AICTE"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" style={{ padding: "4rem 0", background: "#FFFFFF", borderBottom: "1px solid var(--border-light)" }}>
        <div className="gov-container">
          <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", color: "var(--gov-navy-900)", marginBottom: "1rem" }}>
              About the Platform
            </h2>
            <p style={{ fontSize: "1.05rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
              Today, AICTE receives student admissions data in diverse formats from thousands of colleges across India, making it hard to trust. This platform creates one centralized, standardized layer using APAAR ID as the common student identifier.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "12px", padding: "1.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#166534", fontWeight: "700", fontSize: "1.1rem", marginBottom: "1rem" }}>
                <CheckCircle size={20} />
                <span>What We ARE Building</span>
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9375rem" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#166534", fontWeight: "bold" }}>✓</span>
                  <span>A validation, monitoring and verification layer for AICTE.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#166534", fontWeight: "bold" }}>✓</span>
                  <span>An extension module designed to connect institutional ERPs with AICTE central systems; integration is simulated in this prototype.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#166534", fontWeight: "bold" }}>✓</span>
                  <span>A closed-loop issue workbench that finds data anomalies and tracks their correction.</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#166534", fontWeight: "bold" }}>✓</span>
                  <span>A tamper-evident public verification service displaying both APAAR ID & Institutional ID.</span>
                </li>
              </ul>
            </div>

            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", padding: "1.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#991B1B", fontWeight: "700", fontSize: "1.1rem", marginBottom: "1rem" }}>
                <AlertOctagon size={20} />
                <span>What We Are NOT Building</span>
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9375rem" }}>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#991B1B", fontWeight: "bold" }}>✗</span>
                  <span>A replacement for college ERPs (colleges retain their software).</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#991B1B", fontWeight: "bold" }}>✗</span>
                  <span>A new APAAR ID generator (APAAR IDs are issued solely by the government).</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#991B1B", fontWeight: "bold" }}>✗</span>
                  <span>A new AICTE approval portal (we read Approval Master, we never edit approved intake).</span>
                </li>
                <li style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#991B1B", fontWeight: "bold" }}>✗</span>
                  <span>Blockchain or black-box ML scoring (rule-based explainability only).</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section (Three Icons: Validate, Track Fixes, Verify) */}
      <section id="benefits" style={{ padding: "4rem 0", background: "#F8FAFC", borderBottom: "1px solid var(--border-light)" }}>
        <div className="gov-container">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto 3rem auto" }}>
            <h2 style={{ fontSize: "2rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
              Three Core Pillars
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)" }}>
              Built specifically to overcome the gaps identified in educational compliance audits.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
            {/* Pillar 1: Validate */}
            <div className="gov-card" style={{ textAlign: "center", padding: "2.5rem 1.75rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "var(--gov-blue-100)", color: "var(--gov-navy-700)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <CheckCircle size={28} />
              </div>
              <h3 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
                1. Automated Validation
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Automated rule-based checks evaluate 12-digit APAAR format, batch & repository duplicates, cross-institution conflicts, approved intake quotas, and NRI/FN supernumerary limits.
              </p>
            </div>

            {/* Pillar 2: Track Fixes */}
            <div className="gov-card" style={{ textAlign: "center", padding: "2.5rem 1.75rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#FEF3C7", color: "#B45309", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <FileSpreadsheet size={28} />
              </div>
              <h3 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
                2. Track Every Fix
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Closing the loop: every anomaly has an owner, required action, and due date. Resubmitting triggers automatic revalidation, and overdue issues auto-escalate to AICTE.
              </p>
            </div>

            {/* Pillar 3: Verify */}
            <div className="gov-card" style={{ textAlign: "center", padding: "2.5rem 1.75rem" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#DCFCE7", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
                <QrCode size={28} />
              </div>
              <h3 style={{ fontSize: "1.25rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
                3. Tamper-Evident Verification
              </h3>
              <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6" }}>
                Authorized employers and regulators verify student credentials via QR code and token with granular student consent. Certificates display both APAAR ID and institutional student ID.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (Four Steps: Upload, Check, Correct, Verify) */}
      <section id="how-it-works" style={{ padding: "4rem 0", background: "#FFFFFF", borderBottom: "1px solid var(--border-light)" }}>
        <div className="gov-container">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto 3.5rem auto" }}>
            <h2 style={{ fontSize: "2rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
              How It Works: The End-to-End Cycle
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)" }}>
              From initial college CSV ingestion to real-time central AICTE oversight.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem", position: "relative" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gov-navy-900)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", marginBottom: "1rem" }}>
                1
              </div>
              <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>Upload</h4>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                College uploads admissions CSV. Column mapping standardizes roll numbers and PRNs into uniform schemas.
              </p>
            </div>

            <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gov-navy-900)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", marginBottom: "1rem" }}>
                2
              </div>
              <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>Check</h4>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Automated validation runs explainable checks against the AICTE Approval Master rulebook.
              </p>
            </div>

            <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gov-navy-900)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", marginBottom: "1rem" }}>
                3
              </div>
              <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>Correct</h4>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Issue workbench provides evidence and owner. Fixing fields resubmits with instant revalidation feedback.
              </p>
            </div>

            <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "10px", padding: "1.5rem" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gov-navy-900)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", marginBottom: "1rem" }}>
                4
              </div>
              <h4 style={{ fontSize: "1.1rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>Verify</h4>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Accepted records populate real-time dashboards and can be verified via token and student-controlled QR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faqs" style={{ padding: "4rem 0", background: "#F8FAFC" }}>
        <div className="gov-container" style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", color: "var(--gov-navy-900)", marginBottom: "0.75rem" }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)" }}>
              Clear compliance answers for evaluation panels and institutions.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid var(--border-light)",
                  borderRadius: "8px",
                  overflow: "hidden"
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1.25rem",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontWeight: "600",
                    color: "var(--gov-navy-900)"
                  }}
                  aria-expanded={openFaq === idx}
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {openFaq === idx && (
                  <div style={{ padding: "0 1.25rem 1.25rem 1.25rem", fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6", borderTop: "1px solid var(--border-light)", paddingTop: "1rem" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
