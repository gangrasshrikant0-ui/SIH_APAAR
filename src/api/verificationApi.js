// Public Verification API (Simulated REST /api/v1/verify/:token)
export const verificationApi = {
  async verifyToken(token) {
    await new Promise((res) => setTimeout(res, 200));
    // Handles 4 states: VALID, INVALID, REVOKED, NO_CONSENT
    if (token === "valid-aarav" || token === "111122223333") {
      return {
        status: "VALID",
        studentName: "Aarav Sharma",
        apaarId: "1111 2222 3333",
        institutionName: "Pune Institute of Computer Technology (PICT)",
        studentId: "SE-COMP-001",
        programme: "B.Tech Computer Engineering",
        academicYear: "2026-2027",
        enrolmentStatus: "ACCEPTED",
        verifiedAt: new Date().toISOString(),
        validationNote: "format-checked, not identity-verified",
        demoSource: "Demo mode: simulated source"
      };
    }
    if (token === "revoked") {
      return {
        status: "REVOKED",
        message: "This student enrolment credential has been revoked by the institution.",
        demoSource: "Demo mode: simulated source"
      };
    }
    if (token === "no-consent") {
      return {
        status: "NO_CONSENT",
        message: "The student has withdrawn public verification consent. No details can be disclosed.",
        demoSource: "Demo mode: simulated source"
      };
    }
    return {
      status: "INVALID",
      message: "No matching student record found for this verification token.",
      demoSource: "Demo mode: simulated source"
    };
  }
};
