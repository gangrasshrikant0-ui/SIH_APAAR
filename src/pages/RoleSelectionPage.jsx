import React from "react";
import { ArrowRight, Building2, ShieldCheck, UserCheck, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

const roles = [
  {
    title: "AICTE Administrator",
    description: "Monitor institutions, review submissions, and view verification summaries.",
    icon: ShieldCheck,
    path: "/login/aicte",
    action: "Continue as AICTE",
    className: "role-card-aicte"
  },
  {
    title: "College / Institution",
    description: "Upload student records, resolve validation issues, and review submission history.",
    icon: Building2,
    path: "/login/college",
    action: "Continue as Institution",
    className: "role-card-college"
  },
  {
    title: "External Verifier",
    description: "Review relevant student and institution records through authorized verification access.",
    icon: UserCheck,
    path: "/external/verify",
    action: "Continue as External Verifier",
    className: "role-card-external"
  },
  {
    title: "Student",
    description: "Review pending verification requests and choose whether to share your academic details.",
    icon: GraduationCap,
    path: "/login/student",
    action: "Continue as Student",
    className: "role-card-student"
  }
];

export function RoleSelectionPage() {
  return (
    <main className="roles-page">
      <div className="gov-container">
        <div className="page-heading">
          <p className="landing-eyebrow">EDUVÉRIFY access</p>
          <h1>Choose your role</h1>
          <p>Select the portal that matches your responsibilities.</p>
        </div>
        <div className="role-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
          {roles.map(({ title, description, icon: Icon, path, action, className }) => (
            <article className={`role-card ${className}`} key={title}>
              <div className="role-card-icon"><Icon size={24} /></div>
              <h2>{title}</h2>
              <p>{description}</p>
              <Link to={path} className="btn btn-primary">
                {action}
                <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
