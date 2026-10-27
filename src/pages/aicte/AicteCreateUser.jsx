import React, { useState } from "react";
import { UserPlus, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { aicteApi } from "../../api/aicteApi";
import { getCurrentUser } from "../../mocks/mockStore";

export function AicteCreateUser() {
  const currentUser = getCurrentUser();
  const [form, setForm] = useState({ aicteNo: "AICTE-1-1029384", collegeName: "Pune Institute of Computer Technology", email: "pict.admin@college.edu", issuingAuthority: currentUser?.name || "Dr. M. Jagadesh Kumar" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = await aicteApi.createCollegeUser({
        aicteNo: form.aicteNo,
        collegeName: form.collegeName,
        email: form.email,
        issuingAuthority: form.issuingAuthority
      });
      setResult(payload);
    } catch (e) {
      setError(e.message || "Unable to create user.");
    }
  };

  return (
    <div className="gov-container" style={{ maxWidth: "960px" }}>
      <div className="gov-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#EEF2FF", color: "#4338CA" }}>
            <UserPlus size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Create College User</h2>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)" }}>Generate institution credentials and record issuing authority in the audit trail.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>AICTE No.</span>
              <input className="search-input" value={form.aicteNo} onChange={(e) => setForm({ ...form, aicteNo: e.target.value })} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>College Name</span>
              <input className="search-input" value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>College email</span>
              <input className="search-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span>Issuing authority</span>
              <input className="search-input" value={form.issuingAuthority} onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })} />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ justifySelf: "flex-start" }}>
            <ShieldCheck size={16} />
            <span>Generate user &amp; send invite</span>
          </button>
        </form>

        {error && <div className="gov-alert gov-alert-danger" style={{ marginTop: "1rem" }}>{error}</div>}

        {result && (
          <div className="gov-alert gov-alert-success" style={{ marginTop: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <CheckCircle2 size={16} />
              <strong>Credentials generated</strong>
            </div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <div><strong>Username:</strong> {result.username}</div>
              <div><strong>Password:</strong> {result.password}</div>
              <div><strong>Email:</strong> {result.email}</div>
              <div><strong>Issued by:</strong> {result.issuingAuthority}</div>
              <div><strong>Audit record ID:</strong> {result.operationId}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem", color: "var(--text-muted)" }}>
              <Mail size={14} />
              Auto-mail queued to {result.email}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
