import React from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="gov-container landing-hero-content">
          <div className="landing-eyebrow">
            <ShieldCheck size={18} />
            Academic Data Verification
          </div>
          <h1>Trusted academic records, verified with confidence.</h1>
          <p>
            EDUVÉRIFY helps institutions submit, validate, and track student
            records against approved academic data standards.
          </p>
          <Link to="/roles" className="btn btn-primary btn-lg">
            Choose your portal
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
