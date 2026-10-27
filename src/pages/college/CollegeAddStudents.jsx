import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus, Users, CheckCircle2, AlertTriangle,
  Trash2, Plus, RefreshCw, ArrowRight
} from "lucide-react";
import { collegeApi } from "../../api/collegeApi";
import { ingestStudent, isBackendConfigured, storedRecordsOnly } from "../../api/ingestionApi";
import { getCurrentUser } from "../../mocks/mockStore";
import {
  MAX_STUDENT_ROWS,
  PROGRAMMES,
  YEARS,
  CATEGORIES,
  createEmptyStudent,
  addStudentRow,
  removeStudentRow,
  clearStudentRows,
  rowsReadyToStage
} from "./studentEntry";

function hintForField(key, value) {
  if (key === "studentId" && !value.trim()) return "Student ID / PRN is required.";
  if (key === "studentName" && !value.trim()) return "Student name is required.";
  if (key === "apaarId") {
    if (!value.trim()) return "APAAR ID is required.";
    if (!/^\d{12}$/.test(value.trim())) return "Must be exactly 12 numeric digits.";
  }
  return "";
}

function SingleStudentForm({ institution, onSaved }) {
  const [form, setForm] = useState({ ...createEmptyStudent() });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [saveError, setSaveError] = useState("");
  const [backendNotice, setBackendNotice] = useState("");

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched({ studentId: true, studentName: true, apaarId: true });
    setSaveError("");
    setSaving(true);
    try {
      const currentUser = getCurrentUser();
      const res = isBackendConfigured()
        ? await ingestStudent(form, currentUser?.id || "INST-001")
        : await collegeApi.addStudentsToStaging([form], "MANUAL_ENTRY");
      if (res.offline) {
        setBackendNotice("Backend unavailable; the record was saved locally.");
        await collegeApi.addStudentsToStaging([form], "MANUAL_ENTRY");
      }
      if (isBackendConfigured() && !res.offline) {
        await collegeApi.addStudentsToStaging([form], "MANUAL_ENTRY");
      }
      setForm({ ...createEmptyStudent() });
      setTouched({});
      onSaved(res.offline ? 1 : (res.storedClean || 0) + (res.storedFlagged || 0) || res.addedCount);
    } catch (err) {
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const field = (id, label, required, children) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label
        htmlFor={id}
        className="filter-label"
        style={{ fontWeight: "700", color: "var(--gov-navy-800)" }}
      >
        {label}{required && <span aria-hidden="true" style={{ color: "#DC2626" }}> *</span>}
      </label>
      {children}
    </div>
  );

  const err = (id, key, value) =>
    touched[key] && hintForField(key, value) ? (
      <span id={id} role="alert" style={{ fontSize: "0.75rem", color: "#DC2626" }}>
        {hintForField(key, value)}
      </span>
    ) : null;

  return (
    <form onSubmit={handleSave} noValidate aria-label="Add single student form">
      <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--gov-navy-900)" }}>Institution:</strong>{" "}
        {institution} &bull; <em>Pre-filled from your logged-in account (read-only)</em>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        {field("sf-sid", "Student ID / PRN", true, <>
          <input
            id="sf-sid"
            type="text"
            className="search-input"
            value={form.studentId}
            onChange={(e) => set("studentId", e.target.value)}
            onBlur={() => touch("studentId")}
            placeholder="e.g. SE-COMP-042"
            aria-required="true"
            aria-describedby="sf-sid-err"
          />
          {err("sf-sid-err", "studentId", form.studentId)}
        </>)}

        {field("sf-name", "Student Full Name", true, <>
          <input
            id="sf-name"
            type="text"
            className="search-input"
            value={form.studentName}
            onChange={(e) => set("studentName", e.target.value)}
            onBlur={() => touch("studentName")}
            placeholder="e.g. Priya Sharma"
            aria-required="true"
            aria-describedby="sf-name-err"
          />
          {err("sf-name-err", "studentName", form.studentName)}
        </>)}

        {field("sf-apaar", "APAAR ID (12 Digits)", true, <>
          <input
            id="sf-apaar"
            type="text"
            className="search-input"
            value={form.apaarId}
            onChange={(e) => set("apaarId", e.target.value)}
            onBlur={() => touch("apaarId")}
            placeholder="12 numeric digits"
            inputMode="numeric"
            aria-required="true"
            aria-describedby="sf-apaar-err sf-apaar-hint"
          />
          <span id="sf-apaar-hint" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Format-checked only — not identity-verified.
          </span>
          {err("sf-apaar-err", "apaarId", form.apaarId)}
        </>)}

        {field("sf-prog", "Programme", true, <select id="sf-prog" className="filter-select" value={form.programme} onChange={(e) => set("programme", e.target.value)}>
          {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>)}

        {field("sf-year", "Academic Year", true, <select id="sf-year" className="filter-select" value={form.yearOfStudy} onChange={(e) => set("yearOfStudy", e.target.value)}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>)}

        {field("sf-cat", "Seat Category", true, <select id="sf-cat" className="filter-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c === "NRI_FN" ? "NRI / OCI / Foreign National (NRI_FN)" : c}</option>)}
        </select>)}

        {field("sf-oci", "OCI Status", false, <select id="sf-oci" className="filter-select" value={form.ociStatus} onChange={(e) => set("ociStatus", e.target.value)}>
          <option value="NOT_APPLICABLE">Not applicable</option>
          <option value="NOT_RECORDED">Not recorded</option>
          <option value="CONFIRMED">Confirmed</option>
        </select>)}

        {field("sf-fn", "Foreign National Status", false, <select id="sf-fn" className="filter-select" value={form.foreignNationalStatus} onChange={(e) => set("foreignNationalStatus", e.target.value)}>
          <option value="NOT_APPLICABLE">Not applicable</option>
          <option value="NOT_RECORDED">Not recorded</option>
          <option value="CONFIRMED">Confirmed</option>
        </select>)}

        {field("sf-supernumerary", "Supernumerary Seats", false, <input id="sf-supernumerary" type="number" min="0" className="filter-select" value={form.supernumerarySeats} onChange={(e) => set("supernumerarySeats", e.target.value)} />)}

        {field("sf-gender", "Gender", false, <select id="sf-gender" className="filter-select" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="">— Select —</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>)}

        {field("sf-doa", "Date of Admission", false, <input id="sf-doa" type="date" className="filter-select" value={form.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} />)}
      </div>

      {saveError && (
        <p role="alert" style={{ color: "#DC2626", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{saveError}</p>
      )}
      {backendNotice && <p role="status" style={{ color: "#92400E", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{backendNotice}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
        {saving ? <><RefreshCw size={14} className="spin-slow" /><span>Saving…</span></> : <><CheckCircle2 size={14} /><span>Save to staging</span></>}
      </button>
    </form>
  );
}

function MultiStudentForm({ institution, onSaved }) {
  const [rows, setRows] = useState([createEmptyStudent()]);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [saveError, setSaveError] = useState("");
  const [backendNotice, setBackendNotice] = useState("");

  const addRow = () => setRows((r) => addStudentRow(r));
  const removeRow = (idx) => setRows((r) => removeStudentRow(r, idx));
  const setCell = (idx, key, val) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));
  };
  const touchCell = (idx, key) => setTouched((t) => ({ ...t, [`${idx}-${key}`]: true }));

  const handleSave = async (e) => {
    e.preventDefault();
    const allTouched = {};
    rows.forEach((_, i) => {
      ["studentId", "studentName", "apaarId"].forEach((k) => {
        allTouched[`${i}-${k}`] = true;
      });
    });
    setTouched(allTouched);
    setSaveError("");

    const toSave = rowsReadyToStage(rows);
    if (toSave.length === 0) {
      setSaveError("Enter at least one student before saving.");
      return;
    }

    setSaving(true);
    try {
      const currentUser = getCurrentUser();
      const backendResults = isBackendConfigured()
        ? await Promise.allSettled(toSave.map((student) => ingestStudent(student, currentUser?.id || "INST-001")))
        : [];
      const offline = backendResults.some((result) => result.status === "fulfilled" && result.value.offline);
      if (offline) {
        setBackendNotice("Backend unavailable; records were saved locally.");
        await collegeApi.addStudentsToStaging(toSave, "MANUAL_ENTRY");
      } else {
        const successful = backendResults
          .filter((result) => result.status === "fulfilled" && storedRecordsOnly(result.value).length)
          .flatMap((result) => storedRecordsOnly(result.value));
        if (successful.length) await collegeApi.addStudentsToStaging(successful, "MANUAL_ENTRY");
        const failedIndexes = new Set(backendResults.flatMap((result, index) => result.status === "rejected" ? [index] : []));
        if (failedIndexes.size) setSaveError("Some rows were rejected. Correct the highlighted rows and try again.");
        setRows((current) => current.filter((_, index) => failedIndexes.has(index)));
      }
      if (offline || !backendResults.some((result) => result.status === "rejected")) setRows(clearStudentRows());
      setTouched({});
      onSaved(backendResults.length ? backendResults.filter((result) => result.status === "fulfilled" && result.value.records?.length).length : toSave.length);
    } catch (err) {
      setSaveError(err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const colStyle = { padding: "0.4rem 0.5rem", fontSize: "0.8125rem" };
  const inputStyle = { width: "100%", fontSize: "0.8125rem", padding: "0.35rem 0.5rem", border: "1px solid var(--border-medium)", borderRadius: "var(--radius-sm)", background: "#FFF" };
  const errStyle = { fontSize: "0.7rem", color: "#DC2626", display: "block", marginTop: "2px" };

  return (
    <form onSubmit={handleSave} noValidate aria-label="Add multiple students form">
      <div style={{ background: "#F8FAFC", border: "1px solid var(--border-light)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--gov-navy-900)" }}>Institution:</strong>{" "}
        {institution} &bull; <em>Read-only. Up to {MAX_STUDENT_ROWS} rows.</em>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }} aria-label="Student rows table">
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "2px solid var(--border-medium)" }}>
              <th style={{ ...colStyle, width: "28px" }} scope="col">#</th>
              <th style={{ ...colStyle, minWidth: "120px" }} scope="col">Student ID / PRN <span aria-hidden="true" style={{ color: "#DC2626" }}>*</span></th>
              <th style={{ ...colStyle, minWidth: "150px" }} scope="col">Name <span aria-hidden="true" style={{ color: "#DC2626" }}>*</span></th>
              <th style={{ ...colStyle, minWidth: "130px" }} scope="col">APAAR ID <span aria-hidden="true" style={{ color: "#DC2626" }}>*</span></th>
              <th style={{ ...colStyle, minWidth: "180px" }} scope="col">Programme</th>
              <th style={{ ...colStyle, minWidth: "70px" }} scope="col">Year</th>
              <th style={{ ...colStyle, minWidth: "110px" }} scope="col">Category</th>
              <th style={{ ...colStyle, minWidth: "110px" }} scope="col">OCI Status</th>
              <th style={{ ...colStyle, minWidth: "140px" }} scope="col">FN Status</th>
              <th style={{ ...colStyle, minWidth: "100px" }} scope="col">Supernumerary</th>
              <th style={{ ...colStyle, minWidth: "80px" }} scope="col">Gender</th>
              <th style={{ ...colStyle, minWidth: "120px" }} scope="col">Admission Date</th>
              <th style={{ ...colStyle, width: "36px" }} scope="col" aria-label="Remove row"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`row-${idx}`} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={colStyle}>{idx + 1}</td>
                <td style={colStyle}>
                  <input
                    type="text"
                    style={{ ...inputStyle, borderColor: touched[`${idx}-studentId`] && hintForField("studentId", row.studentId) ? "#DC2626" : undefined }}
                    value={row.studentId}
                    onChange={(e) => setCell(idx, "studentId", e.target.value)}
                    onBlur={() => touchCell(idx, "studentId")}
                    placeholder="SE-COMP-042"
                    aria-label={`Row ${idx + 1} Student ID`}
                    aria-required="true"
                  />
                  {touched[`${idx}-studentId`] && hintForField("studentId", row.studentId) && (
                    <span role="alert" style={errStyle}>{hintForField("studentId", row.studentId)}</span>
                  )}
                </td>
                <td style={colStyle}>
                  <input
                    type="text"
                    style={{ ...inputStyle, borderColor: touched[`${idx}-studentName`] && hintForField("studentName", row.studentName) ? "#DC2626" : undefined }}
                    value={row.studentName}
                    onChange={(e) => setCell(idx, "studentName", e.target.value)}
                    onBlur={() => touchCell(idx, "studentName")}
                    placeholder="Student name"
                    aria-label={`Row ${idx + 1} Student Name`}
                    aria-required="true"
                  />
                  {touched[`${idx}-studentName`] && hintForField("studentName", row.studentName) && (
                    <span role="alert" style={errStyle}>{hintForField("studentName", row.studentName)}</span>
                  )}
                </td>
                <td style={colStyle}>
                  <input
                    type="text"
                    style={{ ...inputStyle, fontFamily: "monospace", borderColor: touched[`${idx}-apaarId`] && hintForField("apaarId", row.apaarId) ? "#DC2626" : undefined }}
                    value={row.apaarId}
                    onChange={(e) => setCell(idx, "apaarId", e.target.value)}
                    onBlur={() => touchCell(idx, "apaarId")}
                    inputMode="numeric"
                    placeholder="12 digits"
                    aria-label={`Row ${idx + 1} APAAR ID`}
                    aria-required="true"
                  />
                  {touched[`${idx}-apaarId`] && hintForField("apaarId", row.apaarId) && (
                    <span role="alert" style={errStyle}>{hintForField("apaarId", row.apaarId)}</span>
                  )}
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.programme} onChange={(e) => setCell(idx, "programme", e.target.value)} aria-label={`Row ${idx + 1} Programme`}>
                    {PROGRAMMES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.yearOfStudy} onChange={(e) => setCell(idx, "yearOfStudy", e.target.value)} aria-label={`Row ${idx + 1} Year`}>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.category} onChange={(e) => setCell(idx, "category", e.target.value)} aria-label={`Row ${idx + 1} Category`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.ociStatus} onChange={(e) => setCell(idx, "ociStatus", e.target.value)} aria-label={`Row ${idx + 1} OCI Status`}>
                    <option value="NOT_APPLICABLE">N/A</option><option value="NOT_RECORDED">Not recorded</option><option value="CONFIRMED">Confirmed</option>
                  </select>
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.foreignNationalStatus} onChange={(e) => setCell(idx, "foreignNationalStatus", e.target.value)} aria-label={`Row ${idx + 1} Foreign National Status`}>
                    <option value="NOT_APPLICABLE">N/A</option><option value="NOT_RECORDED">Not recorded</option><option value="CONFIRMED">Confirmed</option>
                  </select>
                </td>
                <td style={colStyle}>
                  <input type="number" min="0" style={inputStyle} value={row.supernumerarySeats} onChange={(e) => setCell(idx, "supernumerarySeats", e.target.value)} aria-label={`Row ${idx + 1} Supernumerary Seats`} />
                </td>
                <td style={colStyle}>
                  <select style={inputStyle} value={row.gender} onChange={(e) => setCell(idx, "gender", e.target.value)} aria-label={`Row ${idx + 1} Gender`}>
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td style={colStyle}>
                  <input
                    type="date"
                    style={inputStyle}
                    value={row.admissionDate}
                    onChange={(e) => setCell(idx, "admissionDate", e.target.value)}
                    aria-label={`Row ${idx + 1} Admission Date`}
                  />
                </td>
                <td style={colStyle}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                    title="Remove this row"
                    aria-label={`Remove row ${idx + 1}`}
                    style={{ padding: "0.25rem 0.5rem" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={addRow}
          disabled={rows.length >= MAX_STUDENT_ROWS}
          title={rows.length >= MAX_STUDENT_ROWS ? `Maximum ${MAX_STUDENT_ROWS} rows` : "Add another row"}
        >
          <Plus size={13} />
          <span>Add row</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setRows(clearStudentRows()); setTouched({}); }}
          title="Clear all rows"
        >
          <Trash2 size={13} />
          <span>Clear all</span>
        </button>
        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", alignSelf: "center" }}>
          {rows.length} of {MAX_STUDENT_ROWS} rows
        </span>
      </div>

      {saveError && (
        <p role="alert" style={{ color: "#DC2626", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{saveError}</p>
      )}
      {backendNotice && <p role="status" style={{ color: "#92400E", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>{backendNotice}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
        {saving
          ? <><RefreshCw size={14} className="spin-slow" /><span>Saving…</span></>
          : <><CheckCircle2 size={14} /><span>Save to staging</span></>}
      </button>
    </form>
  );
}

export function CollegeAddStudents() {
  const currentUser = getCurrentUser();
  const institution = currentUser?.institutionName || "Institution";

  const [mode, setMode] = useState("single");
  const [savedCount, setSavedCount] = useState(null);

  const handleSaved = (count) => {
    setSavedCount(count);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="gov-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.75rem", color: "var(--gov-navy-900)" }}>
          Add Students
        </h2>
      </div>

      {savedCount !== null && (
        <div
          style={{
            background: "#DCFCE7", border: "1px solid #86EFAC", color: "#166534",
            padding: "0.85rem 1rem", borderRadius: "8px", marginBottom: "1.5rem",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem"
          }}
          role="status"
        >
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle2 size={18} />
            <strong>{savedCount} record{savedCount !== 1 ? "s" : ""}</strong> saved to staging area successfully.
          </span>
          <Link to="/college/workbench" className="btn btn-primary btn-sm">
            <span>Review in Issue Workbench</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="gov-card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }} role="group" aria-label="Entry mode">
          <button
            type="button"
            id="mode-single"
            className={`btn ${mode === "single" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => { setMode("single"); setSavedCount(null); }}
            aria-pressed={mode === "single"}
          >
            <UserPlus size={14} />
            <span>Single student</span>
          </button>
          <button
            type="button"
            id="mode-multi"
            className={`btn ${mode === "multi" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => { setMode("multi"); setSavedCount(null); }}
            aria-pressed={mode === "multi"}
          >
            <Users size={14} />
            <span>Few students (table)</span>
          </button>
        </div>

        {mode === "single"
          ? <SingleStudentForm institution={institution} onSaved={handleSaved} />
          : <MultiStudentForm institution={institution} onSaved={handleSaved} />}
      </div>

      <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#92400E" }}>
        <AlertTriangle size={14} style={{ display: "inline", marginRight: "4px" }} />
        <strong>Inline hints</strong> (required field, 12-digit APAAR) are shown above for immediate feedback.
        Records are checked automatically when saved. Review any flagged items in the{" "}
        <Link to="/college/workbench" style={{ color: "#92400E", fontWeight: "700" }}>Issue Workbench</Link>.
      </div>
    </div>
  );
}
