import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight } from "lucide-react";

export function AicteWorkbench() {
  return (
    <div className="gov-container" style={{ padding: "3rem 1.25rem" }}>
      <div className="gov-card" style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center", padding: "3rem 2rem" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "12px", background: "#F3E8FF", color: "#6B21A8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
          <ShieldCheck size={28} />
        </div>
        <h2 style={{ fontSize: "1.5rem", color: "var(--gov-navy-900)", marginBottom: "0.5rem" }}>
          AICTE Central Review Workbench (Phase 2 Preview)
        </h2>
        <p style={{ fontSize: "0.9375rem", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "1.5rem" }}>
          This portal provides cross-institution monitoring, multi-college review queues, and national intake audit logs. Full multi-institution views will be expanded in Phase 2.
        </p>
        <Link to="/college/workbench" className="btn btn-secondary">
          <span>Go to College Issue Workbench (Phase 1)</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
