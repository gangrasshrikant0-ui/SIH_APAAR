import React from "react";
import { Info } from "lucide-react";

export function GovFooter() {
  return (
    <footer className="gov-footer" role="contentinfo">
      <div className="gov-container gov-footer-inner">
        <div>
          <strong>EDUVÉRIFY</strong>
          <span> — Academic Data Verification</span>
        </div>
        <div>Smart India Hackathon 2026 Prototype</div>
        <div className="gov-footer-disclaimer"><Info size={15} /> Synthetic demo data. Not an official government site.</div>
      </div>
    </footer>
  );
}
