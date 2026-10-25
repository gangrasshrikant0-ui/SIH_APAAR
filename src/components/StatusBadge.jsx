import React from "react";
import { CheckCircle2, AlertTriangle, Clock, ShieldCheck, XCircle, ArrowUpRight, Flame } from "lucide-react";

export function StatusBadge({ status, size = "md" }) {
  if (!status) return null;

  const getStatusConfig = (s) => {
    switch (s) {
      case "UPLOADED":
        return { label: "Uploaded", icon: <Clock size={12} /> };
      case "VALIDATING":
        return { label: "Validating...", icon: <Clock size={12} className="spin-slow" /> };
      case "ACTION_REQUIRED":
        return { label: "Action Required", icon: <AlertTriangle size={12} /> };
      case "PENDING_REVIEW":
        return { label: "Pending Review", icon: <Clock size={12} /> };
      case "READY_TO_ACCEPT":
        return { label: "Ready to Accept", icon: <CheckCircle2 size={12} /> };
      case "ACCEPTED":
        return { label: "Accepted", icon: <CheckCircle2 size={12} /> };
      case "VERIFIED":
        return { label: "Verified", icon: <ShieldCheck size={12} /> };
      case "REJECTED":
        return { label: "Rejected", icon: <XCircle size={12} /> };
      default:
        return { label: s, icon: null };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`status-badge ${status}`} title={`Status: ${config.label}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }) {
  if (!severity) return null;
  const sev = severity.toLowerCase();
  return (
    <span className={`tag-badge severity-${sev}`}>
      {severity}
    </span>
  );
}

export function OverdueBadge({ isOverdue, label }) {
  if (!isOverdue) return null;
  return (
    <span className="tag-badge overdue" title="Resolution overdue past deadline">
      <Flame size={10} style={{ marginRight: "3px" }} />
      {label || "Overdue"}
    </span>
  );
}

export function EscalatedBadge({ isEscalated, label }) {
  if (!isEscalated) return null;
  return (
    <span className="tag-badge escalated" title="Escalated to AICTE Reviewer">
      <ArrowUpRight size={10} style={{ marginRight: "3px" }} />
      {label || "Escalated"}
    </span>
  );
}
